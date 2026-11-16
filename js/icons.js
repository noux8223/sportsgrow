/* =====================================================================
   SPORTS GROW — inline SVG icon sprite
   ===================================================================== */
(function () {
  "use strict";

  var sprite = [
    '<svg class="icon-sprite" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">',
    '<defs>',
    '<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4"/><path d="M5.2 19.4c.7-3.5 3.3-5.4 6.8-5.4s6.1 1.9 6.8 5.4"/></symbol>',
    '<symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.4 18.8c.6-3.2 2.8-4.9 5.6-4.9s5 1.7 5.6 4.9"/><circle cx="17.2" cy="9.4" r="2.3"/><path d="M15.6 14.3c2.6-.2 4.4 1.3 5 3.9"/></symbol>',
    '<symbol id="i-coach" viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="15" height="16" rx="2.2"/><path d="M9 4.7V3.2h6v1.5M8.5 9h7M8.5 12.6h7M8.5 16.2h4.2"/></symbol>',
    '<symbol id="i-building" viewBox="0 0 24 24"><path d="M4 20.5V5.5L13 3v17.5M13 8.5h7v12M2.5 20.5h19"/><path d="M7 8h2.5M7 11.5h2.5M7 15h2.5M16 12h1.5M16 15.5h1.5"/></symbol>',
    '<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/></symbol>',
    '<symbol id="i-arrow-up-right" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></symbol>',
    '<symbol id="i-check" viewBox="0 0 24 24"><path d="m4.5 12.5 4.7 4.7L19.5 6.8"/></symbol>',
    '<symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="m8.2 12.2 2.5 2.5 5.1-5.4"/></symbol>',
    '<symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="10.5" rx="2.2"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10M12 14v2.6"/></symbol>',
    '<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.8 12S6.3 5.9 12 5.9 21.2 12 21.2 12 17.7 18.1 12 18.1 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.9"/></symbol>',
    '<symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M2.8 12S6.3 5.9 12 5.9c1.6 0 3 .4 4.2 1M21.2 12s-1.2 2.1-3.5 3.6M12 18.1c-5.7 0-9.2-6.1-9.2-6.1"/><circle cx="12" cy="12" r="2.9"/><path d="m4.5 4.5 15 15"/></symbol>',
    '<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V4M4 20h17"/><path d="m7.5 15.8 3.7-4.7 3.1 2.8L20 7"/><circle cx="20" cy="7" r="1.2"/></symbol>',
    '<symbol id="i-bars" viewBox="0 0 24 24"><path d="M4 20h17M6.5 20v-6M11 20V8.5M15.5 20v-9M20 20V5"/></symbol>',
    '<symbol id="i-activity" viewBox="0 0 24 24"><path d="M3 12h3.2l2.3-5.4 3.3 11 2.4-6.3 1.7 3.2H21"/></symbol>',
    '<symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.4" y="5" width="17.2" height="15" rx="2.2"/><path d="M3.4 9.6h17.2M8 3v4M16 3v4"/><path d="M7.5 13.2h2M12 13.2h2M16.5 13.2h.5M7.5 16.6h2M12 16.6h2"/></symbol>',
    '<symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1"/></symbol>',
    '<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>',
    '<symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></symbol>',
    '<symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 9.5a6 6 0 0 0-12 0c0 4-1.6 5.5-2.2 6.4h16.4c-.6-.9-2.2-2.4-2.2-6.4Z"/><path d="M9.7 19.2a2.5 2.5 0 0 0 4.6 0"/></symbol>',
    '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M3.5 7h17M3.5 12h17M3.5 17h11"/></symbol>',
    '<symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>',
    '<symbol id="i-logout" viewBox="0 0 24 24"><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M9.5 8 5.5 12l4 4M5.5 12H15"/></symbol>',
    '<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3.5v11M7.8 10.3 12 14.5l4.2-4.2M4.5 19h15"/></symbol>',
    '<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0-3-3L5.2 17 4 20Z"/><path d="m13.8 7.4 2.8 2.8"/></symbol>',
    '<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.4V12l3.2 2"/></symbol>',
    '<symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 21c3.9 0 6.5-2.6 6.5-6.3 0-4.4-4.3-6-4-11.4-3.4 1.3-5 4-5 6.6 0 1.3.4 2.2.4 2.2S8.3 10.7 7 9.3c-.9 1.4-1.5 3-1.5 5.1C5.5 18.4 8.1 21 12 21Z"/><path d="M12 21c1.8 0 3-1.3 3-3.1 0-2.2-2-3-2-5.1-1.6.9-2.4 2.2-2.4 3.4 0 .7.3 1.1.3 1.1s-.8-.4-1.4-1.1c-.4.6-.5 1.3-.5 1.9 0 1.7 1.2 2.9 3 2.9Z"/></symbol>',
    '<symbol id="i-trophy" viewBox="0 0 24 24"><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z"/><path d="M8 5.5H4.8v1.7A3.3 3.3 0 0 0 8 10.5M16 5.5h3.2v1.7a3.3 3.3 0 0 1-3.2 3.3M12 12.5V17M8.5 20h7M10 17h4"/></symbol>',
    '<symbol id="i-trend" viewBox="0 0 24 24"><path d="M3.5 17.5 9 12l3.3 3.2 7.7-7.7"/><path d="M15.5 7.5H20V12"/></symbol>',
    '<symbol id="i-filter" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></symbol>',
    '<symbol id="i-chevron" viewBox="0 0 24 24"><path d="m6 9.5 6 6 6-6"/></symbol>',
    '<symbol id="i-home" viewBox="0 0 24 24"><path d="m3.5 10.5 8.5-7 8.5 7V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-9.5Z"/><path d="M9.5 21v-6h5v6"/></symbol>',
    '<symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 0 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.4v.2a1.9 1.9 0 0 1-3.8 0v-.2a1.6 1.6 0 0 0-1-1.4 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 0 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.4-1H3.7a1.9 1.9 0 0 1 0-3.8h.2a1.6 1.6 0 0 0 1.4-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 0 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.4V3.7a1.9 1.9 0 0 1 3.8 0v.2a1.6 1.6 0 0 0 1 1.4 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 0 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.4 1h.2a1.9 1.9 0 0 1 0 3.8h-.2a1.6 1.6 0 0 0-1.4 1Z"/></symbol>',
    '<symbol id="i-note" viewBox="0 0 24 24"><path d="M5 4.5h14v12.2l-2.8 2.8H5V4.5Z"/><path d="M16.2 19.5v-2.8h2.8M8.5 9h7M8.5 12.5h5"/></symbol>',
    '<symbol id="i-shield" viewBox="0 0 24 24"><path d="m12 3 7 2.7v5.2c0 4.5-3 7.8-7 9.1-4-1.3-7-4.6-7-9.1V5.7L12 3Z"/><path d="m8.9 11.7 2.1 2.1 4.1-4.3"/></symbol>',
    '<symbol id="i-ball" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M5.7 6.6c3.7 3.1 3.7 7.7 0 10.8M18.3 6.6c-3.7 3.1-3.7 7.7 0 10.8M4 10.2h1.7M4 13.8h1.7M18.3 10.2H20M18.3 13.8H20"/></symbol>',
    '<symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 3.5 8.5 4.3L12 12.1 3.5 7.8 12 3.5Z"/><path d="m3.5 12 8.5 4.3 8.5-4.3M3.5 16.2l8.5 4.3 8.5-4.3"/></symbol>',
    '<symbol id="i-file" viewBox="0 0 24 24"><path d="M6 3.5h8l4.5 4.5v12.5H6V3.5Z"/><path d="M14 3.5V8h4.5M9 12h6M9 15.5h6"/></symbol>',
    '<symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 7h7M15 7h5M4 17h4M12 17h8"/><circle cx="13" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></symbol>',
    '<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4.5 6.5h15M9 6.5V4h6v2.5M6.5 6.5l.8 13a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-13"/><path d="M10 10.5v6M14 10.5v6"/></symbol>',
    '<symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5.2" width="18" height="13.6" rx="2.2"/><path d="m4 7 8 6 8-6"/></symbol>',
    '<symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="15.5" r="4.2"/><path d="m11 12.5 8.2-8.2M16.5 7.2l2 2M14.3 9.4l2 2"/></symbol>',
    '<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4M12 7.7v.6"/></symbol>',
    '<symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13l-5.6-2 5.6-2L12 3.5Z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/></symbol>',
    '<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/></symbol>',
    '<symbol id="i-send" viewBox="0 0 24 24"><path d="m3.8 12 16.4-7.4-5 16.2-3.5-6.3-7.9-2.5Z"/><path d="m11.7 14.5 4.5-4.5"/></symbol>',
    '<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s6.4-5.6 6.4-10.4A6.4 6.4 0 0 0 5.6 10.6C5.6 15.4 12 21 12 21Z"/><circle cx="12" cy="10.4" r="2.4"/></symbol>',
    '<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.3 2.4 3.5 5.4 3.5 8.6s-1.2 6.2-3.5 8.6c-2.3-2.4-3.5-5.4-3.5-8.6S9.7 5.8 12 3.4Z"/></symbol>',
    '<symbol id="i-whistle" viewBox="0 0 24 24"><path d="M13.5 7h6.5v4.2a6 6 0 1 1-6-4.2Z"/><path d="M3.5 9.2h7M3.5 12.6h4M11 15.3h.1"/></symbol>',
    '<symbol id="i-play" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M10 8.6 15.4 12 10 15.4V8.6Z"/></symbol>',
    '<symbol id="i-camera" viewBox="0 0 24 24"><path d="M9 6.4 10.3 4h3.4l1.3 2.4h3.4A1.6 1.6 0 0 1 20 8v10a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18V8a1.6 1.6 0 0 1 1.6-1.6H9Z"/><circle cx="12" cy="12.6" r="3.3"/></symbol>',
    '<symbol id="i-star" viewBox="0 0 24 24"><path d="m12 4 2.3 4.9 5.2.7-3.8 3.7 1 5.2-4.7-2.6-4.7 2.6 1-5.2L4.5 9.6l5.2-.7L12 4Z"/></symbol>',
    '<symbol id="i-more" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/></symbol>',
    '<symbol id="i-smartphone" viewBox="0 0 24 24"><rect x="6.5" y="2.8" width="11" height="18.4" rx="2.4"/><path d="M10.5 18.6h3"/></symbol>',
    '</defs>',
    '</svg>'
  ].join("");

  function mount() {
    if (document.querySelector(".icon-sprite")) return;
    var holder = document.createElement("div");
    holder.innerHTML = sprite;
    document.body.insertBefore(holder.firstChild, document.body.firstChild);
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  }
})();
