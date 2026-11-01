// オフライン用サービスワーカー(キャッシュ優先+裏で更新)
const CACHE = 'kintore-v25';
const ASSETS = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // ページ本体は「ネット優先」:更新をすぐ反映。圏外ならキャッシュで起動
  if (e.request.mode === 'navigate') {
    // 電波が弱いジムでも待たされないよう、3秒で応答がなければキャッシュで起動
    const net = fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); } return r; });
    const timeout = new Promise(res => setTimeout(() => res(null), 3000));
    e.respondWith(Promise.race([net.catch(() => null), timeout]).then(async r => r || await caches.match('./index.html') || net));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(e.request, {ignoreSearch: true});
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return cached || (await net);
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true})
    .then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
