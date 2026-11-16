/* =====================================================================
   SPORTS GROW — PWA registration, install prompt, update notice
   ===================================================================== */
(function () {
  "use strict";

  var SW_PATH = "./sw.js";
  var isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  var isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  var toastEl = null;
  var toastTimer = null;

  /* ---------------------------------------------------------------
     Toast
     --------------------------------------------------------------- */
  function getToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement("div");
    toastEl.className = "pwa-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.hidden = true;
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function hideToast() {
    if (!toastEl) return;
    window.clearTimeout(toastTimer);
    toastEl.hidden = true;
    toastEl.textContent = "";
  }

  function showToast(message, actionLabel, onAction, sticky) {
    var el = getToast();
    window.clearTimeout(toastTimer);
    el.textContent = "";

    var msg = document.createElement("span");
    msg.className = "pwa-toast__msg";
    msg.textContent = message;
    el.appendChild(msg);

    if (actionLabel && onAction) {
      var action = document.createElement("button");
      action.type = "button";
      action.className = "pwa-toast__action";
      action.textContent = actionLabel;
      action.addEventListener("click", onAction);
      el.appendChild(action);
    }

    var close = document.createElement("button");
    close.type = "button";
    close.className = "pwa-toast__close";
    close.setAttribute("aria-label", "닫기");
    close.textContent = "×";
    close.addEventListener("click", hideToast);
    el.appendChild(close);

    el.hidden = false;
    if (!sticky) {
      toastTimer = window.setTimeout(hideToast, 8000);
    }
  }

  function showInstallHelp() {
    var message = isIOS
      ? "Safari 하단의 공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택하세요."
      : "브라우저 메뉴에서 '앱 설치' 또는 '홈 화면에 추가'를 선택하세요.";
    showToast(message, null, null, true);
  }

  /* ---------------------------------------------------------------
     Service worker registration + update notice
     --------------------------------------------------------------- */
  var reloading = false;

  function showUpdate(reg) {
    showToast(
      "새 버전이 준비되었습니다.",
      "새로고침",
      function () {
        if (!reg.waiting) {
          window.location.reload();
          return;
        }
        reloading = true;
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      },
      true
    );
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    var local =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (location.protocol !== "https:" && !local) return;

    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register(SW_PATH, { scope: "./" })
        .then(function (reg) {
          if (reg.waiting && navigator.serviceWorker.controller) {
            showUpdate(reg);
          }

          reg.addEventListener("updatefound", function () {
            var installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", function () {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                showUpdate(reg);
              }
            });
          });
        })
        .catch(function () {
          /* 등록 실패가 앱 사용을 막지는 않습니다. */
        });

      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (!reloading) return;
        reloading = false;
        window.location.reload();
      });
    });
  }

  /* ---------------------------------------------------------------
     Install prompt
     --------------------------------------------------------------- */
  var deferredPrompt = null;
  var installButtons = document.querySelectorAll("[data-pwa-install]");

  function showInstallButtons() {
    installButtons.forEach(function (btn) {
      btn.hidden = false;
    });
  }

  function hideInstallButtons() {
    installButtons.forEach(function (btn) {
      btn.hidden = true;
    });
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone) showInstallButtons();
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hideInstallButtons();
    showToast("Sports Grow가 홈 화면에 설치되었습니다.");
  });

  installButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!deferredPrompt) {
        showInstallHelp();
        return;
      }

      var prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();

      if (prompt.userChoice) {
        prompt.userChoice.then(function (choice) {
          if (choice && choice.outcome === "accepted") {
            hideInstallButtons();
          } else {
            showInstallButtons();
          }
        });
      }
    });
  });

  if (isIOS && !isStandalone && installButtons.length) {
    showInstallButtons();
  }

  if (isStandalone) {
    hideInstallButtons();
    document.documentElement.classList.add("is-standalone");
  }

  registerServiceWorker();
})();
