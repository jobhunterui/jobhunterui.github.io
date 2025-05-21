// enhanced-analytics.js
// Simple analytics enhancement for JobHunter

// Track feature usage with proper event parameters
function trackFeatureUsage(featureName, additionalParams = {}) {
    if (typeof gtag !== 'function') return;
    
    // Create parameters object with the feature name
    const params = {
        feature_used: featureName,
        ...additionalParams
    };
    
    // Send event to GA4
    gtag('event', 'feature_usage', params);
}

// Track tab switches
function trackTabSwitch(tabName, previousTab = null) {
    if (typeof gtag !== 'function') return;
    
    gtag('event', 'tab_switch', {
        tab_name: tabName,
        previous_tab: previousTab || 'none'
    });
}

// Track job interactions (save, view, apply)
function trackJobInteraction(interactionType, jobData) {
    if (typeof gtag !== 'function') return;
    
    gtag('event', interactionType, {
        job_title: jobData.title || 'Unknown',
        company: jobData.company || 'Unknown'
    });
}

// Set user properties once at the beginning of session
function setUserProperties() {
    if (typeof gtag !== 'function') return;
    
    // Get user ID or create one
    const userId = getOrCreateUserId();
    
    // Set user properties in GA4
    gtag('set', 'user_properties', {
        app_source: 'web_app'
    });
}

// Initialize enhanced analytics
document.addEventListener('DOMContentLoaded', function() {
    // Set user properties
    setUserProperties();
    
    // Track initial page view
    if (typeof gtag === 'function') {
        gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href
        });
    }
});