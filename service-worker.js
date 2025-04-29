const CACHE_NAME = 'jobhunter-cache-v1';
const CACHE_URLS = [
    // Core app pages
    '/app/index.html',
    
    // Styles
    '/css/app-base.css',
    '/css/app.css', 
    '/css/learning.css',
    
    // Images
    '/images/logo.png',
    '/images/logo-small.png',
    '/images/favicon.ico',
    '/images/logo-192.png',
    '/images/logo-512.png',
    
    // App scripts
    '/app/js/storage.js',
    '/app/js/tracking.js',
    '/app/js/unified-tracking.js',
    '/app/js/ui.js',
    '/app/js/cv-api.js',
    '/app/js/search.js',
    '/app/js/prompts.js',
    '/app/js/app.js',
    '/app/js/insights.js',
    '/app/js/learning.js',
    '/app/js/pwa.js'
];

// Install event - cache basic app shell
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching app shell...');
                return cache.addAll(CACHE_URLS);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName !== CACHE_NAME;
                }).map(cacheName => {
                    console.log('Service Worker: Clearing old cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Skip cross-origin requests and API calls
    if (!event.request.url.startsWith(self.location.origin) ||
        event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached response if found
                if (response) {
                    return response;
                }

                // Fetch from network if not in cache
                return fetch(event.request).then(response => {
                    // Check if we received a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response - one to return, one to cache
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
            .catch(() => {
                // If both cache and network fail, show offline fallback
                if (event.request.mode === 'navigate') {
                    return caches.match('/app/index.html');
                }

                // Return nothing for other resources
                return new Response('', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
    );
});