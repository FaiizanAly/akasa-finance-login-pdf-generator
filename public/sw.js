const CACHE_NAME = 'erikshaw-finance-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=2',
  '/script.js?v=2',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

// Install: cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache; skip API calls
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Always go to network for API/PDF generation calls
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request).then(function(res) {
      var clone = res.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(event.request, clone);
      });
      return res;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
