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

  /* ---------------------------------------------------------------
     Hero mock (데모 원장 → 랜딩 목업 숫자)
     --------------------------------------------------------------- */
  function formatRate(value) {
    return (Number(value) || 0).toFixed(3).replace(/^0/, "");
  }

  function rateDeltaText(values) {
    var last = values.length ? Number(values[values.length - 1]) || 0 : 0;
    var previous = values.length > 1 ? Number(values[values.length - 2]) || 0 : 0;
    var diff = last - previous;
    var sign = diff > 0.0005 ? "▲ " : diff < -0.0005 ? "▼ " : "— ";
    return sign + formatRate(Math.abs(diff));
  }

  function monthTrainingDays(player) {
    var now = new Date();
    var prefix =
      now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-";
    var seen = {};
    var list = player && Array.isArray(player.training) ? player.training : [];
    list.forEach(function (item) {
      var date = item && item.date != null ? String(item.date) : "";
      if (date.indexOf(prefix) === 0) seen[date] = true;
    });
    return Object.keys(seen).length;
  }

  function fillHeroMock() {
    var Demo = window.SportsGrowDemo;
    if (!Demo || typeof Demo.load !== "function") return;

    var player = null;
    try {
      player = Demo.player(Demo.load());
    } catch (err) {
      return;
    }
    if (!player) return;

    var avgSeries = (Demo.growthSeries(player, "avg") || {}).values || [];
    var obpSeries = (Demo.growthSeries(player, "obp") || {}).values || [];

    var avg = document.querySelector("[data-ha-avg]");
    if (avg && avgSeries.length) avg.textContent = formatRate(avgSeries[avgSeries.length - 1]);
    var avgDelta = document.querySelector("[data-ha-avg-delta]");
    if (avgDelta && avgSeries.length) avgDelta.textContent = rateDeltaText(avgSeries);

    var obp = document.querySelector("[data-ha-obp]");
    if (obp && obpSeries.length) obp.textContent = formatRate(obpSeries[obpSeries.length - 1]);
    var obpDelta = document.querySelector("[data-ha-obp-delta]");
    if (obpDelta && obpSeries.length) obpDelta.textContent = rateDeltaText(obpSeries);

    var month = document.querySelector("[data-ha-month]");
    if (month) month.textContent = monthTrainingDays(player);

    var goals = Demo.goalsFor(player) || [];
    var monthGoal = goals[1] && goals[1].title ? goals[1].title : "";
    var note = document.querySelector("[data-ha-goal-note]");
    if (note) {
      note.textContent =
        "주 " +
        Demo.WEEKLY_GOAL_DAYS +
        "회 훈련" +
        (monthGoal ? " · " + monthGoal + " 목표" : "");
    }

    var percent = Demo.goalAverage(player);
    var rate = document.querySelector("[data-ha-goal-rate]");
    if (rate) rate.textContent = percent + "%";
    var ring = document.querySelector(".ha-ring");
    if (ring) {
      ring.style.background =
        "conic-gradient(var(--green) 0 " + percent + "%, #e3e6da " + percent + "% 100%)";
    }
  }

  fillHeroMock();

  /* ---------------------------------------------------------------
     Maintenance banner (관리자 설정 → 랜딩)
     --------------------------------------------------------------- */
  function readAdminSettings() {
    try {
      var raw = window.localStorage.getItem("sportsgrow.admin.settings.v1");
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function showMaintenanceBanner() {
    var settings = readAdminSettings();
    if (!settings || settings.maintenance !== true) return;
    if (document.querySelector("[data-maintenance-banner]")) return;

    var banner = document.createElement("div");
    banner.setAttribute("data-maintenance-banner", "");
    banner.setAttribute("role", "status");
    banner.textContent = "점검 모드 · 일부 기능이 일시 중지될 수 있습니다. 현재는 데모 화면을 둘러볼 수 있습니다.";
    banner.style.cssText = [
      "background:#fff4e5",
      "color:#8a4b1e",
      "border-bottom:1px solid #f0d9bd",
      "font-size:13px",
      "font-weight:600",
      "line-height:1.5",
      "padding:9px 16px",
      "text-align:center",
      "letter-spacing:-0.01em"
    ].join(";");

    var anchor = document.getElementById("header");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(banner, anchor);
    else document.body.insertBefore(banner, document.body.firstChild);
  }

  showMaintenanceBanner();
})();
