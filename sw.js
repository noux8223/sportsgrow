/* =====================================================================
   SPORTS GROW — service worker
   정적 자산 프리캐시 + 오프라인 폴백 + 새 버전 대기/적용
   ===================================================================== */
"use strict";

var VERSION = "sportsgrow-v13";
var STATIC_CACHE = VERSION + "-static";
var RUNTIME_CACHE = "sportsgrow-runtime-v1";
var OFFLINE_URL = "./offline.html";

var PRECACHE = [
  "./",
  "./index.html",
  "./login.html",
  "./admin-login.html",
  "./student.html",
  "./coach.html",
  "./academy.html",
  "./admin.html",
  "./offline.html",
  "./manifest.json",
  "./css/base.css",
  "./css/landing.css",
  "./css/login.css",
  "./css/app.css",
  "./css/admin.css",
  "./css/pwa.css",
  "./js/icons.js",
  "./js/site.js",
  "./js/auth.js",
  "./js/app-shell.js",
  "./js/demo-data.js",
  "./js/student.js",
  "./js/coach.js",
  "./js/academy.js",
  "./js/admin.js",
  "./js/pwa.js",
  "./images/player-haram-game.jpg",
  "./images/player-haram-portrait.png",
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
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
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
              return key !== STATIC_CACHE && key !== RUNTIME_CACHE;
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

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event, request, STATIC_CACHE));
    return;
  }

  /* Pretendard 등 외부 폰트 자산은 런타임 캐시 */
  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(staleWhileRevalidate(event, request, RUNTIME_CACHE));
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
      if (response && (response.ok || response.type === "opaque")) {
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
