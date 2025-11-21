const CACHE_NAME = 'recipe-assistant-v1';
const urlsToCache = [
  '/',
  '/static/css/app.css',
  '/static/js/app.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Cache files individually to prevent one failure from blocking install
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(new Request(url, {cache: 'no-cache'}))
              .catch(err => console.log('Failed to cache:', url, err))
          )
        );
      })
      .catch(err => console.log('Cache install error:', err))
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip caching for API calls and admin routes
  if (event.request.url.includes('/detect') || 
      event.request.url.includes('/recommend') ||
      event.request.url.includes('/admin') ||
      event.request.url.includes('roboflow.com')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache as fallback
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }
          // No cache found either
          return new Response('Offline - content not available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
