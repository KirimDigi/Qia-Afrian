function escapeHtml(text) {
    if (!text) return "";
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

function getComments_SAIC(post_id, num_comments, num_get_comments, order_comments) {
    var status = jQuery("#saic-comment-status-" + post_id),
        $container_comments = jQuery("ul#saic-container-comment-" + post_id);
    
    var sheetUrl = window.RSVP_SHEET_URL || "";
    console.log("getComments_SAIC called (fetch). URL:", sheetUrl);
    if (!sheetUrl) {
        $container_comments.html('<li style="list-style:none;text-align:center;color:#888;padding:20px;">URL Spreadsheet belum dikonfigurasi.</li>').show();
        return false;
    }

    status.addClass("saic-loading").html('<span class="saico-loading"></span>').show();

    fetch(sheetUrl)
        .then(function(res) {
            if (!res.ok) throw new Error("HTTP error " + res.status);
            return res.json();
        })
        .then(function(response) {
            console.log("getComments_SAIC success response:", response);
            status.removeClass("saic-loading").html("").hide();
            if (response && response.data) {
                var commentsHtml = "";
                var sortedData = response.data;
                
                // Urutkan berdasarkan waktu kirim (DESC = terbaru di atas)
                if (order_comments === "DESC") {
                    sortedData.sort(function(a, b) {
                        return new Date(b.timestamp) - new Date(a.timestamp);
                    });
                } else {
                    sortedData.sort(function(a, b) {
                        return new Date(a.timestamp) - new Date(b.timestamp);
                    });
                }
                
                var total = sortedData.length;
                jQuery("#saic-link-" + post_id + " span").html(total);

                sortedData.forEach(function(item) {
                    var dateFormatted = "";
                    if (item.timestamp) {
                        var dt = new Date(item.timestamp);
                        if (!isNaN(dt.getTime())) {
                            var day = String(dt.getDate()).padStart(2, '0');
                            var month = String(dt.getMonth() + 1).padStart(2, '0');
                            var year = dt.getFullYear();
                            var hours = String(dt.getHours()).padStart(2, '0');
                            var minutes = String(dt.getMinutes()).padStart(2, '0');
                            dateFormatted = day + "/" + month + "/" + year + " " + hours + ":" + minutes;
                        } else {
                            dateFormatted = item.timestamp;
                        }
                    }

                    var attendanceBadge = "";
                    if (item.attendance === "present") {
                        var guestCountText = "";
                        if (item.guest) {
                            var count = parseInt(item.guest, 10);
                            if (!isNaN(count) && count > 0) {
                                guestCountText = " (" + count + " Orang)";
                            }
                        }
                        attendanceBadge = '<span class="saic-comment-badge" style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: #E8F5E9; color: #2E7D32; font-weight: 500; font-family: \'Lexend\', sans-serif; margin-left: 8px;">Hadir' + guestCountText + '</span>';
                    } else if (item.attendance === "notpresent") {
                        attendanceBadge = '<span class="saic-comment-badge" style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: #FFEBEE; color: #C62828; font-weight: 500; font-family: \'Lexend\', sans-serif; margin-left: 8px;">Tidak Hadir</span>';
                    } else {
                        attendanceBadge = '<span class="saic-comment-badge" style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: #ECEFF1; color: #37474F; font-weight: 500; font-family: \'Lexend\', sans-serif; margin-left: 8px;">Tentatif</span>';
                    }

                    commentsHtml += '<li class="saic-comment" style="list-style: none; margin-bottom: 15px; padding: 15px; background: rgba(255,255,255,0.85); border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e1dfec; text-align: left;">' +
                        '  <div class="saic-comment-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
                        '    <span class="saic-comment-author" style="font-weight: 600; color: #4A4568; font-family: \'Lexend\', sans-serif; font-size: 14px;">' + escapeHtml(item.name) + '</span>' +
                        '    ' + attendanceBadge + '' +
                        '  </div>' +
                        '  <div class="saic-comment-time" style="font-size: 11px; color: #8A85A5; margin-bottom: 8px; font-family: \'Lexend\', sans-serif;">' +
                        '    <i class="far fa-clock" style="margin-right: 4px;"></i>' + dateFormatted + '' +
                        '  </div>' +
                        '  <div class="saic-comment-text" style="font-size: 13px; color: #555555; line-height: 1.5; font-family: \'Lexend\', sans-serif; word-break: break-word;">' +
                        '    ' + escapeHtml(item.comment) + '' +
                        '  </div>' +
                        '</li>';
                });
                
                if (total === 0) {
                    commentsHtml = '<li style="list-style:none;text-align:center;color:#888;padding:20px;">Belum ada ucapan. Jadilah yang pertama!</li>';
                }
                
                $container_comments.html(commentsHtml).show();
                jPages_SAIC(post_id, WDS_RSVP.jPagesNum);
            }
        })
        .catch(function(err) {
            console.error("getComments_SAIC fetch error:", err);
            status.removeClass("saic-loading").html('<p class="saic-ajax-error">Gagal memuat ucapan</p>').show();
        });
    return false;
}

function insertComment_SAIC(post_id, num_comments) {
    var link_show_comments = jQuery("#saic-link-" + post_id),
        comment_form = jQuery("#commentform-" + post_id),
        status = jQuery("#saic-comment-status-" + post_id),
        formSubmit = jQuery("#saic-wrap-form-" + post_id),
        btnSubmit = jQuery(".saic-wrap-submit");
    
    var sheetUrl = window.RSVP_SHEET_URL || "";
    console.log("insertComment_SAIC called (fetch). URL:", sheetUrl);
    if (!sheetUrl) {
        status.html('<p class="saic-ajax-error">URL Spreadsheet belum dikonfigurasi.</p>').show();
        return false;
    }

    var author = comment_form.find("#author").val();
    var comment = comment_form.find("#saic-textarea-" + post_id).val();
    var attendance = comment_form.find("#attendance").val() || "notsure";
    var guest = comment_form.find("#guest").val() || "1";

    console.log("insertComment_SAIC data to send:", { name: author, comment: comment, attendance: attendance, guest: guest });

    btnSubmit.hide();
    status.addClass("saic-loading").html('<span class="saico-loading"></span>').show();

    var requestUrl = sheetUrl + "?action=insert" +
        "&name=" + encodeURIComponent(author) +
        "&comment=" + encodeURIComponent(comment) +
        "&attendance=" + encodeURIComponent(attendance) +
        "&guest=" + encodeURIComponent(guest);

    fetch(requestUrl)
        .then(function(res) {
            if (!res.ok) throw new Error("HTTP error " + res.status);
            return res.json();
        })
        .then(function(response) {
            console.log("insertComment_SAIC success response:", response);
            status.removeClass("saic-loading").html("");
            if (response && response.status === "success") {
                status.html('<p class="saic-ajax-success">' + WDS_RSVP.thanksComment + '</p>').show();
                
                // Kosongkan form
                comment_form.find("#author").val("");
                comment_form.find("#saic-textarea-" + post_id).val("");
                comment_form.find("#attendance").val("notsure");
                jQuery(".saic-button").removeClass("rvspSelect");
                
                // Muat ulang daftar komentar
                getComments_SAIC(post_id, num_comments, 100, "DESC");
                
                setTimeout(function() {
                    formSubmit.hide();
                    status.fadeOut(600);
                }, 2000);
            } else {
                status.html('<p class="saic-ajax-error">Gagal menyimpan ucapan.</p>').show();
                btnSubmit.show();
            }
        })
        .catch(function(err) {
            console.error("insertComment_SAIC fetch error:", err);
            status.removeClass("saic-loading").html('<p class="saic-ajax-error">Gagal terhubung ke Google Sheets.</p>').show();
            btnSubmit.show();
        });
    return false;
}

function jPages_SAIC(post_id, $numPerPage, $destroy) {
    if ("function" == typeof jQuery.fn.jPages) {
        var $idList = "saic-container-comment-" + post_id,
            $holder = "div.saic-holder-" + post_id,
            num_comments;
        jQuery("#" + $idList + " > li").length > $numPerPage && ($destroy && jQuery("#" + $idList).children().removeClass("animated jp-hidden"), jQuery($holder).show().jPages({
            containerID: $idList,
            previous: WDS_RSVP.textNavPrev,
            next: WDS_RSVP.textNavNext,
            perPage: parseInt($numPerPage, 10),
            minHeight: !1,
            keyBrowse: !0,
            direction: "forward",
            animation: "fadeIn"
        }))
    }
    return !1
}

function getUrlVars_SAIC(url) {
    for (var query, parts = url.substring(url.indexOf("?") + 1).split("&"), params = {}, i = 0; i < parts.length; i++) {
        var pair = parts[i].split("=");
        params[pair[0]] = pair[1]
    }
    return params
}

function rezizeBoxComments_SAIC(wrapper) {
    var widthWrapper;
    wrapper.outerWidth() <= 480 ? wrapper.addClass("saic-full") : wrapper.removeClass("saic-full")
}

function clog(msg) {
    console.log(msg)
}
jQuery(document).ready((function($) {
    $(".saic-wrap-comments").each((function(index, element) {
        var ids = $("[id='" + this.id + "']");
        ids.length > 1 && ids.slice(1).closest(".saic-wrapper").remove()
    })), $('.saic-container-form [name="comment_parent"], .saic-container-form [name="comment_post_ID"]').each((function(index, input) {
        $(input).removeAttr("id")
    })), "function" == typeof jQuery.fn.textareaCount && $(".saic-textarea").each((function() {
        var textCount = {
            maxCharacterSize: WDS_RSVP.textCounterNum,
            originalStyle: "saic-counter-info",
            warningStyle: "saic-counter-warn",
            warningNumber: 20,
            displayFormat: "#left"
        };
        $(this).textareaCount(textCount)
    })), "function" == typeof jQuery.fn.placeholder && $(".saic-wrap-form input, .saic-wrap-form textarea").placeholder(), "function" == typeof autosize && autosize($("textarea.saic-textarea")), $(".saic-wrapper").each((function() {
        rezizeBoxComments_SAIC($(this))
    })), $(window).resize((function() {
        $(".saic-wrapper").each((function() {
            rezizeBoxComments_SAIC($(this))
        }))
    })), $("body").on("click", "a.saic-link", (function(e) {
        e.preventDefault();
        var linkVars = getUrlVars_SAIC($(this).attr("href")),
            post_id = linkVars.post_id,
            num_comments = linkVars.comments,
            num_get_comments = linkVars.get,
            order_comments = linkVars.order;
        $("#saic-wrap-comment-" + post_id).slideToggle(200);
        var container_comment = $("#saic-container-comment-" + post_id);
        return container_comment.length && 0 === container_comment.html().length && getComments_SAIC(post_id, num_comments, num_get_comments, order_comments), !1
    })), $("a.saic-link").length && $("a.saic-link.auto-load-true").each((function() {
        $(this).click()
    })), $("input, select, textarea").focus((function() {
        $(this).removeClass("saic-error"), $(this).siblings(".saic-error-info").hide()
    })),
    // Start Edit Kode Tambahan Untuk Konfirmasi Kehadiran
        $(document).ready(function() {
            $('.saic-button').click(function() {
                var selectedValue = $(this).val();
                $('#attendance').val(selectedValue);

                if (selectedValue === 'present') {
                    // Tampilkan elemen tamu jika pilihan "present"
                    if (WDS_RSVP.guestMax == 1) {
                        $('#guest').val(1); // Jika guestMax = 1, atur nilai langsung ke 1
                    } else {
                        $('.saic-wrap-guest').show(); // Jika tidak, tampilkan elemen guest
                    }
                } else {
                    // Sembunyikan elemen tamu jika pilihan bukan "present"
                    $('.saic-wrap-guest').hide();
                }
            });

            document.querySelectorAll('.saic-button').forEach(button => {
                button.addEventListener('click', function() {
                    document.getElementById('attendance').value = this.value;
                    document.querySelectorAll('.saic-button').forEach(btn => btn.classList.remove('rvspSelect'));
                    this.classList.add('rvspSelect'); // Tambahkan kelas untuk tombol yang dipilih
                });
            });
        });
    // End Edit Kode Tambahan Untuk Konfirmasi Kehadiran
      $("body").on("submit", ".saic-container-form form", (function(e) {
        e.preventDefault(), $(this).find(":submit").attr("disabled", "disabled"), $("input, textarea").removeClass("saic-error");
        var formID, post_id = $(this).attr("id").replace("commentform-", ""),
            form = $("#commentform-" + post_id),
            link_show_comments, num_comments = $("#saic-link-" + post_id).attr("href").split("=")[2],
            form_ok = !0,
            $content;
        if (form.find("textarea").val().replace(/\s+/g, " ").length < 2) return form.find(".saic-textarea").addClass("saic-error"), form.find(".saic-error-info-text").show(), setTimeout((function() {
            form.find(".saic-error-info-text").fadeOut(500)
        }), 2500), $(this).find(":submit").removeAttr("disabled"), !1;
        if ($(this).find("input#author").length) {
            var $author = $(this).find("input#author"),
                $authorVal = $author.val().replace(/\s+/g, " "),
                $authorRegEx;
            " " != $authorVal && /^[^?%$=\/]{1,50}$/i.test($authorVal) || ($author.addClass("saic-error"), form.find(".saic-error-info-name").show(), setTimeout((function() {
                form.find(".saic-error-info-name").fadeOut(500)
            }), 3e3), form_ok = !1)
        }
        if ($(this).find("input#email").length) {
            var $emailRegEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,6}$/i,
                $email = $(this).find("input#email"),
                $emailVal = $email.val().replace(/\s+/g, "");
            $email.val($emailVal), $emailRegEx.test($emailVal) || ($email.addClass("saic-error"), form.find(".saic-error-info-email").show(), setTimeout((function() {
                form.find(".saic-error-info-email").fadeOut(500)
            }), 3e3), form_ok = !1)
        }
        if ($(this).find("select#attendance").length) {
            var $attendance = $(this).find("select#attendance"),
                $guest = $(this).find("select#guest");
            if ($attendance.length > 0) {
                var $attendanceVal = $attendance.val();
                if (null !== $attendanceVal && "" !== $attendanceVal.trim()) {
                    var $attendanceVals = $attendanceVal.replace(/\s+/g, " "),
                        $attendanceRegEx;
                    if (/^[^?&%$=\/]{1,30}$/i.test($attendanceVals) || ($attendance.addClass("saic-error"), form.find(".saic-error-info-attendance").show(), setTimeout((function() {
                            form.find(".saic-error-info-attendance").fadeOut(500)
                        }), 3e3), form_ok = !1), "present" == $attendanceVal) {
                        var $guestVal = $guest.val();
                        null != $guestVal && "" != $guestVal.trim() || ($guest.addClass("saic-error"), form.find(".saic-error-info-guest").show(), setTimeout((function() {
                            form.find(".saic-error-info-guest").fadeOut(500)
                        }), 3e3), form_ok = !1)
                    }
                } else $attendance.addClass("saic-error"), form.find(".saic-error-info-attendance").show(), setTimeout((function() {
                    form.find(".saic-error-info-attendance").fadeOut(500)
                }), 3e3), form_ok = !1
            }
        }
        return form_ok ? (!0 === form_ok && insertComment_SAIC(post_id, num_comments), $(this).find(":submit").removeAttr("disabled"), !1) : ($(this).find(":submit").removeAttr("disabled"), !1)
    }))
}));