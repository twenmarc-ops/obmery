/* Офлайн-режим для «АКСИС · Обмеры».
   Когда есть интернет — берём свежую страницу с сайта и кладём копию в память.
   Когда интернета нет — открываем копию из памяти. */
const КЭШ = "aksis-obmery-v1";
const ФАЙЛЫ = ["./", "./index.html", "./sw.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(КЭШ).then((c) => c.addAll(ФАЙЛЫ)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ключи) =>
      Promise.all(ключи.filter((k) => k !== КЭШ).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const запрос = e.request;
  if (запрос.method !== "GET" || new URL(запрос.url).origin !== location.origin) return;

  // Сначала сеть (чтобы версия всегда была свежей), при неудаче — копия.
  // Кнопка «Обновить приложение» добавляет ?в=… — такие адреса сводим к index.html.
  const ключ = запрос.mode === "navigate" ? "./index.html" : запрос;
  e.respondWith(
    fetch(запрос)
      .then((ответ) => {
        if (ответ.ok) {
          const копия = ответ.clone();
          caches.open(КЭШ).then((c) => c.put(ключ, копия));
        }
        return ответ;
      })
      .catch(() =>
        caches.match(ключ, { ignoreSearch: true }).then(
          (r) => r || caches.match("./index.html")
        )
      )
  );
});
