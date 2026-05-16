// Service Worker, działanie offline
const CACHE = 'inwentaryzacja-rm-v28';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './roboto-fonts.js',
  './manifest.json',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/signature_pad@5/dist/signature_pad.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES).catch(err => {
      console.warn('Cache addAll failed:', err);
    }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached ||
      fetch(event.request).then(resp => {
        // Zapisuj w cache na przyszłość (best effort)
        const respClone = resp.clone();
        caches.open(CACHE).then(cache => {
          try { cache.put(event.request, respClone); } catch (e) {}
        });
        return resp;
      }).catch(() => cached)
    )
  );
});
