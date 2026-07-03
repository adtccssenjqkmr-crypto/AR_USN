const CACHE_NAME = 'usn-ar-cache-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './app_icon.png'
];

// Install Event - Pre-cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching App Shell Assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve cached assets when offline (Cache First)
self.addEventListener('fetch', (event) => {
  // Only cache GET requests (exclude external telemetry/apis if added later)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // Return cache
        }
        
        // Fallback to network
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Dynamically cache new request resources if needed (Optional)
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Do not cache HTTP stream/WebSocket/Chrome-extension URLs
                if (event.request.url.startsWith('http')) {
                  cache.put(event.request, responseToCache);
                }
              });

            return networkResponse;
          })
          .catch(() => {
            // Offline fallback if network fails and not in cache
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});
