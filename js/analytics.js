// Basic analytics initialization
console.log("Analytics module loaded");

// If trackEvent is called but not defined elsewhere, provide a basic implementation
if (typeof trackEvent !== 'function') {
    window.trackEvent = function(eventName, params = {}) {
        // Use gtag directly if available 
        if (typeof gtag === 'function') {
            console.log(`Tracking event: ${eventName}`, params);
            gtag('event', eventName, params);
            return true;
        } else {
            console.warn(`Failed to track event: ${eventName}`, params);
            return false;
        }
    };
}