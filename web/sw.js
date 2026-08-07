const CACHE = "navi-vica-v14";
const LANGS = ["ar","de","es","fa","fr","hi","it","ja","ko","nl","pl","pt","sv","tr","uk","zh"];
const SHELL = ["./","index.html","styles.css","app.js","auth.js","cloud.js","sync.js","config.js","i18n.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(SHELL).then(() => Promise.allSettled(LANGS.map(l => c.add("lang/" + l + ".js"))))
  ).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = e.request.url;
  if (u.includes("overpass-api") || u.includes("nominatim") || u.includes("router.project-osrm")
      || u.includes("supabase.co") || u.includes("/auth/v1") || u.includes("/rest/v1")
      || u.includes("/api/")) return; // always live
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        if (res.ok && (u.includes("cdn.jsdelivr.net") || u.includes("unpkg.com") || u.includes("fonts.g") ||
                       u.includes("huggingface.co") || u.includes("hf.co") || u.includes("tile.openstreetmap.org"))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => e.request.mode === "navigate" ? caches.match("index.html") : Response.error())
    )
  );
});
