// service-worker.js

// --- CONFIGURATION ---
const SW_VERSION = 'v1.4.4'; // IMPORTANT: Increment this with each new app deployment!
const CACHE_NAME = `jobhunter-cache-${SW_VERSION}`;

// App Shell: Core files that make up your application's structure and basic functionality.
// These will be pre-cached during install and updated when SW_VERSION changes.
const APP_SHELL_URLS = [
    '/index.html',
    '/css/app-base.css',
    '/css/app.css',
    '/css/learning.css',
    '/css/modal.css', // Added modal.css, ensure path is correct
    '/images/logo.png',
    '/images/logo-small.png',
    '/images/favicon.ico',
    '/images/logo-192.png',
    '/images/logo-512.png',
    '/js/storage.js',
    '/js/tracking.js',
    '/js/unified-tracking.js',
    '/js/ui.js',
    '/js/cv-api.js',
    '/js/search.js',
    '/js/prompts.js',
    '/js/app.js',
    '/js/insights.js',
    '/js/learning.js',
    '/js/pwa.js',
    // Consider adding manifest.json here if you want it pre-cached as part of the shell
    // '/manifest.json', 
];

// Patterns for requests that should always go to the network and NOT be cached by the service worker.
const NETWORK_ONLY_PATTERNS = [
    /googleapis\.com/,            // All Google API calls (Firebase Auth, Firestore, Analytics)
    /\/api\//,                    // Your custom backend APIs if any (matches /api/ in path)
    // Add other specific third-party domains or paths if needed
];

// --- SERVICE WORKER LIFECYCLE ---

self.addEventListener('install', event => {
    console.log(`[SW ${SW_VERSION}] Installing...`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`[SW ${SW_VERSION}] Caching app shell (${APP_SHELL_URLS.length} files)...`);
                const cachePromises = APP_SHELL_URLS.map(urlToCache => {
                    return cache.add(urlToCache).catch(err => {
                        // Log individual caching errors but don't let one failure stop others.
                        console.warn(`[SW ${SW_VERSION}] Failed to cache ${urlToCache}:`, err);
                    });
                });
                return Promise.all(cachePromises);
            })
            .then(() => {
                console.log(`[SW ${SW_VERSION}] App shell cached. Installation complete.`);
                return self.skipWaiting(); // Activate the new service worker immediately
            })
            .catch(error => {
                console.error(`[SW ${SW_VERSION}] App shell caching failed during install:`, error);
            })
    );
});

self.addEventListener('activate', event => {
    console.log(`[SW ${SW_VERSION}] Activating...`);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete any cache that is from this PWA but not the current version.
                    if (cacheName.startsWith('jobhunter-cache-') && cacheName !== CACHE_NAME) {
                        console.log(`[SW ${SW_VERSION}] Clearing old cache:`, cacheName);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        }).then(() => {
            console.log(`[SW ${SW_VERSION}] Activation complete. Old caches cleared.`);
            return self.clients.claim(); // Take control of all open client pages
        })
    );
});

// --- FETCH EVENT HANDLING ---

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // 1. Handle Network-Only Requests (e.g., APIs, Firebase)
    // These requests are passed directly to the network and are not cached by this SW.
    if (event.request.method !== 'GET' || NETWORK_ONLY_PATTERNS.some(pattern => pattern.test(requestUrl.href))) {
        // For non-GET requests or matching network-only patterns, bypass the cache.
        // The browser will handle these requests as usual.
        return; 
    }

    // 2. Handle Navigation Requests (e.g., accessing index.html directly)
    // Strategy: Network first, then Cache. This ensures users get the latest HTML shell if online.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // If fetch is successful, use it.
                    // Note: index.html is also in APP_SHELL_URLS, so it will be cached during install.
                    // This network-first ensures the latest HTML is attempted.
                    return networkResponse;
                })
                .catch(() => {
                    // If network fails, try to serve index.html from cache.
                    console.warn(`[SW ${SW_VERSION}] Network failed for navigation. Serving index.html from cache.`);
                    return caches.match('/index.html', { cacheName: CACHE_NAME });
                })
        );
        return;
    }

    // 3. Handle App Shell Assets & Other Same-Origin GET Requests
    // Strategy: Cache First, then Network.
    // For files pre-cached in APP_SHELL_URLS, this serves them quickly.
    // For other same-origin assets not pre-cached (e.g., images loaded by JS, or firebase-config.js),
    // it fetches, serves, and then caches them for next time.
    event.respondWith(
        caches.match(event.request, { cacheName: CACHE_NAME })
            .then(cachedResponse => {
                if (cachedResponse) {
                    // console.log(`[SW ${SW_VERSION}] Serving from cache: ${requestUrl.pathname}`);
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                // console.log(`[SW ${SW_VERSION}] Not in cache, fetching: ${requestUrl.pathname}`);
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        // Only cache successful responses from our own origin that are not HTML (HTML handled by navigation)
                        if (requestUrl.origin === self.location.origin && !requestUrl.pathname.endsWith('.html')) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                // console.log(`[SW ${SW_VERSION}] Caching new resource: ${requestUrl.pathname}`);
                                cache.put(event.request, responseToCache);
                            });
                        }
                    }
                    return networkResponse;
                });
            })
            .catch(error => {
                console.error(`[SW ${SW_VERSION}] Error in fetch handler for ${requestUrl.pathname}:`, error);
                // Generic fallback for assets could be added here if needed, but often not for non-navigation.
                return new Response("Resource not available.", {
                    status: 404,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
    );
});