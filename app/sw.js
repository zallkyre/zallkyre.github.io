const C = "mow-v1";
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then((c) => c.addAll(["./", "index.html", "manifest.json"])));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return; // API + CDN go straight to network
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
