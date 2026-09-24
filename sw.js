// Service Worker, działanie offline
// Strategia: pliki aplikacji najpierw z sieci (nowa wersja wchodzi od razu), bez zasięgu z cache.
// Biblioteki z CDN (PDF, podpisy) z cache, bo się nie zmieniają, a muszą działać offline.
const CACHE = 'inwentaryzacja-rm-v32';
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
  // cache: 'reload' omija pamięć przeglądarki, żeby do nowej wersji nie trafiły stare pliki
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))).catch(err => {
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
  const zTejDomeny = new URL(event.request.url).origin === self.location.origin;
  if (!zTejDomeny) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => { try { c.put(event.request, clone); } catch (e) {} });
        return resp;
      }))
    );
    return;
  }
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(c => { try { c.put(event.request, clone); } catch (e) {} });
      return resp;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }).then(c => c || caches.match('./index.html')))
  );
});
