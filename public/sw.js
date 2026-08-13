/* 纸上百工 v6.3：安装只装订页面壳，游戏资源由实际使用请求写入缓存。 */
const VERSION = "paper-guild-v6.3.0";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scoped = (path = "") =>
  `${SCOPE_PATH}/${String(path).replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
const ROOT = scoped("");
const NAVIGATION_TIMEOUT_MS = 3200;
const INSTALL_FETCH_TIMEOUT_MS = 10_000;
const runtimeInflight = new Map();

async function fetchWithTimeout(request, timeoutMs, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheDocumentShell(cache) {
  // The live document normally populated the HTTP cache immediately before
  // registration, so the installer can reuse it instead of requesting it a
  // second time from the network.
  const response = await fetchWithTimeout(ROOT, INSTALL_FETCH_TIMEOUT_MS, {
    cache: "force-cache",
  });
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
  const shellAssets = [...new Set(discovered)].filter((url) => url !== ROOT);
  // Two small workers keep the install phase below the cold-start request
  // budget. `force-cache` reuses the page's existing HTTP responses.
  let cursor = 0;
  const cacheNext = async () => {
    while (cursor < shellAssets.length) {
      const url = shellAssets[cursor++];
      try {
        const asset = await fetchWithTimeout(url, INSTALL_FETCH_TIMEOUT_MS, {
          cache: "force-cache",
        });
        if (asset.ok) await cache.put(url, asset);
      } catch {
        // A single missing chunk must not prevent the worker from installing;
        // the runtime route will cache it when the page actually uses it.
      }
    }
  };
  await Promise.all([cacheNext(), cacheNext()]);
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
  const cached = caches.match(ROOT);
  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(ROOT, response.clone());
      return response;
    }
    return (await cached) || response;
  } catch {
    return (await cached) || Response.error();
  }
}

async function cachedAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const key = request.url;
  let pending = runtimeInflight.get(key);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })().finally(() => runtimeInflight.delete(key));
    runtimeInflight.set(key, pending);
  }
  return (await pending).clone();
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
