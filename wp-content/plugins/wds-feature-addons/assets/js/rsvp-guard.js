(function ($) {
    'use strict';

    var config = window.WDSFARsvpGuard || null;
    if (!config || !config.postId) {
        return;
    }

    var state = {
        challenge: '',
        challengeIssuedAt: 0,
        challengeMinAge: parseInt(config.challengeMinAge || 4, 10) || 4,
        challengeLoading: false,
        ticket: '',
        ticketIssuedAt: 0,
        ticketExpiresIn: parseInt(config.ticketExpiresIn || 180, 10) || 180,
        ticketLoading: false,
        ticketTimer: null,
        interactions: 0,
        turnstileToken: '',
        turnstileWidget: null,
        turnstileReady: false,
        replayingSubmit: false
    };

    function getAjaxUrl() {
        var modern = $('.wds-wishes[data-ajax-url], .wds-rsvp-only[data-ajax-url]').first().attr('data-ajax-url');
        if (modern) {
            return modern;
        }
        if (window.WDS_RSVP && window.WDS_RSVP.ajaxurl) {
            return window.WDS_RSVP.ajaxurl;
        }
        return config.ajaxUrl || '';
    }

    function isProtected(data) {
        if (!(data instanceof FormData)) {
            return false;
        }

        var action = String(data.get('action') || '');
        var name = String(data.get('name') || '');

        return action === 'insert_comment' || (action === 'run_wds' && (name === 'wishes_submit' || name === 'rsvp_submit'));
    }

    function getPostId(data) {
        return parseInt(data.get('comment_post_ID') || data.get('post_id') || 0, 10) || 0;
    }

    function nowSeconds() {
        return Math.floor(Date.now() / 1000);
    }

    function clearTicketTimer() {
        if (state.ticketTimer) {
            window.clearTimeout(state.ticketTimer);
            state.ticketTimer = null;
        }
    }

    function ticketIsFresh() {
        if (!state.ticket || !state.ticketIssuedAt) {
            return false;
        }
        return (nowSeconds() - state.ticketIssuedAt) < Math.max(20, state.ticketExpiresIn - 20);
    }

    function recordInteraction(event) {
        if (event && event.isTrusted === false) {
            return;
        }
        state.interactions = Math.min(50, state.interactions + 1);
        scheduleTicketExchange(0);
    }

    ['pointerdown', 'touchstart', 'keydown', 'change', 'focusin'].forEach(function (eventName) {
        document.addEventListener(eventName, recordInteraction, true);
    });

    function addTrapToForm(form) {
        if (!form || form.querySelector('[name="wdsfa_company"]')) {
            return;
        }

        var wrap = document.createElement('div');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.style.position = 'absolute';
        wrap.style.left = '-10000px';
        wrap.style.top = 'auto';
        wrap.style.width = '1px';
        wrap.style.height = '1px';
        wrap.style.overflow = 'hidden';
        wrap.style.opacity = '0';
        wrap.style.pointerEvents = 'none';

        var label = document.createElement('label');
        label.textContent = 'Company website';

        var input = document.createElement('input');
        input.type = 'text';
        input.name = 'wdsfa_company';
        input.value = '';
        input.tabIndex = -1;
        input.autocomplete = 'new-password';

        label.appendChild(input);
        wrap.appendChild(label);
        form.appendChild(wrap);
    }

    function setupTraps() {
        document.querySelectorAll('.saic-container-form form, .wds-wishes__form, .wds-rsvp-only__form').forEach(addTrapToForm);
    }

    function observeForms() {
        setupTraps();
        if (!window.MutationObserver) {
            return;
        }
        var queued = false;
        new MutationObserver(function () {
            if (queued) {
                return;
            }
            queued = true;
            window.requestAnimationFrame(function () {
                queued = false;
                setupTraps();
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    function fetchChallenge() {
        if (!config.browserChallenge || state.challengeLoading || state.ticketLoading) {
            return;
        }

        var url = getAjaxUrl();
        if (!url) {
            return;
        }

        clearTicketTimer();
        state.challengeLoading = true;
        state.challenge = '';
        state.challengeIssuedAt = 0;

        $.ajax({
            url: url,
            type: 'POST',
            dataType: 'json',
            data: {
                action: 'wdsfa_rsvp_challenge',
                post_id: parseInt(config.postId, 10)
            }
        }).done(function (response) {
            if (response && response.success && response.data && response.data.challenge) {
                state.challenge = String(response.data.challenge);
                state.challengeIssuedAt = parseInt(response.data.issuedAt || nowSeconds(), 10) || nowSeconds();
                state.challengeMinAge = parseInt(response.data.minAge || state.challengeMinAge, 10) || state.challengeMinAge;
                scheduleTicketExchange(0);
            }
        }).always(function () {
            state.challengeLoading = false;
        });
    }

    function scheduleTicketExchange(extraDelayMs) {
        if (!config.browserChallenge || ticketIsFresh() || state.ticketLoading || !state.challenge || !state.challengeIssuedAt || state.interactions < 1) {
            return;
        }

        clearTicketTimer();

        var age = nowSeconds() - state.challengeIssuedAt;
        var waitSeconds = Math.max(0, state.challengeMinAge - age);
        var delay = Math.max(0, waitSeconds * 1000 + 80 + (extraDelayMs || 0));

        state.ticketTimer = window.setTimeout(function () {
            state.ticketTimer = null;
            fetchTicket();
        }, delay);
    }

    function fetchTicket() {
        if (!config.browserChallenge || state.ticketLoading || ticketIsFresh() || !state.challenge || state.interactions < 1) {
            return;
        }

        var url = getAjaxUrl();
        if (!url) {
            return;
        }

        var challenge = state.challenge;
        state.challenge = '';
        state.ticketLoading = true;

        $.ajax({
            url: url,
            type: 'POST',
            dataType: 'json',
            data: {
                action: 'wdsfa_rsvp_ticket',
                post_id: parseInt(config.postId, 10),
                challenge: challenge,
                js: 1,
                interactions: state.interactions,
                webdriver: navigator.webdriver === true ? 1 : 0
            }
        }).done(function (response) {
            if (response && response.success && response.data && response.data.ticket) {
                state.ticket = String(response.data.ticket);
                state.ticketIssuedAt = parseInt(response.data.issuedAt || nowSeconds(), 10) || nowSeconds();
                state.ticketExpiresIn = parseInt(response.data.expiresIn || state.ticketExpiresIn, 10) || state.ticketExpiresIn;
                return;
            }

            state.ticket = '';
            state.ticketIssuedAt = 0;
            window.setTimeout(fetchChallenge, 700);
        }).fail(function () {
            state.ticket = '';
            state.ticketIssuedAt = 0;
            window.setTimeout(fetchChallenge, 900);
        }).always(function () {
            state.ticketLoading = false;
        });
    }

    function resetSecurityMaterial() {
        clearTicketTimer();
        state.ticket = '';
        state.ticketIssuedAt = 0;
        state.challenge = '';
        state.challengeIssuedAt = 0;
        window.setTimeout(fetchChallenge, 180);
    }

    function ensureSecurityMaterial() {
        if (ticketIsFresh()) {
            return;
        }
        state.ticket = '';
        state.ticketIssuedAt = 0;

        if (state.challenge) {
            scheduleTicketExchange(0);
        } else {
            fetchChallenge();
        }
    }

    function isProtectedForm(form) {
        if (!form || typeof form.matches !== 'function') {
            return false;
        }
        return form.matches('.saic-container-form form, .wds-wishes__form, .wds-rsvp-only__form');
    }

    function waitForTicket(callback, startedAt) {
        if (ticketIsFresh()) {
            callback(true);
            return;
        }

        var started = startedAt || Date.now();
        if ((Date.now() - started) > 8000) {
            callback(false);
            return;
        }

        ensureSecurityMaterial();
        window.setTimeout(function () {
            waitForTicket(callback, started);
        }, 120);
    }

    // Hold a real form submit for a moment if the one-time server ticket is still being minted.
    // This prevents fast human clicks from being rejected while keeping the write endpoint fail-closed.
    document.addEventListener('submit', function (event) {
        var form = event.target;
        if (state.replayingSubmit || !isProtectedForm(form) || ticketIsFresh()) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        state.interactions = Math.max(1, state.interactions);
        scheduleTicketExchange(0);

        var submitter = event.submitter || null;
        waitForTicket(function (ready) {
            if (!ready || !document.contains(form)) {
                return;
            }

            state.replayingSubmit = true;
            try {
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit(submitter || undefined);
                } else {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            } finally {
                window.setTimeout(function () {
                    state.replayingSubmit = false;
                }, 0);
            }
        });
    }, true);

    function resetTurnstile() {
        if (!config.turnstileEnabled || !state.turnstileReady || state.turnstileWidget === null || !window.turnstile) {
            return;
        }
        state.turnstileToken = '';
        try {
            window.turnstile.reset(state.turnstileWidget);
        } catch (e) {
            // Keep local guard operational if Turnstile itself errors.
        }
    }

    function initTurnstile() {
        if (!config.turnstileEnabled || !config.turnstileSiteKey) {
            return;
        }

        var attempts = 0;
        var timer = window.setInterval(function () {
            attempts += 1;
            if (!window.turnstile || typeof window.turnstile.render !== 'function') {
                if (attempts > 80) {
                    window.clearInterval(timer);
                }
                return;
            }

            window.clearInterval(timer);

            var container = document.createElement('div');
            container.id = 'wdsfa-turnstile-guard';
            container.style.position = 'fixed';
            container.style.right = '12px';
            container.style.bottom = '12px';
            container.style.zIndex = '2147483000';
            document.body.appendChild(container);

            try {
                state.turnstileWidget = window.turnstile.render(container, {
                    sitekey: String(config.turnstileSiteKey),
                    appearance: 'interaction-only',
                    action: 'wds_rsvp',
                    callback: function (token) {
                        state.turnstileToken = String(token || '');
                    },
                    'expired-callback': function () {
                        state.turnstileToken = '';
                        resetTurnstile();
                    },
                    'error-callback': function () {
                        state.turnstileToken = '';
                    }
                });
                state.turnstileReady = true;
            } catch (e) {
                state.turnstileReady = false;
            }
        }, 100);
    }

    $.ajaxPrefilter(function (options, originalOptions, jqXHR) {
        var data = originalOptions && originalOptions.data ? originalOptions.data : options.data;

        if (!isProtected(data)) {
            return;
        }

        if (getPostId(data) !== parseInt(config.postId, 10)) {
            return;
        }

        // Preserve an actual honeypot value if an autofill bot filled the trap.
        if (!data.has('wdsfa_company')) {
            data.set('wdsfa_company', '');
        }

        if (ticketIsFresh()) {
            data.set('wdsfa_ticket', state.ticket);
            // A server ticket authorizes exactly one write; never reuse it locally.
            state.ticket = '';
            state.ticketIssuedAt = 0;
        } else {
            data.set('wdsfa_ticket', '');
        }

        data.set('wdsfa_js', '1');
        data.set('wdsfa_interactions', String(state.interactions));
        data.set('wdsfa_webdriver', navigator.webdriver === true ? '1' : '0');

        if (state.turnstileToken) {
            data.set('wdsfa_turnstile', state.turnstileToken);
        }

        if (jqXHR && typeof jqXHR.always === 'function') {
            jqXHR.always(function () {
                // Every write gets a fresh browser handshake and a fresh one-time ticket.
                resetSecurityMaterial();
                window.setTimeout(resetTurnstile, 150);
            });
        }
    });

    observeForms();
    fetchChallenge();
    initTurnstile();

    // Replace expired tickets/challenges even when the invitation stays open for a long time.
    window.setInterval(ensureSecurityMaterial, 60 * 1000);
})(jQuery);
