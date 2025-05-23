// pwa.js - Simplified

// Register the service worker for PWA functionality
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js') // Assumes service-worker.js is in the root
                .then(registration => {
                    console.log('[PWA] Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('[PWA] Service Worker registration failed:', error);
                });
        });
    }
}

// Call the registration function
registerServiceWorker();