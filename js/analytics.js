// Google Analytics 4 Configuration
// Replace G-XXXXXXXXXX with your actual Measurement ID
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-TH7Y2W8GC4');

// Create or get anonymous user ID for better tracking
function getOrCreateUserId() {
    let userId = localStorage.getItem('user_id');
    
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('user_id', userId);
    }
    
    return userId;
}

// Main function to track events
function trackEvent(eventName, eventParams = {}) {
    try {
        // Add user ID to parameters
        const userId = getOrCreateUserId();
        const enhancedParams = {
            ...eventParams,
            user_id: userId,
            timestamp: new Date().toISOString()
        };
        
        // Log the event to Google Analytics
        gtag('event', eventName, enhancedParams);
        
        // Also log to console during development
        console.log(`Event tracked: ${eventName}`, enhancedParams);
        
        return true;
    } catch (error) {
        console.error("Error tracking event:", error);
        return false;
    }
}

// Track time spent on page
let pageVisitStartTime = Date.now();
window.addEventListener('beforeunload', function() {
    const timeSpentSeconds = Math.round((Date.now() - pageVisitStartTime) / 1000);
    trackEvent('time_on_site', { 
        seconds: timeSpentSeconds,
        minutes: Math.floor(timeSpentSeconds / 60)
    });
});

// Track scroll depth
let maxScrollPercentage = 0;
window.addEventListener('scroll', function() {
    // Calculate current scroll percentage
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPosition = window.scrollY;
    const scrollPercentage = Math.round((scrollPosition / scrollHeight) * 100);
    
    // Track at certain breakpoints (25%, 50%, 75%, 90%, 100%)
    const breakpoints = [25, 50, 75, 90, 100];
    
    breakpoints.forEach(breakpoint => {
        if (scrollPercentage >= breakpoint && maxScrollPercentage < breakpoint) {
            trackEvent('scroll_depth', { percentage: breakpoint });
            maxScrollPercentage = breakpoint;
        }
    });
});

// Enhanced link tracking
document.addEventListener('DOMContentLoaded', function() {
    // Track external link clicks
    document.querySelectorAll('a').forEach(link => {
        if (link.hostname !== window.location.hostname && 
            !link.getAttribute('href').startsWith('#') && 
            !link.getAttribute('href').startsWith('javascript:')) {
            
            link.addEventListener('click', function(e) {
                trackEvent('external_link_click', {
                    destination: this.href,
                    link_text: this.textContent.trim()
                });
            });
        }
    });
});