/* 题集 QuestionHub Service Worker
 * App Shell 缓存：离线时应用壳与题库清单可继续使用，题库数据按需运行时缓存。
 * 策略：导航请求网络优先 + 缓存回退；静态资源 stale-while-revalidate。
 */
const CACHE_NAME = "questionhub-v3";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/data/banks/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // 逐个写入：单个资源 404/失败不导致整体安装失败（addAll 任一失败会整体 reject）
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((url) => cache.add(url).catch(() => undefined)),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先，离线时回退到同 URL 缓存，再回退到缓存的首页（App Shell）
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  // 静态资源与题库数据：stale-while-revalidate（题库 JSON 首次访问后即离线可用）
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
