/* =====================================================================
   SPORTS GROW — landing interactions
   ===================================================================== */
(function () {
  "use strict";

  var header = document.getElementById("header");
  var nav = document.getElementById("nav");
  var navToggle = document.getElementById("navToggle");
  var backdrop = document.getElementById("navBackdrop");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var DESKTOP = 980;

  /* ---------------------------------------------------------------
     Header state
     --------------------------------------------------------------- */
  function updateHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* ---------------------------------------------------------------
     Mobile menu
     --------------------------------------------------------------- */
  function isMobile() {
    return window.innerWidth <= DESKTOP;
  }

  function openMenu() {
    if (!nav || !navToggle) return;
    nav.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
    navToggle.setAttribute("aria-label", "메뉴 닫기");
    document.body.classList.add("is-locked");
    if (backdrop) {
      backdrop.hidden = false;
      window.requestAnimationFrame(function () {
        backdrop.classList.add("is-open");
      });
    }
  }

  function closeMenu() {
    if (!nav || !navToggle) return;
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "메뉴 열기");
    document.body.classList.remove("is-locked");
    if (backdrop) {
      backdrop.classList.remove("is-open");
      window.setTimeout(function () {
        if (!nav.classList.contains("is-open")) backdrop.hidden = true;
      }, 300);
    }
  }

  if (navToggle) {
    navToggle.addEventListener("click", function () {
      if (nav.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
  }

  if (nav) {
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a") && isMobile()) closeMenu();
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeMenu);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav && nav.classList.contains("is-open")) {
      closeMenu();
      navToggle.focus();
    }
  });

  window.addEventListener("resize", function () {
    if (!isMobile() && nav && nav.classList.contains("is-open")) closeMenu();
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
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    revealItems.forEach(function (el, index) {
      el.style.transitionDelay = Math.min(index % 4, 3) * 55 + "ms";
      revealObserver.observe(el);
    });
  }

  /* ---------------------------------------------------------------
     Feature tabs (ARIA)
     --------------------------------------------------------------- */
  var featureTabs = Array.prototype.slice.call(document.querySelectorAll("[data-feature-tab]"));
  var featurePanels = Array.prototype.slice.call(document.querySelectorAll("[data-feature-panel]"));

  function activateFeature(tab, focus) {
    var name = tab.getAttribute("data-feature-tab");
    featureTabs.forEach(function (item) {
      var on = item === tab;
      item.classList.toggle("is-active", on);
      item.setAttribute("aria-selected", on ? "true" : "false");
      item.setAttribute("tabindex", on ? "0" : "-1");
    });
    featurePanels.forEach(function (panel) {
      var on = panel.getAttribute("data-feature-panel") === name;
      panel.hidden = !on;
      panel.classList.toggle("is-active", on);
    });
    if (focus) tab.focus();
  }

  featureTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activateFeature(tab, false);
    });
    tab.addEventListener("keydown", function (event) {
      var index = featureTabs.indexOf(tab);
      var next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = featureTabs[(index + 1) % featureTabs.length];
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = featureTabs[(index - 1 + featureTabs.length) % featureTabs.length];
      } else if (event.key === "Home") {
        next = featureTabs[0];
      } else if (event.key === "End") {
        next = featureTabs[featureTabs.length - 1];
      }
      if (next) {
        event.preventDefault();
        activateFeature(next, true);
      }
    });
  });

  /* ---------------------------------------------------------------
     Billing toggle
     --------------------------------------------------------------- */
  var billingButtons = Array.prototype.slice.call(document.querySelectorAll("[data-billing]"));
  var prices = {
    player: { monthly: "3,000", annual: "36,000", totalAnnual: "36,000", monthlyTotal: "3,000" },
    coach: { monthly: "30,000", annual: "360,000", totalAnnual: "360,000", monthlyTotal: "30,000" },
    academy: { monthly: "100,000", annual: "1,200,000", totalAnnual: "1,200,000", monthlyTotal: "100,000" }
  };

  function setBilling(mode) {
    billingButtons.forEach(function (btn) {
      var on = btn.getAttribute("data-billing") === mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    Object.keys(prices).forEach(function (key) {
      var amount = document.querySelector('[data-price="' + key + '"]');
      var unit = document.querySelector('[data-price-unit="' + key + '"]');
      var note = document.querySelector('[data-price-note="' + key + '"]');
      var data = prices[key];
      if (!amount || !unit || !note) return;
      if (mode === "annual") {
        amount.textContent = data.annual;
        unit.textContent = "원 / 년";
        note.textContent = "월 " + data.monthlyTotal + "원 × 12개월";
      } else {
        amount.textContent = data.monthly;
        unit.textContent = "원 / 월";
        note.textContent = "연간 " + data.totalAnnual + "원 · 12개월 기준";
      }
    });
  }

  billingButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setBilling(btn.getAttribute("data-billing"));
    });
  });

  /* ---------------------------------------------------------------
     Active nav links
     --------------------------------------------------------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav__link"));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href");
      return id && id.charAt(0) === "#" ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (link) {
            var active = link.getAttribute("href") === "#" + entry.target.id;
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-35% 0px -58% 0px", threshold: 0 }
    );
    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }
})();
