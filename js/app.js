document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Track tab view
            trackEvent('view_tab', { tab_name: tabId });
        });
    });
    
    // Modified for new structure - if the URL has a hash, activate that tab
    if (window.location.hash) {
        const tabId = window.location.hash.substring(1);
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (tabButton) {
            tabButton.click();
        }
    }
    
    // Hiring phrases toggle functionality - kept for backwards compatibility
    const hiringPhrasesToggle = document.getElementById('show-hiring-phrases');
    if (hiringPhrasesToggle) {
        const hiringPhrasesOptions = document.getElementById('hiring-phrases-options');
        
        hiringPhrasesToggle.addEventListener('click', function() {
            hiringPhrasesOptions.classList.toggle('hidden');
            hiringPhrasesToggle.classList.toggle('active');
        });
    }
    
    // Custom phrase adding functionality - kept for backwards compatibility
    const addCustomPhraseButton = document.getElementById('add-custom-phrase');
    if (addCustomPhraseButton) {
        const customPhraseInput = document.getElementById('custom-phrase');
        
        addCustomPhraseButton.addEventListener('click', function() {
            addCustomPhrase();
        });
        
        // Handle "Enter" key in custom phrase input
        if (customPhraseInput) {
            customPhraseInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomPhrase();
                }
            });
        }
    }
    
    function addCustomPhrase() {
        const customPhraseInput = document.getElementById('custom-phrase');
        if (!customPhraseInput) return;
        
        const phrase = customPhraseInput.value.trim();
        
        if (phrase) {
            // Create new checkbox option
            const phraseOption = document.createElement('div');
            phraseOption.className = 'phrase-option';
            
            const id = 'phrase-custom-' + Date.now();
            
            phraseOption.innerHTML = `
                <input type="checkbox" id="${id}" name="hiring-phrase" value="${phrase}" checked>
                <label for="${id}">"${phrase}"</label>
            `;
            
            // Insert before the custom phrase input
            const customPhraseDiv = document.querySelector('.custom-phrase');
            if (customPhraseDiv) {
                customPhraseDiv.parentNode.insertBefore(phraseOption, customPhraseDiv);
            }
            
            // Clear input
            customPhraseInput.value = '';
            
            // Track the custom phrase addition
            trackEvent('add_custom_phrase', { phrase: phrase });
        }
    }
    
    // Job boards toggle functionality - kept for backwards compatibility
    const jobBoardsToggle = document.getElementById('show-job-boards');
    if (jobBoardsToggle) {
        const jobBoardsOptions = document.getElementById('job-boards-options');
        
        jobBoardsToggle.addEventListener('click', function() {
            jobBoardsOptions.classList.toggle('hidden');
            jobBoardsToggle.classList.toggle('active');
        });
    }
    
    // Document sites toggle functionality - kept for backwards compatibility
    const docSitesToggle = document.getElementById('show-doc-sites');
    if (docSitesToggle) {
        const docSitesOptions = document.getElementById('doc-sites-options');
        
        docSitesToggle.addEventListener('click', function() {
            docSitesOptions.classList.toggle('hidden');
            docSitesToggle.classList.toggle('active');
        });
    }
    
    // Extension Required Modal
    const modal = document.getElementById('extension-required-modal');
    const closeModal = document.querySelector('.close-modal');
    const cancelModal = document.getElementById('cancel-modal');
    
    // Close modal functions
    function hideModal() {
        modal.style.display = 'none';
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', hideModal);
    }
    
    if (cancelModal) {
        cancelModal.addEventListener('click', hideModal);
    }
    
    // Close when clicking outside of the modal content
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            hideModal();
        }
    });
    
    // Scroll to section when clicking on links with hash
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                // If clicking on a tab link, activate that tab
                if (['features', 'about', 'webapp', 'extension'].includes(targetId)) {
                    const tabButton = document.querySelector(`.tab-button[data-tab="${targetId}"]`);
                    if (tabButton) {
                        tabButton.click();
                    }
                }
                
                // Scroll to the app container
                document.querySelector('.app-container').scrollIntoView({
                    behavior: 'smooth'
                });
                
                // Update URL with hash for better bookmarking
                history.pushState(null, null, `#${targetId}`);
                
                // Track the navigation
                trackEvent('internal_navigation', { destination: targetId });
            }
        });
    });
    
    // Web App launch buttons
    document.querySelectorAll('a[href="/app"]').forEach(button => {
        button.addEventListener('click', function(e) {
            // Track web app launch
            trackEvent('web_app_launch', { source: this.className });
        });
    });
    
    // Extension install buttons
    document.querySelectorAll('a[href*="addons.mozilla.org"]').forEach(button => {
        button.addEventListener('click', function(e) {
            // Track extension install attempt
            trackEvent('extension_install_attempt', { source: this.className });
        });
    });
    
    // Track when users view the site
    trackEvent('page_view', { 
        page_title: document.title,
        page_location: window.location.href
    });
});

// Simple local storage for custom phrases - kept for backwards compatibility
function saveHiringPhrases() {
    const phraseInputs = document.querySelectorAll('input[name="hiring-phrase"]');
    if (phraseInputs.length === 0) return;
    
    const customPhrases = Array.from(phraseInputs)
        .filter(input => !['we are hiring', 'join our team', 'job opening', 'open position', 
                          'now hiring', 'looking for', 'immediate opening', 'career opportunities',
                          'remote opportunity'].includes(input.value))
        .map(input => input.value);
    
    localStorage.setItem('hiringPhrases', JSON.stringify(customPhrases));
}

// Load hiring phrases from local storage - kept for backwards compatibility
function loadHiringPhrases() {
    const customPhraseDiv = document.querySelector('.custom-phrase');
    if (!customPhraseDiv) return;
    
    const storedPhrases = localStorage.getItem('hiringPhrases');
    
    if (storedPhrases) {
        try {
            const customPhrases = JSON.parse(storedPhrases);
            
            customPhrases.forEach(phrase => {
                // Check if this phrase already exists
                const exists = Array.from(document.querySelectorAll('input[name="hiring-phrase"]'))
                    .some(input => input.value === phrase);
                
                if (!exists) {
                    const phraseOption = document.createElement('div');
                    phraseOption.className = 'phrase-option';
                    
                    const id = 'phrase-custom-' + Date.now() + Math.random().toString(36).substr(2, 5);
                    
                    phraseOption.innerHTML = `
                        <input type="checkbox" id="${id}" name="hiring-phrase" value="${phrase}" checked>
                        <label for="${id}">"${phrase}"</label>
                    `;
                    
                    customPhraseDiv.parentNode.insertBefore(phraseOption, customPhraseDiv);
                }
            });
        } catch (e) {
            console.error('Error loading hiring phrases:', e);
        }
    }
}

// Call the load function when the page is loaded - kept for backwards compatibility
window.addEventListener('load', function() {
    if (document.querySelector('.custom-phrase')) {
        loadHiringPhrases();
    }
});

// Save phrases when they're modified or when the page is unloaded - kept for backwards compatibility
window.addEventListener('beforeunload', function() {
    if (document.querySelectorAll('input[name="hiring-phrase"]').length > 0) {
        saveHiringPhrases();
    }
});

// Show the extension required modal for features that need it
function showExtensionRequiredModal() {
    const modal = document.getElementById('extension-required-modal');
    if (modal) {
        modal.style.display = 'block';
        trackEvent('extension_required_modal_shown');
    }
}