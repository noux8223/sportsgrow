/* =====================================================================
   SPORTS GROW — auth, roles, session, shared UI
   ===================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "sportsgrow.session.v1";

  var ROLES = {
    player: {
      key: "player",
      label: "학생",
      short: "학생",
      english: "Student",
      email: "player@sportsgrow.kr",
      password: "grow1234",
      name: "김하람",
      org: "한빛중학교 야구부 · 내야수",
      page: "student.html",
      icon: "i-user",
      tone: "green",
      desc: "프로필, 훈련량, 경기·성장 기록을 직접 관리합니다."
    },
    parent: {
      key: "parent",
      label: "학부모",
      short: "학부모",
      english: "Parent",
      email: "parent@sportsgrow.kr",
      password: "grow1234",
      name: "이정은",
      org: "김하람 선수 보호자",
      page: "student.html",
      icon: "i-users",
      tone: "clay",
      desc: "선수 기록을 열람하고 응원과 코치 요청을 보냅니다."
    },
    coach: {
      key: "coach",
      label: "코치 · 감독",
      short: "코치",
      english: "Coach & Director",
      email: "coach@sportsgrow.kr",
      password: "grow1234",
      name: "박정우",
      org: "한빛중학교 야구부 · 감독",
      page: "coach.html",
      icon: "i-coach",
      tone: "blue",
      desc: "소속 선수, 목표, 피드백을 통합 관리합니다."
    },
    academy: {
      key: "academy",
      label: "아카데미 · 연맹",
      short: "아카데미·연맹",
      english: "Academy & Federation",
      email: "admin@sportsgrow.kr",
      password: "grow1234",
      name: "한빛 스포츠아카데미",
      org: "기관 관리자 · 5개 팀",
      page: "academy.html",
      icon: "i-building",
      tone: "clay",
      desc: "선수·팀 통합 관리와 기관 통계를 확인합니다."
    },
    admin: {
      key: "admin",
      label: "사이트 관리자",
      short: "관리자",
      english: "Operations",
      email: "ops@sportsgrow.kr",
      password: "grow1234",
      name: "스포츠그로우 운영팀",
      org: "사이트 운영 관리자",
      page: "admin.html",
      icon: "i-shield",
      tone: "violet",
      desc: "회원·데이터·요금과 사이트 운영을 통합 관리합니다."
    }
  };

  var ROLE_ORDER = ["player", "parent", "coach", "academy"];

  /* Pages that accept more than one role (parent reads the player dashboard). */
  var PAGE_ROLES = {
    player: ["player", "parent", "coach"],
    admin: ["admin"]
  };

  var ROLE_PAGES = {
    player: ["student.html"],
    parent: ["student.html"],
    coach: ["coach.html", "student.html"],
    academy: ["academy.html"],
    admin: ["admin.html"]
  };

  function resolveDestination(roleKey, nextPage) {
    if (!nextPage) return null;
    if (!/^[A-Za-z0-9._-]+\.html$/.test(nextPage)) return null;
    var allowed = ROLE_PAGES[roleKey] || [];
    return allowed.indexOf(nextPage) === -1 ? null : nextPage;
  }

  /* ---------------------------------------------------------------
     Storage helpers (safe for file:// and private mode)
     --------------------------------------------------------------- */
  function safeGet() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function safeSet(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function safeClear() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* noop */
    }
  }

  function getSession() {
    var session = safeGet();
    if (!session || !ROLES[session.role]) return null;
    return session;
  }

  function saveSession(roleKey) {
    var role = ROLES[roleKey];
    if (!role) return null;
    var session = {
      role: roleKey,
      email: role.email,
      name: role.name,
      org: role.org,
      loggedAt: new Date().toISOString()
    };
    safeSet(session);
    return session;
  }

  /* ---------------------------------------------------------------
     Toast
     --------------------------------------------------------------- */
  function toast(message, tone) {
    var stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }

    var el = document.createElement("div");
    el.className = "toast" + (tone === "warn" ? " toast--warn" : "");
    el.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#' +
      (tone === "warn" ? "i-info" : "i-check-circle") +
      '" /></svg><span></span>';
    el.querySelector("span").textContent = message;
    stack.appendChild(el);

    window.setTimeout(function () {
      el.classList.add("is-leaving");
      window.setTimeout(function () {
        el.remove();
      }, 240);
    }, 3200);
  }

  /* ---------------------------------------------------------------
     Session UI (topbar, sidebar)
     --------------------------------------------------------------- */
  function paintSession() {
    var session = getSession();
    if (!session) return;
    var role = ROLES[session.role];

    document.querySelectorAll("[data-user-name]").forEach(function (el) {
      el.textContent = session.name;
    });
    document.querySelectorAll("[data-user-role]").forEach(function (el) {
      el.textContent = role.label;
    });
    document.querySelectorAll("[data-user-org]").forEach(function (el) {
      el.textContent = session.org;
    });
    document.querySelectorAll("[data-user-initial]").forEach(function (el) {
      el.textContent = session.name.charAt(0);
    });
    document.querySelectorAll("[data-user-email]").forEach(function (el) {
      el.textContent = session.email;
    });
  }

  function bindLogout() {
    document.querySelectorAll("[data-logout]").forEach(function (trigger) {
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        if (window.SportsGrowAuthApi && window.SportsGrowAuthApi.enabled) {
          window.SportsGrowAuthApi.logout().catch(function () { window.location.href = "login.html"; });
          return;
        }
        safeClear();
        window.location.href = "index.html";
      });
    });
  }

  /* ---------------------------------------------------------------
     Role guards for dashboard pages
     --------------------------------------------------------------- */
  var guardState = {
    ran: false,
    allowed: true,
    painted: false,
    redirecting: false
  };

  function guard() {
    if (!document.body) return true;
    if (guardState.ran) return guardState.allowed;
    guardState.ran = true;

    if (window.SportsGrowAuthApi && window.SportsGrowAuthApi.enabled) {
      guardState.allowed = true;
      return true;
    }

    var pageRole = document.body.getAttribute("data-role");
    if (!pageRole) return guardState.allowed;

    var session = getSession();
    var allowed = PAGE_ROLES[pageRole] || [pageRole];
    if (!session || allowed.indexOf(session.role) === -1) {
      guardState.allowed = false;
      window.__sportsgrowDenied = true;

      if (!guardState.redirecting) {
        guardState.redirecting = true;
        var params = new URLSearchParams();
        if (pageRole !== "admin") params.set("role", pageRole);
        params.set("next", window.location.pathname.split("/").pop() || pageRole + ".html");
        if (session) params.set("denied", "1");
        window.location.replace(
          (pageRole === "admin" ? "admin-login.html" : "login.html") + "?" + params.toString()
        );
      }
      return false;
    }

    document.body.setAttribute("data-session-role", session.role);
    document.body.classList.add("is-" + session.role);
    guardState.painted = true;
    paintSession();
    bindLogout();
    return true;
  }

  /* ---------------------------------------------------------------
     Login page
     --------------------------------------------------------------- */
  function initLogin() {
    var form = document.getElementById("loginForm");
    if (!form) return;

    var params = new URLSearchParams(window.location.search);
    var roleButtons = Array.prototype.slice.call(document.querySelectorAll("[data-role-option]"));
    var emailInput = document.getElementById("loginEmail");
    var passwordInput = document.getElementById("loginPassword");
    var errorBox = document.getElementById("loginError");
    var demoEmail = document.getElementById("demoEmail");
    var demoPassword = document.getElementById("demoPassword");
    var demoRoleName = document.getElementById("demoRoleName");
    var submitLabel = document.getElementById("loginSubmitLabel");
    var lockedRole = form.getAttribute("data-lock-role");
    var apiMode = !!(window.SportsGrowAuthApi && window.SportsGrowAuthApi.enabled);
    if (lockedRole && !ROLES[lockedRole]) lockedRole = null;
    var requestedRole = params.get("role");
    var currentRole = lockedRole || (ROLES[requestedRole] ? requestedRole : null);
    var nextPage = params.get("next");
    var session = getSession();

    if (!currentRole && session) currentRole = session.role;
    if (!currentRole) currentRole = form.getAttribute("data-default-role") || "player";

    var deniedNotice = params.get("denied") === "1";
    var isAdminLogin = form.getAttribute("data-role") === "admin" || lockedRole === "admin";

    function showError(message) {
      if (!errorBox) return;
      var label = errorBox.querySelector("span");
      if (label) label.textContent = message;
      else errorBox.textContent = message;
      errorBox.hidden = false;
    }

    function clearError() {
      if (!errorBox) return;
      errorBox.hidden = true;
      var label = errorBox.querySelector("span");
      if (label) label.textContent = "";
    }

    function withParticle(label) {
      var last = label.trim().slice(-1);
      var code = last.charCodeAt(0);
      var batchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
      return label + (batchim ? "으로" : "로");
    }

    function selectRole(key, fill) {
      if (!ROLES[key]) key = "player";
      currentRole = key;

      roleButtons.forEach(function (btn) {
        var on = btn.getAttribute("data-role-option") === key;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });

      var role = ROLES[key];
      if (demoRoleName) demoRoleName.textContent = role.label;
      if (demoEmail) demoEmail.textContent = role.email;
      if (demoPassword) demoPassword.textContent = role.password;
      if (submitLabel) submitLabel.textContent = withParticle(role.label) + " 로그인";

      document.querySelectorAll("[data-login-role-label]").forEach(function (el) {
        el.textContent = role.label;
      });

      var hint = document.getElementById("roleHint");
      if (hint) hint.textContent = role.desc;

      var formPanel = document.querySelector(".login-form");
      if (formPanel) {
        formPanel.setAttribute("data-role", key);
        formPanel.dataset.role = key;
      }

      clearError();
      if (fill) {
        if (emailInput) emailInput.value = role.email;
        if (passwordInput) passwordInput.value = role.password;
      }
    }

    roleButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectRole(btn.getAttribute("data-role-option"), false);
      });
    });

    var fillBtn = document.getElementById("demoFill");
    if (fillBtn) {
      fillBtn.addEventListener("click", function () {
        selectRole(currentRole, true);
        toast("체험 계정 정보를 입력했습니다.");
        if (emailInput) emailInput.focus();
      });
    }

    if (apiMode) {
      var roleOptions = document.querySelector(".role-options");
      var demoBox = document.querySelector(".demo-box");
      var keepLogin = document.getElementById("keepLogin");
      var securityCopy = document.querySelector(".login-security span");
      if (roleOptions) roleOptions.hidden = true;
      if (demoBox) demoBox.hidden = true;
      if (keepLogin && keepLogin.closest("label")) keepLogin.closest("label").hidden = true;
      if (securityCopy) securityCopy.textContent = "계정과 소속 권한은 서버에서 확인합니다. 로그인 상태는 보호된 세션 쿠키로 유지됩니다.";
      if (!isAdminLogin && submitLabel) submitLabel.textContent = "계정으로 로그인";
    }

    var pwToggle = document.getElementById("passwordToggle");
    if (pwToggle) {
      pwToggle.addEventListener("click", function () {
        var show = passwordInput.type === "password";
        passwordInput.type = show ? "text" : "password";
        pwToggle.setAttribute("aria-label", show ? "비밀번호 숨기기" : "비밀번호 표시");
        pwToggle.setAttribute("aria-pressed", show ? "true" : "false");
        var use = pwToggle.querySelector("use");
        if (use) use.setAttribute("href", show ? "#i-eye-off" : "#i-eye");
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearError();

      var email = (emailInput.value || "").trim().toLowerCase();
      var password = passwordInput.value || "";
      var role = ROLES[currentRole];

      if (!email || !password) {
        showError("이메일과 비밀번호를 모두 입력해 주세요.");
        (email ? passwordInput : emailInput).focus();
        return;
      }

      if (apiMode) {
        var apiButton = form.querySelector('button[type="submit"]');
        if (apiButton) {
          apiButton.disabled = true;
          apiButton.classList.add("is-loading");
          if (submitLabel) submitLabel.textContent = "로그인 중…";
        }
        window.SportsGrowAuthApi.login(email, password, nextPage, isAdminLogin).catch(function (error) {
          showError(error.message || "로그인할 수 없습니다. 입력 정보를 확인해 주세요.");
          if (apiButton) {
            apiButton.disabled = false;
            apiButton.classList.remove("is-loading");
          }
          if (submitLabel) submitLabel.textContent = isAdminLogin ? "사이트 관리자로 로그인" : "계정으로 로그인";
        });
        return;
      }

      if (email !== role.email.toLowerCase() || password !== role.password) {
        showError("선택한 역할의 계정 정보와 일치하지 않습니다. 아래 체험 계정을 확인해 주세요.");
        passwordInput.focus();
        passwordInput.select();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.classList.add("is-loading");
        if (submitLabel) submitLabel.textContent = "로그인 중…";
      }

      saveSession(currentRole);

      var destination = resolveDestination(currentRole, nextPage) || role.page;
      window.setTimeout(function () {
        window.location.href = destination;
      }, 420);
    });

    selectRole(currentRole, false);

    if (deniedNotice) {
      showError(
        isAdminLogin
          ? "관리자 페이지는 운영자 계정으로만 접근할 수 있습니다."
          : "해당 페이지는 선택한 역할의 계정으로 로그인해야 합니다."
      );
    }

    /* session continuation */
    var continueBar = document.getElementById("sessionBar");
    if (apiMode && continueBar) continueBar.hidden = true;
    if (!apiMode && continueBar && session) {
      var role = ROLES[session.role];
      continueBar.hidden = false;
      var nameEl = continueBar.querySelector("[data-continue-name]");
      if (nameEl) nameEl.textContent = session.name + "님";
      var goBtn = continueBar.querySelector("[data-continue-go]");
      if (goBtn) {
        goBtn.addEventListener("click", function () {
          window.location.href = role.page;
        });
      }
      var outBtn = continueBar.querySelector("[data-continue-logout]");
      if (outBtn) {
        outBtn.addEventListener("click", function () {
          safeClear();
          continueBar.hidden = true;
          toast("로그아웃했습니다.");
        });
      }
    }

    var forgot = document.getElementById("forgotPassword");
    if (forgot) {
      forgot.addEventListener("click", function (event) {
        event.preventDefault();
        if (apiMode) {
          var address = (emailInput.value || "").trim().toLowerCase();
          if (!address) {
            showError("비밀번호 재설정 안내를 받을 이메일을 입력해 주세요.");
            emailInput.focus();
            return;
          }
          window.SportsGrowApi.request("/auth/password/forgot", { method: "POST", body: { email: address }, redirectOn401: false })
            .then(function () { toast("계정이 확인되면 비밀번호 재설정 안내를 보내드립니다."); })
            .catch(function (error) { showError(error.message || "요청을 처리하지 못했습니다."); });
          return;
        }
        toast("데모에서는 비밀번호 재설정을 지원하지 않습니다.", "warn");
      });
    }
  }

  /* ---------------------------------------------------------------
     Boot
     --------------------------------------------------------------- */
  function boot() {
    if (!guard()) return;
    if (!guardState.painted) {
      paintSession();
      bindLogout();
    }
    initLogin();

    if (!document.querySelector(".toast-stack")) {
      var stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
  }

  window.SportsGrow = {
    roles: ROLES,
    roleOrder: ROLE_ORDER,
    getSession: getSession,
    saveSession: saveSession,
    logout: function () {
      if (window.SportsGrowAuthApi && window.SportsGrowAuthApi.enabled) return window.SportsGrowAuthApi.logout();
      safeClear();
      window.location.href = "index.html";
    },
    toast: toast
  };

  guard();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
