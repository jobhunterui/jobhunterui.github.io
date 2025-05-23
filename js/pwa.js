const CACHE_VERSION = 'v1.1'; // Increment this when you want to force cache update
const CACHE_NAME = `jobhunter-cache-${CACHE_VERSION}`;

// Resources that should never be cached
const NO_CACHE_URLS = [
    '/js/firebase-config.js',
    '/js/cloud-sync.js',
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com'
];

// Register the service worker for PWA functionality
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Path to service worker file in the root directory
            // This works correctly whether accessed from /app/index.html or /index.html
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
}

// Call the registration function
registerServiceWorker();