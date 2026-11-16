/* =====================================================================
   SPORTS GROW — dashboard shell interactions
   ===================================================================== */
(function () {
  "use strict";

  var sidebar = document.getElementById("sidebar");
  var menuBtn = document.getElementById("sidebarToggle");
  var closeBtn = document.getElementById("sidebarClose");
  var backdrop = document.getElementById("sidebarBackdrop");
  var DESKTOP = 1024;
  var lastFocus = null;

  /* ---------------------------------------------------------------
     Sidebar drawer
     --------------------------------------------------------------- */
  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("is-open");
    if (backdrop) {
      backdrop.hidden = false;
      window.requestAnimationFrame(function () {
        backdrop.classList.add("is-open");
      });
    }
    document.body.classList.add("is-locked");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
    if (closeBtn) closeBtn.focus();
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("is-open");
    if (backdrop) {
      backdrop.classList.remove("is-open");
      window.setTimeout(function () {
        if (!sidebar.classList.contains("is-open")) backdrop.hidden = true;
      }, 300);
    }
    document.body.classList.remove("is-locked");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }

  if (menuBtn) menuBtn.addEventListener("click", openSidebar);
  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
  if (backdrop) backdrop.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (sidebar && sidebar.classList.contains("is-open")) closeSidebar();
      closeModal(document.querySelector(".modal:not([hidden])"));
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > DESKTOP && sidebar && sidebar.classList.contains("is-open")) {
      closeSidebar();
    }
  });

  if (sidebar) {
    sidebar.addEventListener("click", function (event) {
      if (event.target.closest("a[href^='#']") && window.innerWidth <= DESKTOP) {
        closeSidebar();
      }
    });
  }

  /* ---------------------------------------------------------------
     Today label
     --------------------------------------------------------------- */
  var todayNodes = document.querySelectorAll("[data-today]");
  if (todayNodes.length) {
    var now = new Date();
    var days = ["일", "월", "화", "수", "목", "금", "토"];
    var label =
      now.getFullYear() +
      "." +
      String(now.getMonth() + 1).padStart(2, "0") +
      "." +
      String(now.getDate()).padStart(2, "0") +
      " (" +
      days[now.getDay()] +
      ")";
    todayNodes.forEach(function (node) {
      node.textContent = label;
    });
  }

  var dateInputs = document.querySelectorAll("input[type='date'][data-default-today]");
  if (dateInputs.length) {
    var iso =
      new Date().getFullYear() +
      "-" +
      String(new Date().getMonth() + 1).padStart(2, "0") +
      "-" +
      String(new Date().getDate()).padStart(2, "0");
    dateInputs.forEach(function (input) {
      if (!input.value) input.value = iso;
    });
  }

  /* ---------------------------------------------------------------
     Dashboard view router
     Left navigation switches the visible dashboard view instead of
     scrolling through one long page. Admin pages use their own router
     (data-admin-panel) and are skipped here.
     --------------------------------------------------------------- */
  var viewRouter = (function () {
    var main = document.getElementById("main");
    if (!main || document.querySelector("[data-admin-panel]")) return null;

    var views = Array.prototype.slice.call(main.children).filter(function (el) {
      return el.nodeType === 1 && el.classList.contains("dash-section");
    });
    if (!views.length) return null;

    var NAV_SELECTOR = ".sidebar__nav a[href^='#'], .mobile-tabbar a[href^='#']";
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(NAV_SELECTOR));
    var labels = {};
    var crumb = document.querySelector("[data-view-crumb]");
    var current = null;

    navLinks.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      if (!id || labels[id]) return;
      var clone = link.cloneNode(true);
      Array.prototype.slice.call(clone.querySelectorAll("em")).forEach(function (badge) {
        badge.parentNode.removeChild(badge);
      });
      var text = clone.textContent.replace(/\s+/g, " ").trim();
      if (text) labels[id] = text;
    });

    main.classList.add("is-view-mode");

    function viewFor(id) {
      var el = id ? document.getElementById(id) : null;
      while (el && el !== main) {
        if (el.parentNode === main && el.classList.contains("dash-section")) return el;
        el = el.parentNode;
      }
      return null;
    }

    function labelFor(view) {
      if (labels[view.id]) return labels[view.id];
      var heading = view.querySelector(".section-label h2, .page-head h1, h1, h2");
      if (heading) return heading.textContent.replace(/\s+/g, " ").trim();
      return view.id;
    }

    function activate(view, options) {
      var changed = current !== view;

      views.forEach(function (section) {
        section.hidden = section !== view;
      });
      current = view;

      navLinks.forEach(function (link) {
        var on = link.getAttribute("href") === "#" + view.id;
        link.classList.toggle("is-active", on);
        if (on) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });

      if (crumb) crumb.textContent = labelFor(view);

      if (options.history !== false) {
        try {
          window.history.replaceState(null, "", "#" + view.id);
        } catch (err) {
          window.location.hash = view.id;
        }
      }

      if (changed && !options.keepScroll) {
        window.scrollTo(0, 0);
      }

      return changed;
    }

    function showView(name, options) {
      options = options || {};
      var id = String(name == null ? "" : name).replace(/^#/, "");
      var target = id ? document.getElementById(id) : null;
      var view = target ? viewFor(target.id) : null;
      if (view && view.hasAttribute("data-parent-only") && !document.body.classList.contains("is-parent")) {
        view = null;
        target = null;
      }
      if (!view) view = views[0];

      var nested = !!target && target !== view;
      var changed = activate(view, {
        history: options.history,
        keepScroll: options.keepScroll || nested
      });

      if (nested && (changed || options.alwaysScroll)) {
        window.requestAnimationFrame(function () {
          target.scrollIntoView({
            behavior: options.instant ? "auto" : "smooth",
            block: "start"
          });
        });
      } else if (!changed && !options.keepScroll && options.alwaysScroll) {
        window.scrollTo(0, 0);
      }

      return changed;
    }

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      var link = event.target.closest("a[href^='#']");
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href || href === "#") return;

      var id = href.slice(1);
      if (!viewFor(id)) return;

      event.preventDefault();
      showView(id, { alwaysScroll: true });
    });

    window.addEventListener("hashchange", function () {
      showView(window.location.hash.replace(/^#/, ""), { history: false });
    });

    var initial = window.location.hash.replace(/^#/, "");
    showView(initial || views[0].id, { history: false });

    return {
      showView: showView
    };
  })();

  /* ---------------------------------------------------------------
     Modal helpers
     --------------------------------------------------------------- */
  function openModal(target) {
    var modal = typeof target === "string" ? document.getElementById(target) : target;
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("is-locked");
    var focusTarget = modal.querySelector("[autofocus], input, select, textarea, button");
    if (focusTarget) {
      window.setTimeout(function () {
        focusTarget.focus();
      }, 30);
    }
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("is-locked");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  document.addEventListener("click", function (event) {
    var opener = event.target.closest("[data-modal-open]");
    if (opener) {
      event.preventDefault();
      openModal(opener.getAttribute("data-modal-open"));
      return;
    }
    var closer = event.target.closest("[data-modal-close]");
    if (closer) {
      event.preventDefault();
      closeModal(closer.closest(".modal"));
      return;
    }
    if (event.target.classList.contains("modal__backdrop")) {
      closeModal(event.target.closest(".modal"));
    }
  });

  /* ---------------------------------------------------------------
     Generic tabs
     --------------------------------------------------------------- */
  document.querySelectorAll("[data-tab-group]").forEach(function (group) {
    var buttons = Array.prototype.slice.call(group.querySelectorAll("[data-tab]"));
    var panels = Array.prototype.slice.call(group.querySelectorAll("[data-tab-panel]"));
    if (!buttons.length) return;

    function activate(btn) {
      var key = btn.getAttribute("data-tab");
      buttons.forEach(function (item) {
        var on = item === btn;
        item.classList.toggle("is-active", on);
        item.setAttribute("aria-selected", on ? "true" : "false");
        item.setAttribute("tabindex", on ? "0" : "-1");
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-tab-panel") !== key;
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        activate(btn);
      });
      btn.addEventListener("keydown", function (event) {
        var index = buttons.indexOf(btn);
        var next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          next = buttons[(index + 1) % buttons.length];
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          next = buttons[(index - 1 + buttons.length) % buttons.length];
        }
        if (next) {
          event.preventDefault();
          activate(next);
          next.focus();
        }
      });
    });
  });

  /* ---------------------------------------------------------------
     Storage helpers
     --------------------------------------------------------------- */
  function readStore(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  /* focus trap for open modals */
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    var modal = document.querySelector(".modal:not([hidden]) .modal__dialog");
    if (!modal) return;
    var focusable = Array.prototype.slice.call(
      modal.querySelectorAll(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.AppShell = {
    openModal: openModal,
    closeModal: function (id) {
      closeModal(document.getElementById(id));
    },
    showView: function (name, options) {
      if (viewRouter) return viewRouter.showView(name, options);
    },
    readStore: readStore,
    writeStore: writeStore,
    toast: function (message, tone) {
      if (window.SportsGrow && window.SportsGrow.toast) window.SportsGrow.toast(message, tone);
    }
  };
})();
