// droptok service worker — offline shell + TikTok share target.
const CACHE = "droptok-v2";
const SHARE_PATH = new URL("./share", self.location.href).pathname;
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Android hands shared links to this POST endpoint. The browser can't render a
// POST body, so rewrite it into a GET with the link in the query string.
async function handleShare(request) {
  let link = "";
  try {
    const form = await request.formData();
    const raw = [form.get("url"), form.get("text"), form.get("title")]
      .filter(Boolean)
      .join(" ");
    const match = raw.match(/https?:\/\/[^\s"'<>]+/i);
    link = match ? match[0] : "";
  } catch {
    link = "";
  }

  const target = new URL("./", self.location.href);
  if (link) target.searchParams.set("u", link);
  return Response.redirect(target.toString(), 303);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === SHARE_PATH) {
    event.respondWith(handleShare(request));
    return;
  }

  if (request.method !== "GET") return;
  // Leave the Worker API and TikTok's CDN alone entirely.
  if (url.origin !== self.location.origin) return;

  // Network first so a deploy is picked up immediately; fall back to the
  // cached shell when the network is gone.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((hit) => hit || caches.match("./index.html"))
      )
  );
});
