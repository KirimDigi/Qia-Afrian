/* Penghubung RSVP/Ucapan ke Google Spreadsheet via Apps Script (GitHub Pages).
 * Memakai window.RSVP_SHEET_URL yang diisi di index.html.
 * Script Apps Script yang didukung (milik user):
 *   GET ?action=insert&name=&comment=&attendance=&guest=  -> simpan baris [timestamp,name,comment,attendance,guest]
 *   GET (tanpa action) -> { status:"success", data:[{timestamp,name,comment,attendance,guest}] }
 * Menimpa getComments_SAIC & insertComment_SAIC bawaan WordPress (ajaxurl) agar jalan statis.
 */
(function () {
  // Styling badge kehadiran + rapikan baris nama agar tidak mepet
  (function injectSheetStyle() {
    if (document.getElementById("wds-sheet-badge-style")) return;
    var css = ".saic-wrapper ul.saic-container-comments li.saic-item-comment .saic-comment-content .saic-comment-info{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:6px 8px!important;overflow:visible!important;}" +
      ".saic-wrapper ul.saic-container-comments li.saic-item-comment .saic-comment-content .saic-comment-info .saic-commenter-name{margin-right:0!important;line-height:1.4!important;}" +
      ".saic-wrapper .saic-attendance-badge{display:inline-block!important;font-size:11px!important;font-weight:700!important;" +
      "padding:3px 10px!important;border-radius:999px!important;margin:0!important;white-space:nowrap!important;" +
      "line-height:1.5!important;vertical-align:middle!important;letter-spacing:.2px!important;}" +
      ".saic-wrapper .saic-attendance-badge.hadir{background:#e8f5ec!important;color:#1e7e3a!important;border:1px solid #bfe3cb!important;}" +
      ".saic-wrapper .saic-attendance-badge.tidak-hadir{background:#fdecec!important;color:#b33737!important;border:1px solid #f3c2c2!important;}" +
      ".saic-wrapper .saic-guest-count{font-size:11px!important;color:#8f8aa8!important;font-weight:600!important;white-space:nowrap!important;}" +
      ".saic-wrapper ul.saic-container-comments li.saic-item-comment .saic-comment-content .saic-comment-text p{margin:6px 0 2px!important;}" +
      ".elementor-325958 .elementor-element.elementor-element-9a74557 .saic-wrapper ul.saic-container-comments li.saic-item-comment .saic-comment-content .saic-comment-time{font-size:10px!important;color:#9a9a9a!important;font-family:inherit!important;font-style:italic!important;margin-top:2px!important;line-height:1.4!important;}" +
      ".saic-wrapper .saic-wrap-form .saic-container-form .saic-wrap-guest .guest-count{flex:1 1 52%!important;min-width:0!important;}" +
      ".saic-wrapper .saic-wrap-form .saic-container-form .saic-wrap-guest select#guest{flex:1 1 48%!important;min-width:0!important;" +
      "text-align:center!important;text-align-last:center!important;padding:8px 26px 8px 8px!important;" +
      "text-overflow:ellipsis!important;white-space:nowrap!important;overflow:visible!important;}" +
      ".saic-toggle-wrap{text-align:center!important;margin:4px 0 10px!important;}" +
      ".saic-toggle-btn{display:inline-block!important;background:#9e99bf!important;color:#fff!important;border:none!important;" +
      "border-radius:999px!important;padding:9px 26px!important;font-size:13px!important;font-weight:700!important;" +
      "cursor:pointer!important;font-family:inherit!important;}" +
      ".saic-toggle-btn:active{transform:scale(.97)!important;}";
    var st = document.createElement("style");
    st.id = "wds-sheet-badge-style";
    st.type = "text/css";
    st.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(st);
  })();
  function sheetURL() {
    var u = window.RSVP_SHEET_URL || "";
    return (u || "").trim();
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function badge(att, guest) {
    var t = String(att || "").toLowerCase();
    if (t === "present") {
      var g = String(guest == null || guest === "" ? "1" : guest).trim() || "1";
      return '<span class="saic-attendance-badge hadir">Hadir</span>' +
        '<span class="saic-guest-count">' + esc(g) + " orang</span>";
    }
    if (t === "notpresent") return '<span class="saic-attendance-badge tidak-hadir">Tidak Hadir</span>';
    return "";
  }
  function itemHTML(row) {
    var initial = esc((row.name || "?").trim().charAt(0).toUpperCase() || "?");
    var time = "";
    try {
      var d = new Date(row.timestamp);
      if (!isNaN(d)) time = d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) {}
    return '<li class="saic-item-comment">' +
      '<div class="saic-comment-avatar"><span class="saic-avatar-fallback">' + initial + "</span></div>" +
      '<div class="saic-comment-content"><div class="saic-comment-info">' +
      '<span class="saic-commenter-name">' + esc(row.name || "Tamu") + "</span>" + badge(row.attendance, row.guest) +
      "</div>" +
      '<div class="saic-comment-text"><p>' + esc(row.comment || "") + "</p></div>" +
      (time ? '<div class="saic-comment-time">' + esc(time) + "</div>" : "") +
      "</div></li>";
  }

  function listOpen(pid) {
    var b = jQuery("#saic-toggle-" + pid);
    return b.length ? !!b.data("open") : false;
  }
  function setToggleLabel(pid, open) {
    var b = jQuery("#saic-toggle-" + pid);
    if (!b.length) return;
    b.data("open", open);
    b.text(open ? "Sembunyikan Ucapan" : "Tampilkan Ucapan");
  }
  function setupToggle(pid) {
    try {
      var box = jQuery("ul#saic-container-comment-" + pid);
      var holder = jQuery(".saic-holder-" + pid);
      if (!jQuery("#saic-toggle-" + pid).length) {
        jQuery("#saic-wrap-form-" + pid).after(
          '<div class="saic-toggle-wrap"><button type="button" id="saic-toggle-' + pid + '" class="saic-toggle-btn">Tampilkan Ucapan</button></div>'
        );
      }
      if (!listOpen(pid)) { box.hide(); holder.hide(); }
    } catch (e) {}
  }
  jQuery(document).off("click.saicToggle").on("click.saicToggle", "[id^='saic-toggle-']", function (e) {
    e.preventDefault();
    var pid = String(this.id || "").replace("saic-toggle-", "");
    if (!pid) return;
    var box = jQuery("ul#saic-container-comment-" + pid);
    var holder = jQuery(".saic-holder-" + pid);
    if (!box.children("li").length) {
      box.data("want-show", true);
      setToggleLabel(pid, true);
      window.getComments_SAIC(pid, 1, 500, "DESC");
      return;
    }
    if (listOpen(pid)) {
      box.slideUp(200); holder.slideUp(200);
      setToggleLabel(pid, false);
    } else {
      box.slideDown(200); holder.slideDown(200);
      setToggleLabel(pid, true);
    }
  });

  window.getComments_SAIC = function (post_id, num_comments, num_get_comments, order_comments) {
    var url = sheetURL();
    var status = jQuery("#saic-comment-status-" + post_id);
    var box = jQuery("ul#saic-container-comment-" + post_id);
    if (!url) {
      status.removeClass("saic-loading").html('<p class="saic-ajax-error">RSVP_SHEET_URL belum diisi.</p>').show();
      return false;
    }
    status.addClass("saic-loading").html('<span class="saico-loading"></span>').show();
    var ctrl = null, timer = null;
    try {
      if (typeof AbortController !== "undefined") {
        ctrl = new AbortController();
        timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 15000);
      }
    } catch (e) {}
    fetch(url + (url.indexOf("?") === -1 ? "?t=" : "&t=") + Date.now(), { method: "GET", redirect: "follow", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        status.removeClass("saic-loading").html("").hide();
        var rows = (res && res.data) || [];
        // Sheet: baris lama -> baru; tampilkan terbaru dulu (DESC)
        rows = rows.slice().reverse();
        if (!rows.length) {
          box.html('<li class="saic-item-comment"><div class="saic-comment-content"><div class="saic-comment-text"><p>Belum ada ucapan.</p></div></div></li>').show();
        } else {
          box.html(rows.map(itemHTML).join("")).show();
        }
        // Pastikan wadah form ikut terlihat (bawaan awalnya display:none),
        // tapi daftar ucapan tetap tersembunyi sampai tombol diklik
        try {
          jQuery("#saic-wrap-comment-" + post_id).show();
          box.closest(".saic-wrapper").show();
        } catch (e) {}
        setupToggle(post_id);
        var showNow = listOpen(post_id) || box.data("want-show");
        box.removeData("want-show");
        if (showNow) {
          box.show();
          jQuery(".saic-holder-" + post_id).show();
          setToggleLabel(post_id, true);
        } else {
          box.hide();
          jQuery(".saic-holder-" + post_id).hide();
          setToggleLabel(post_id, false);
        }
        if (typeof jPages_SAIC === "function") jPages_SAIC(post_id, (window.WDS_RSVP && WDS_RSVP.jPagesNum) || "100");
      })
      .catch(function (err) {
        status.removeClass("saic-loading").html('<p class="saic-ajax-error">Gagal memuat ucapan. Coba lagi.</p>').show();
      })
      .then(function () { try { if (timer) clearTimeout(timer); } catch (e) {} });
    return false;
  };

  window.insertComment_SAIC = function (post_id, num_comments) {
    var url = sheetURL();
    var form = jQuery("#commentform-" + post_id);
    var status = jQuery("#saic-comment-status-" + post_id);
    var formSubmit = jQuery("#saic-wrap-form-" + post_id);
    var btnWrap = jQuery(".saic-wrap-submit");
    if (!url) {
      status.removeClass("saic-loading").html('<p class="saic-ajax-error">RSVP_SHEET_URL belum diisi.</p>').show();
      return false;
    }
    var name = String(form.find("input#author").val() || "").trim();
    var comment = String(form.find("textarea").val() || "").trim();
    var attendance = String(form.find("#attendance").val() || "notsure").trim();
    var guest = String(form.find("select#guest").val() || "1").trim();
    // Tampilkan ucapan langsung (optimistic UI) supaya tidak tergantung respon server
    var thanks = (window.WDS_RSVP && WDS_RSVP.thanksComment) || "Terimakasih atas ucapan Anda!";
    try {
      setupToggle(post_id);
      jQuery("ul#saic-container-comment-" + post_id)
        .prepend(itemHTML({ timestamp: new Date().toISOString(), name: name, comment: comment, attendance: attendance, guest: guest }))
        .show();
      jQuery(".saic-holder-" + post_id).show();
      setToggleLabel(post_id, true);
      jQuery("#saic-wrap-comment-" + post_id).show();
      if (typeof jPages_SAIC === "function") jPages_SAIC(post_id, (window.WDS_RSVP && WDS_RSVP.jPagesNum) || "100", true);
      var link = jQuery("#saic-link-" + post_id);
      if (link.find("span").length) {
        var n = parseInt(link.find("span").html(), 10);
        if (!isNaN(n)) link.find("span").html(String(n + 1));
      }
    } catch (e) {}
    status.removeClass("saic-loading").html('<p class="saic-ajax-success">' + esc(thanks) + "</p>").show();
    btnWrap.hide();
    formSubmit.hide();
    setTimeout(function () { try { status.fadeOut(600); } catch (e) {} }, 2500);
    // Kirim ke spreadsheet di latar belakang (data sudah terbukti masuk)
    var q = "?action=insert&name=" + encodeURIComponent(name) +
      "&comment=" + encodeURIComponent(comment) +
      "&attendance=" + encodeURIComponent(attendance) +
      "&guest=" + encodeURIComponent(guest) +
      "&t=" + Date.now();
    try {
      fetch(url + q, { method: "GET", redirect: "follow", cache: "no-store" })
        .then(function (r) { return r.text(); })
        .then(function (t) {
          try {
            var res = JSON.parse(t);
            if (!res || res.status !== "success") throw new Error("gagal");
          } catch (e) { /* abaikan: data umumnya tetap masuk */ }
        })
        .catch(function (err) {
          status.removeClass("saic-loading").html('<p class="saic-ajax-error">Ucapan tampil, tapi gagal tersimpan. Coba kirim ulang.</p>').show();
          formSubmit.show();
          btnWrap.show();
        });
    } catch (e) {}
    return false;
  };

  // Fallback: pastikan daftar dimuat & terlihat walau auto-load bawaan gagal (mis. display:none)
  function bootSheetComments() {
    try {
      var postIds = [];
      jQuery("ul[id^='saic-container-comment-']").each(function () {
        var id = (this.id || "").replace("saic-container-comment-", "");
        if (id) postIds.push(id);
      });
      if (!postIds.length) postIds.push("6854");
      postIds.forEach(function (pid, idx) {
        setTimeout(function () {
          setupToggle(pid);
          var box = jQuery("ul#saic-container-comment-" + pid);
          if (box.length && !box.children("li").length) {
            window.getComments_SAIC(pid, 1, 500, "DESC");
          } else if (box.length) {
            jQuery("#saic-wrap-comment-" + pid).show();
          }
        }, 800 + idx * 600);
      });
    } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(bootSheetComments, 1200); });
  } else {
    setTimeout(bootSheetComments, 1200);
  }
})();
