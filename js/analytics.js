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
function trackGAEvent(eventName, eventParams = {}) {
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
        
        return true;
    } catch (error) {
        console.error("Error tracking event:", error);
        return false;
    }
}

// Track extension install clicks with source information
function trackExtensionInstall(source) {
    trackGAEvent('extension_install_click', { source: source });
}

// Add tracking to all extension install buttons on page load
document.addEventListener('DOMContentLoaded', function() {
    // Track extension install button clicks with source information
    document.querySelectorAll('a[href*="addons.mozilla.org"]').forEach(link => {
        link.addEventListener('click', function(e) {
            // Get the section where the button is located
            let source = 'unknown';
            
            if (this.closest('#install')) {
                source = 'install_tab';
            } else if (this.closest('.hero')) {
                source = 'hero_section';
            } else if (this.closest('.features')) {
                source = 'features_section';
            } else if (this.closest('.about-content')) {
                source = 'about_tab';
            } else if (this.closest('.modal-content')) {
                source = 'extension_required_modal';
            } else if (this.closest('header')) {
                source = 'header';
            }
            
            trackExtensionInstall(source);
        });
    });
    
    // Track Twitter links
    document.querySelectorAll('a[href*="twitter.com"]').forEach(link => {
        link.addEventListener('click', function() {
            trackGAEvent('twitter_link_click', {
                link_text: this.textContent.trim()
            });
        });
    });
});

// Track time spent on page
let pageVisitStartTime = Date.now();
window.addEventListener('beforeunload', function() {
    const timeSpentSeconds = Math.round((Date.now() - pageVisitStartTime) / 1000);
    trackGAEvent('time_on_site', { 
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
            trackGAEvent('scroll_depth', { percentage: breakpoint });
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
            !link.getAttribute('href').startsWith('javascript:') &&
            !link.getAttribute('href').includes('addons.mozilla.org') && // Skip extension links (tracked separately)
            !link.getAttribute('href').includes('twitter.com')) { // Skip twitter links (tracked separately)
            
            link.addEventListener('click', function(e) {
                trackGAEvent('external_link_click', {
                    destination: this.href,
                    link_text: this.textContent.trim()
                });
            });
        }
    });
    
    // Track pricing comparison table views (when it scrolls into view)
    const pricingTable = document.querySelector('.pricing-comparison');
    if (pricingTable) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    trackGAEvent('pricing_comparison_view');
                    observer.unobserve(entry.target); // Track only once
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(pricingTable);
    }
});

// Track feature cards views 
document.addEventListener('DOMContentLoaded', function() {
    const featureCards = document.querySelectorAll('.feature-card');
    
    if (featureCards.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const card = entry.target;
                    const featureName = card.querySelector('h3').textContent;
                    trackGAEvent('feature_card_view', { feature: featureName });
                    observer.unobserve(card); // Track only once per card
                }
            });
        }, { threshold: 0.7 });
        
        featureCards.forEach(card => {
            observer.observe(card);
        });
    }
});