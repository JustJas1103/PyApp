const CACHE_NAME = 'recipe-assistant-v5';

// Essential files to cache for offline splash screen
const ESSENTIAL_CACHE = [
  '/',
  '/recipes/all',
  '/static/css/app.css',
  '/static/js/app.js',
  '/static/manifest.json',
  '/static/icon-72.png',
  '/static/icon-192.png',
  '/static/icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
];

// Install event - cache essential files for offline access
self.addEventListener('install', event => {
  console.log('Service worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching essential files for offline splash screen');
        return cache.addAll(ESSENTIAL_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Fetch event - cache-first for essential files, network-first for others
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // For root path and essential cached files, try cache first for instant offline load
  const isEssential = ESSENTIAL_CACHE.some(path => event.request.url.endsWith(path) || event.request.url.includes(path));
  
  if (isEssential || url.pathname === '/') {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached version instantly, update in background
            fetch(event.request).then(response => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
              }
            }).catch(() => {});
            return cachedResponse;
          }
          // Not in cache, fetch from network
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
            }
            return response;
          });
        })
    );
  } else {
    // Network-first for API calls and non-essential files
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache static assets
          if (response && response.status === 200 && 
              (event.request.url.includes('/static/') || 
               event.request.url.includes('bootstrap') ||
               event.request.url.includes('fonts.googleapis'))) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request);
        })
    );
  }
});

// Activate event - cleanup old caches and take control immediately
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service worker activated and claiming clients');
      return self.clients.claim();
    })
  );
});
