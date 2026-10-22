const CACHE_NAME = "tgtrain-shell-v119";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/styles.css?v=104",
  "./assets/js/app.js?v=119",
  "./assets/js/coach-plan.js?v=99",
  "./assets/js/data.js?v=70",
  "./assets/js/storage.js?v=106",
  "./assets/js/utils.js?v=73",
  "./assets/js/cloud.js?v=76",
  "./assets/js/ai.js?v=102",
  "./assets/js/progression.js?v=3",
  "./assets/js/training-plan.js?v=99",
  "./assets/js/open-tennis-sync.js?v=100",
  "./assets/js/wearable-link.js?v=70",
  "./assets/js/nutrition.js?v=95",
  "./assets/js/nutrition-presets.js?v=100",
  "./assets/js/nutrition-ui.js?v=106",
  "./assets/js/daily-insights.js?v=96",
  "./assets/js/recovery-context.js?v=100",
  "./assets/js/guided-sessions.js?v=68",
  "./assets/js/guided-ui.js?v=99",
  "./assets/js/coach-tracking.js?v=76",
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
