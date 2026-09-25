const CACHE_NAME = "tgtrain-shell-v83";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/styles.css?v=83",
  "./assets/js/app.js?v=83",
  "./assets/js/coach-plan.js?v=63",
  "./assets/js/data.js?v=67",
  "./assets/js/storage.js?v=80",
  "./assets/js/utils.js?v=67",
  "./assets/js/cloud.js?v=74",
  "./assets/js/ai.js?v=81",
  "./assets/js/training-plan.js?v=69",
  "./assets/js/wearable-link.js?v=67",
  "./assets/js/nutrition.js?v=80",
  "./assets/js/nutrition-presets.js?v=78",
  "./assets/js/nutrition-ui.js?v=80",
  "./assets/js/guided-sessions.js?v=68",
  "./assets/js/guided-ui.js?v=72",
  "./assets/js/coach-tracking.js?v=72",
  "./assets/js/training-metrics.js?v=63",
  "./assets/js/firebase-config.js?v=35",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png?v=36",
  "./assets/brand/tgtrain-mark-160.png?v=36"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
      self.clients.claim()
    ])
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // No guardes el instalador en la caché de la PWA: es grande y debe descargarse actualizado.
  if (url.pathname.endsWith(".apk")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("./index.html")))
    );
    return;
  }

  const network = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });
  event.waitUntil(network.catch(() => undefined));
  event.respondWith(caches.match(request).then(cached => cached || network));
});
