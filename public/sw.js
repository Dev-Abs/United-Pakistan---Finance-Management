const CACHE_NAME = 'up-finance-v1';
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/css/style.css',
  '/css/components.css',
  '/css/responsive.css',
  '/js/api.js',
  '/js/app.js',
  '/js/utils.js',
  '/js/dashboard.js',
  '/js/members.js',
  '/js/expenses.js',
  '/js/reports.js',
  '/js/settings.js',
  '/js/export.js',
  '/views/dashboard.html',
  '/views/members.html',
  '/views/expenses.html',
  '/views/reports.html',
  '/views/settings.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cache API responses for offline use
        if (event.request.url.includes('/api/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
});
