const TRACKING_VERSION = '1.0.0';

// Unified tracking function that sends events to both Google Analytics and our custom tracking system
function trackEvent(eventName, eventParams = {}) {
    // First, track in Google Analytics
    try {
        // Get user ID to include in parameters
        const userId = getOrCreateUserId();
        const enhancedParams = {
            ...eventParams,
            tracking_version: TRACKING_VERSION,
            user_id: userId,
            timestamp: new Date().toISOString()
        };
        
        // Log the event to Google Analytics
        gtag('event', eventName, enhancedParams);
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

// Track page performance metrics
function trackPerformance() {
    if (window.performance) {
        // Get performance metrics
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        const domLoadTime = perfData.domComplete - perfData.domLoading;
        const networkLatency = perfData.responseEnd - perfData.requestStart;
        const redirectTime = perfData.redirectEnd - perfData.redirectStart;
        const dnsLookupTime = perfData.domainLookupEnd - perfData.domainLookupStart;
        const serverResponseTime = perfData.responseEnd - perfData.requestStart;
        
        // Track performance data
        trackEvent('page_performance', {
            page_load_time_ms: pageLoadTime,
            dom_load_time_ms: domLoadTime,
            network_latency_ms: networkLatency,
            redirect_time_ms: redirectTime,
            dns_lookup_time_ms: dnsLookupTime,
            server_response_time_ms: serverResponseTime
        });
    }
}

// Call performance tracking after window load
window.addEventListener('load', function() {
    // Wait for all resources to be loaded and timing to be available
    setTimeout(trackPerformance, 0);
});