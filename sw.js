/* Офлайн-режим для «АКСИС · Обмеры».
   Есть быстрый интернет — берём свежую страницу с сайта и кладём копию в память.
   Интернета нет или он еле живой — через 3 секунды открываем копию из памяти,
   а не ждём сеть до бесконечности. */
const КЭШ = "aksis-obmery-v3";
const ФАЙЛЫ = ["./", "./index.html", "./podlozhka.html", "./pamyat.html"];
const ЖДАТЬ_СЕТЬ = 3000;

self.addEventListener("install", (e) => {
  // по одному: если какого-то файла нет, остальные всё равно лягут в память
  e.waitUntil(caches.open(КЭШ).then((c) =>
    Promise.all(ФАЙЛЫ.map((f) => c.add(f).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ключи) =>
      Promise.all(ключи.filter((k) => k !== КЭШ).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function ключЗапроса(url) {
  // Кнопка «Обновить приложение» добавляет ?в=… — такие адреса сводим к странице без «?…»;
  // корень сайта = index.html
  const адрес = new URL(url);
  адрес.search = "";
  if (адрес.pathname.endsWith("/")) адрес.pathname += "index.html";
  return адрес.href;
}

self.addEventListener("fetch", (e) => {
  const запрос = e.request;
  if (запрос.method !== "GET" || new URL(запрос.url).origin !== location.origin) return;
  const ключ = ключЗапроса(запрос.url);

  e.respondWith((async () => {
    const кэш = await caches.open(КЭШ);
    const копия = await кэш.match(ключ, { ignoreSearch: true });
    // cache:"no-cache" — сверяться с сайтом, иначе браузер до 10 минут
    // показывает старую версию после обновления
    const сеть = fetch(запрос.url, { cache: "no-cache", credentials: "same-origin" })
      // ждём файл целиком: при слабой сети заголовок приходит быстро,
      // а сама страница (~1 МБ) тянулась бы минуту
      .then(async (ответ) => {
        if (!ответ.ok) return ответ;
        const тело = await ответ.blob();
        const целый = new Response(тело, { status: ответ.status, headers: ответ.headers });
        await кэш.put(ключ, целый.clone());
        return целый;
      });
    if (!копия) {
      // копии ещё нет — ждём сеть сколько потребуется
      return сеть.catch(() => кэш.match("./index.html"));
    }
    // копия есть — сеть не дольше 3 секунд; не успела — открываем копию,
    // а свежая версия всё равно доедет в память и откроется в следующий раз
    e.waitUntil(сеть.catch(() => {}));
    const таймер = new Promise((r) => setTimeout(() => r(null), ЖДАТЬ_СЕТЬ));
    const ответ = await Promise.race([сеть.catch(() => null), таймер]);
    return ответ && ответ.ok ? ответ : копия;
  })());
});
