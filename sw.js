const CACHE = "tarilka-shell-v1";
const SHELL = ["./index.html", "./style.css", "./app.js", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("fetch", (e) => {
  // Запити до API завжди йдуть в мережу — кешуємо лише статичну оболонку
  if (e.request.method !== "GET" || e.request.url.includes("/analyze")) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
