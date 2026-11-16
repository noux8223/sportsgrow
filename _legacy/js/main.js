/* =====================================================================
   BASEBALL GROW — interactions
   ===================================================================== */
(function () {
  "use strict";

  var header = document.getElementById("header");
  var nav = document.getElementById("nav");
  var navToggle = document.getElementById("navToggle");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function isMobileNav() {
    return window.matchMedia("(max-width: 980px)").matches;
  }

  /* ---------------------------------------------------------------
     Header state
     --------------------------------------------------------------- */
  function updateHeader() {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* ---------------------------------------------------------------
     Mobile menu
     --------------------------------------------------------------- */
  function openMenu() {
    nav.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
    navToggle.setAttribute("aria-label", "메뉴 닫기");
    document.body.classList.add("menu-open");
  }

  function closeMenu() {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "메뉴 열기");
    document.body.classList.remove("menu-open");
  }

  navToggle.addEventListener("click", function () {
    if (nav.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a") && isMobileNav()) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      closeMenu();
      navToggle.focus();
    }
  });

  document.addEventListener("click", function (event) {
    if (!nav.classList.contains("is-open")) return;
    if (nav.contains(event.target) || navToggle.contains(event.target)) return;
    closeMenu();
  });

  window.addEventListener("resize", function () {
    if (!isMobileNav() && nav.classList.contains("is-open")) {
      closeMenu();
    }
  });

  /* ---------------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------------- */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));

  if (!("IntersectionObserver" in window) || reduceMotion.matches) {
    revealItems.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var groups = new Map();

    revealItems.forEach(function (el) {
      var parent = el.parentElement;
      var list = groups.get(parent) || [];
      list.push(el);
      groups.set(parent, list);
    });

    groups.forEach(function (list) {
      list.forEach(function (el, index) {
        el.style.transitionDelay = Math.min(index, 4) * 65 + "ms";
      });
    });

    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );

    revealItems.forEach(function (el) {
      revealObserver.observe(el);
    });

    window.addEventListener("load", function () {
      window.setTimeout(function () {
        revealItems.forEach(function (el) {
          if (el.classList.contains("is-visible")) return;
          var rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add("is-visible");
          }
        });
      }, 1600);
    });
  }

  /* ---------------------------------------------------------------
     Preview tabs
     --------------------------------------------------------------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".preview__tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".preview__panel"));
  var screenPath = document.getElementById("screenPath");
  var paths = {
    "tab-profile": "baseballgrow.app/player/haram",
    "tab-training": "baseballgrow.app/player/haram/training",
    "tab-game": "baseballgrow.app/player/haram/games",
    "tab-report": "baseballgrow.app/player/haram/report"
  };

  function activateTab(tab, moveFocus) {
    tabs.forEach(function (item) {
      var selected = item === tab;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", selected ? "true" : "false");
      item.setAttribute("tabindex", selected ? "0" : "-1");
    });

    panels.forEach(function (panel) {
      var selected = panel.getAttribute("aria-labelledby") === tab.id;
      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    });

    if (screenPath && paths[tab.id]) {
      screenPath.textContent = paths[tab.id];
    }

    if (moveFocus) {
      tab.focus();
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activateTab(tab, false);
    });

    tab.addEventListener("keydown", function (event) {
      var index = tabs.indexOf(tab);
      var next = null;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = tabs[(index + 1) % tabs.length];
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = tabs[(index - 1 + tabs.length) % tabs.length];
      } else if (event.key === "Home") {
        next = tabs[0];
      } else if (event.key === "End") {
        next = tabs[tabs.length - 1];
      }

      if (next) {
        event.preventDefault();
        activateTab(next, true);
      }
    });
  });

  if (tabs.length) {
    activateTab(document.querySelector(".preview__tab.is-active") || tabs[0], false);
  }

  /* ---------------------------------------------------------------
     Active navigation
     --------------------------------------------------------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav__link"));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href");
      return id && id.charAt(0) === "#" ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  function setActive(id) {
    navLinks.forEach(function (link) {
      var active = link.getAttribute("href") === "#" + id;
      link.classList.toggle("is-active", active);
      if (active) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  if (sections.length && "IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      { rootMargin: "-38% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });

    window.addEventListener(
      "scroll",
      function () {
        if (window.scrollY < 200) {
          navLinks.forEach(function (link) {
            link.classList.remove("is-active");
            link.removeAttribute("aria-current");
          });
        }
      },
      { passive: true }
    );
  }

  /* ---------------------------------------------------------------
     Smooth anchors with fixed-header offset
     --------------------------------------------------------------- */
  document.addEventListener("click", function (event) {
    var link = event.target.closest('a[href^="#"]');
    if (!link) return;

    var targetId = link.getAttribute("href");
    if (!targetId || targetId === "#") return;

    if (targetId === "#top") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
      history.replaceState(null, "", targetId);
      return;
    }

    var target = document.querySelector(targetId);
    if (!target) return;

    event.preventDefault();
    var offset = isMobileNav() ? 76 : 88;
    var top = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({ top: top, behavior: reduceMotion.matches ? "auto" : "smooth" });
    history.replaceState(null, "", targetId);
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
})();
