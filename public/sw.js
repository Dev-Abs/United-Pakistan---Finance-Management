const CACHE_NAME = 'up-finance-v4-whatsapp-native';
const STATIC_ASSETS = [
  '/css/style.css',
  '/css/components.css',
  '/css/responsive.css',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  clients.claim();
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Never cache API calls
  if (url.includes('/api/')) {
    return;
  }

  // Styles should update immediately after deployment. Old mobile layouts were
  // being kept alive by cache-first CSS responses.
  if (url.includes('/css/') || url.includes('/js/') || url.includes('/views/')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: cache-first (fast, rarely change)
  if (STATIC_ASSETS.some(a => url.endsWith(a))) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Everything else (HTML views, JS files): network-first
  event.respondWith(
    fetch(event.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
