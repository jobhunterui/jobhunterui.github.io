// Unified tracking function that sends events to both Google Analytics and our custom tracking system
function trackEvent(eventName, eventParams = {}) {
    // First, track in Google Analytics
    try {
        // Get user ID to include in parameters
        const userId = getOrCreateUserId();
        const enhancedParams = {
            ...eventParams,
            user_id: userId,
            timestamp: new Date().toISOString()
        };
        
        // Log the event to Google Analytics
        gtag('event', eventName, enhancedParams);
        
        // Log to console during development
        console.log(`GA Event tracked: ${eventName}`, enhancedParams);
    } catch (error) {
        console.error("Error tracking GA event:", error);
    }
    
    // Then, track in our custom tracking system
    try {
        trackAppEvent(eventName, eventParams);
    } catch (error) {
        console.error("Error tracking custom event:", error);
    }
    
    return true;
}

// Helper function to ensure we're not breaking existing code
function isTrackingAvailable() {
    return typeof gtag === 'function' && typeof trackAppEvent === 'function';
}