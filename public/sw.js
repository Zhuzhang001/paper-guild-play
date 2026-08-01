/* 纸上百工 v6.2：仅预缓存启动壳，其余美术与声音按需缓存。 */
const VERSION = "paper-guild-v6.2.0";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scoped = (path = "") =>
  `${SCOPE_PATH}/${String(path).replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
const ROOT = scoped("");

const STARTUP_ASSETS = [
  ROOT,
  scoped("manifest.webmanifest"),
  scoped("icon.png"),
  scoped("icon-192.png"),
  scoped("fonts/LXGWWenKaiScreen-Game.woff2"),
  scoped("fonts/MaShanZheng-Game.woff2"),
  scoped("art/season-spring-runtime.webp"),
  scoped("art-v3/hero-directions-v3.webp"),
  scoped("art-v4/hero-fold-runtime-v4.webp"),
];

async function cacheDocumentShell(cache) {
  const response = await fetch(ROOT, { cache: "reload" });
  if (!response.ok) throw new Error("shell unavailable");
  await cache.put(ROOT, response.clone());
  const html = await response.text();
  const discovered = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], self.registration.scope))
    .filter(
      (url) =>
        url.origin === self.location.origin &&
        (url.pathname.includes("/_next/") ||
          url.pathname.endsWith(".css") ||
          url.pathname.endsWith(".js")),
    )
    .map((url) => url.pathname);
  await Promise.allSettled(
    [...new Set([...STARTUP_ASSETS, ...discovered])].map(async (url) => {
      const asset = await fetch(url, { cache: "reload" });
      if (asset.ok) await cache.put(url, asset);
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cacheDocumentShell));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("paper-guild-") && !key.startsWith(VERSION))
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(ROOT, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(ROOT)) || Response.error();
  }
}

async function cachedAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (
    /\.(?:js|css|woff2?|png|webp|m4a|wav|json|webmanifest)$/i.test(url.pathname)
  ) {
    event.respondWith(cachedAsset(request));
  }
});
