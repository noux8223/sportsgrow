/* =====================================================================
   SPORTS GROW — service worker
   정적 자산 프리캐시 + 오프라인 폴백 + 새 버전 대기/적용
   ===================================================================== */
"use strict";

var VERSION = "sportsgrow-v22";
var STATIC_CACHE = VERSION + "-static";
var OFFLINE_URL = "./offline.html";

var PRECACHE = [
  "./",
  "./index.html",
  "./login.html",
  "./student.html",
  "./coach.html",
  "./academy.html",
  "./offline.html",
  "./legal/terms.html",
  "./legal/privacy.html",
  "./legal/billing.html",
  "./accept-invite.html",
  "./reset-password.html",
  "./pick-role.html",
  "./js/env.js",
  "./js/deployment-mode.json",
  "./js/api.js",
  "./js/auth-api.js",
  "./js/public-actions.js",
  "./manifest.json",
  "./css/base.css",
  "./css/landing.css",
  "./css/login.css",
  "./css/pwa.css",
  "./css/fonts/pretendard.css",
  "./css/fonts/PretendardVariable.woff2",
  "./js/icons.js",
  "./js/site.js",
  "./js/auth-login-api.js",
  "./js/api-dashboard.js",
  "./js/api.js",
  "./js/auth-api.js",
  "./js/pwa.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

/* ---------------------------------------------------------------
   Install / activate
   --------------------------------------------------------------- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    fetch("./js/deployment-mode.json", { cache: "no-store" })
      .then(function (response) { return response.ok ? response.json() : { demoLogin: true }; })
      .catch(function () { return { demoLogin: true }; })
      .then(function (mode) {
        var assets = PRECACHE.slice();
        if (mode.demoLogin !== false) {
          assets.push("./admin-login.html", "./admin.html", "./css/admin.css", "./css/app.css", "./js/auth.js", "./js/admin.js", "./js/demo-data.js", "./js/app-shell.js", "./js/student.js", "./js/coach.js", "./js/academy.js", "./images/player-haram-game.jpg", "./images/player-haram-portrait.png");
        }
        return caches.open(STATIC_CACHE).then(function (cache) { return cache.addAll(assets); });
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== STATIC_CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

/* 새 버전 적용 요청 (사용자가 '새로고침'을 누른 경우) */
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ---------------------------------------------------------------
   Fetch strategies
   --------------------------------------------------------------- */
self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  /* Authenticated API responses must never enter either cache. */
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event, request, STATIC_CACHE));
    return;
  }

});

async function networkFirst(request) {
  try {
    var response = await fetch(request);
    if (response && response.ok) {
      var cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
      return response;
    }
    if (!response || response.status >= 500) {
      throw new Error("Network response was not ok");
    }
    return response;
  } catch (error) {
    var cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    var offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response("오프라인 상태입니다.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function staleWhileRevalidate(event, request, cacheName) {
  var cache = await caches.open(cacheName);
  var cached = await cache.match(request, { ignoreSearch: true });

  var network = fetch(request)
    .then(async function (response) {
      if (response && !response.headers.has("Set-Cookie") && (response.ok || response.type === "opaque")) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(function () {
      return null;
    });

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  var fresh = await network;
  if (fresh) return fresh;

  return new Response("", { status: 504, statusText: "Offline" });
}
