const CACHE_NAME = 'timson-pos-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/timson-pos-login/index.html',
    '/timson-pos-admin/admin-dashboard.html',
    '/timson-pos-admin/admin.css',
    '/cashier/cashier.html',
    '/cashier/cashier.js',
    '/logo.png'
];

// Install Event - Caching basic assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event - Cleaning up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Removing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event - Stale-While-Revalidate Strategy
self.addEventListener('fetch', event => {
    // Skip non-GET requests (Firebase DB, Gemini API)
    if (event.request.method !== 'GET') return;

    // Skip Chrome Extensions and external APIs (for now)
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                    });
                    return networkResponse;
                });
                return cachedResponse || fetchPromise;
            })
    );
});
