(function () {
  "use strict";
  function boot() {
    var form = document.getElementById("loginForm");
    var auth = window.SportsGrowAuthApi;
    var api = window.SportsGrowApi;
    if (!form || !auth || !api || !api.enabled) return;
    var email = document.getElementById("loginEmail");
    var password = document.getElementById("loginPassword");
    var errorBox = document.getElementById("loginError");
    var label = document.getElementById("loginSubmitLabel");
    var adminOnly = form.getAttribute("data-role") === "admin" || form.getAttribute("data-lock-role") === "admin";
    var demo = document.querySelector(".demo-box");
    var roleOptions = document.querySelector(".role-options");
    var keepLogin = document.getElementById("keepLogin");
    var security = document.querySelector(".login-security span");
    var continuation = document.getElementById("sessionBar");
    if (demo) demo.remove();
    if (roleOptions) roleOptions.remove();
    if (keepLogin && keepLogin.closest("label")) keepLogin.closest("label").remove();
    if (continuation) continuation.remove();
    if (security) security.textContent = "계정과 소속 권한은 서버에서 확인합니다. 로그인 상태는 보호된 세션 쿠키로 유지됩니다.";
    if (label && !adminOnly) label.textContent = "계정으로 로그인";

    function showError(message) {
      if (!errorBox) return;
      errorBox.hidden = false;
      var target = errorBox.querySelector("span");
      if (target) target.textContent = message;
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (errorBox) errorBox.hidden = true;
      var address = (email.value || "").trim().toLowerCase();
      if (!address || !password.value) { showError("이메일과 비밀번호를 입력해 주세요."); return; }
      var submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      if (label) label.textContent = "로그인 중…";
      var next = new URLSearchParams(window.location.search).get("next");
      auth.login(address, password.value, next, adminOnly).catch(function (error) {
        showError(error.message || "로그인할 수 없습니다. 입력 정보를 확인해 주세요.");
        if (submit) submit.disabled = false;
        if (label) label.textContent = adminOnly ? "사이트 관리자로 로그인" : "계정으로 로그인";
      });
    });
    var forgot = document.getElementById("forgotPassword");
    if (forgot) forgot.addEventListener("click", function (event) {
      event.preventDefault();
      var address = (email.value || "").trim().toLowerCase();
      if (!address) { showError("비밀번호 재설정 안내를 받을 이메일을 입력해 주세요."); email.focus(); return; }
      api.request("/auth/password/forgot", { method: "POST", body: { email: address }, redirectOn401: false })
        .then(function () { showError("계정이 확인되면 비밀번호 재설정 안내를 보내드립니다."); })
        .catch(function (error) { showError(error.message || "요청을 처리하지 못했습니다."); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
