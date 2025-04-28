document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Header scroll behavior
    const header = document.querySelector('header');
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // Save scroll position for next comparison
        lastScrollTop = scrollTop;
    });
    
    // Features tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Track tab view
            trackEvent('view_feature_tab', { tab_name: tabId });
        });
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                // Scroll to the target element with smooth behavior
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // Account for header height
                    behavior: 'smooth'
                });
                
                // Track navigation click
                if (typeof trackEvent === 'function') {
                    trackEvent('navigation_click', { 
                        target: targetId,
                        link_text: this.textContent
                    });
                }
            }
        });
    });
    
    // Track when Get Started or CTA buttons are clicked
    document.querySelectorAll('a[href="/app"]').forEach(button => {
        button.addEventListener('click', function() {
            if (typeof trackEvent === 'function') {
                trackEvent('cta_click', { 
                    button_text: this.textContent,
                    button_location: getElementPosition(this)
                });
            }
        });
    });
    
    // Track when extension links are clicked
    document.querySelectorAll('a[href*="addons.mozilla.org"]').forEach(link => {
        link.addEventListener('click', function() {
            if (typeof trackEvent === 'function') {
                trackEvent('extension_click', { 
                    link_location: getElementPosition(this)
                });
            }
        });
    });
    
    // Fade-in animations for sections as they come into view
    if ('IntersectionObserver' in window) {
        const sections = document.querySelectorAll('section');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });
        
        sections.forEach(section => {
            observer.observe(section);
        });
    }
});

// Helper function to get the position description of an element
function getElementPosition(element) {
    // Get closest section
    const section = element.closest('section');
    
    if (section && section.id) {
        return section.id;
    } else if (element.closest('header')) {
        return 'header';
    } else if (element.closest('footer')) {
        return 'footer';
    }
    
    return 'unknown';
}

// Simple tracking function (fallback if analytics.js isn't loaded)
function trackEvent(eventName, eventParams = {}) {
    if (typeof gtag === 'function') {
        gtag('event', eventName, eventParams);
    } else {
        console.log('Event tracked:', eventName, eventParams);
    }
}