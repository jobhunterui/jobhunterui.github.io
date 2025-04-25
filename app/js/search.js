// Search functionality for the Job Hunter Web App

// Initialize search functionality
function initSearch() {
    setupSearchButtons();
    setupToggleSections();
    setupHiringPhrases();
}

// Set up search buttons
function setupSearchButtons() {
    const searchLinkedin = document.getElementById('search-linkedin');
    const searchLinkedinFeed = document.getElementById('search-linkedin-feed');
    const searchGoogle = document.getElementById('search-google');
    const searchDocs = document.getElementById('search-docs');
    const searchAi = document.getElementById('search-ai');
    
    if (searchLinkedin) {
        searchLinkedin.addEventListener('click', searchOnLinkedIn);
    }
    
    if (searchLinkedinFeed) {
        searchLinkedinFeed.addEventListener('click', searchOnLinkedInFeed);
    }
    
    if (searchGoogle) {
        searchGoogle.addEventListener('click', searchOnGoogle);
    }
    
    if (searchDocs) {
        searchDocs.addEventListener('click', searchInDocsAndPages);
    }
    
    if (searchAi) {
        searchAi.addEventListener('click', searchWithAI);
    }
}

// Set up toggle sections
function setupToggleSections() {
    // Get all toggle headers
    const toggleHeaders = document.querySelectorAll('.toggle-header');
    
    // Add click event to each toggle header
    toggleHeaders.forEach(header => {
        header.addEventListener('click', function() {
            // Get the content section (next sibling after the header)
            const content = this.nextElementSibling;
            
            // Toggle active class on header and content
            this.classList.toggle('active');
            content.classList.toggle('active');
            
            // Update the toggle icon
            const toggleIcon = this.querySelector('.toggle-icon');
            if (toggleIcon) {
                // Change icon from right-pointing to down-pointing when active
                if (this.classList.contains('active')) {
                    toggleIcon.textContent = '▼'; // Down arrow
                } else {
                    toggleIcon.textContent = '▶'; // Right arrow
                }
            }
            
            // Track toggle action if tracking is available
            if (typeof trackEvent === 'function') {
                trackEvent('toggle_section', {
                    section: this.textContent.trim(),
                    action: this.classList.contains('active') ? 'open' : 'close'
                });
            }
        });
    });
    
    // Initialize toggle sections as closed
    toggleHeaders.forEach(header => {
        const content = header.nextElementSibling;
        header.classList.remove('active');
        content.classList.remove('active');
        
        // Set initial icon state
        const toggleIcon = header.querySelector('.toggle-icon');
        if (toggleIcon) {
            toggleIcon.textContent = '▶';
        }
    });
}

// Set up hiring phrases customization
function setupHiringPhrases() {
    const addCustomPhraseButton = document.getElementById('add-custom-phrase');
    const customPhraseInput = document.getElementById('custom-phrase');
    
    if (addCustomPhraseButton && customPhraseInput) {
        // Add custom phrase button click
        addCustomPhraseButton.addEventListener('click', addCustomPhrase);
        
        // Enter key in custom phrase input
        customPhraseInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCustomPhrase();
            }
        });
        
        // Load saved custom phrases
        loadCustomPhrases();
    }
}

// Add a custom hiring phrase
function addCustomPhrase() {
    const customPhraseInput = document.getElementById('custom-phrase');
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
        customPhraseDiv.parentNode.insertBefore(phraseOption, customPhraseDiv);
        
        // Clear input
        customPhraseInput.value = '';
        
        // Save custom phrases
        saveCustomPhrases();
        
        // Track this addition if tracking is available
        if (typeof trackEvent === 'function') {
            trackEvent('add_custom_phrase', { phrase: phrase });
        }
    }
}

// Save custom phrases to storage
function saveCustomPhrases() {
    const defaultPhrases = [
        'we are hiring', 'join our team', 'job opening', 'open position', 
        'now hiring', 'looking for', 'immediate opening', 'career opportunities',
        'remote opportunity'
    ];
    
    const customPhrases = Array.from(document.querySelectorAll('input[name="hiring-phrase"]'))
        .filter(input => !defaultPhrases.includes(input.value))
        .map(input => input.value);
    
    saveHiringPhrases(customPhrases);
}

// Load custom phrases from storage
function loadCustomPhrases() {
    const customPhrases = getHiringPhrases();
    
    if (customPhrases && customPhrases.length > 0) {
        const customPhraseDiv = document.querySelector('.custom-phrase');
        
        if (customPhraseDiv) {
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
        }
    }
}

// Helper functions for getting form values
function getSelectedHiringPhrases() {
    const selectedPhrases = Array.from(document.querySelectorAll('input[name="hiring-phrase"]:checked'))
        .map(input => input.value);
    
    if (selectedPhrases.length === 0) {
        alert('Please select at least one hiring phrase.');
        return null;
    }
    
    return selectedPhrases;
}

function validateSearchForm() {
    const role = document.getElementById('role').value.trim();
    
    if (!role) {
        alert('Please enter a job role to search for.');
        return false;
    }
    
    return true;
}

// Track search for data collection
function storeLastSearch(platform, role, location, experience, selectedSites = []) {
    const searchData = {
        platform: platform,
        role: role,
        location: location,
        experience: experience,
        timestamp: new Date().toISOString()
    };
    
    // Add selected sites if any were provided
    if (selectedSites && selectedSites.length > 0) {
        searchData.selectedSites = selectedSites;
    }
    
    // Store in localStorage
    setStorageData(STORAGE_KEYS.LAST_SEARCH, searchData);
    
    // Track this search event with enhanced data
    if (typeof trackEvent === 'function') {
        let trackingData = {
            platform: platform,
            search_term: role,
            search_location: location,
            experience_level: experience
        };
        
        // Add selected sites to tracking data if available
        if (selectedSites && selectedSites.length > 0) {
            trackingData.selected_sites = selectedSites.join(',');
        }
        
        trackEvent('job_search', trackingData);
    }
}

// Search functions
function searchOnLinkedIn() {
    if (!validateSearchForm()) return;
    
    const role = encodeURIComponent(document.getElementById('role').value.trim());
    const location = encodeURIComponent(document.getElementById('location').value.trim());
    const experience = document.getElementById('experience').value;

    // Track this search
    storeLastSearch('linkedin', role, location, experience);
    
    let url = `https://www.linkedin.com/jobs/search/?keywords=${role}&location=${location}`;
    
    if (experience) {
        // Map experience levels to LinkedIn's experience filters
        const experienceMap = {
            'entry': '&f_E=1%2C2',  // Internship, Entry level
            'mid': '&f_E=3',        // Associate
            'senior': '&f_E=4',     // Mid-Senior level
            'lead': '&f_E=5%2C6'    // Director, Executive
        };
        
        url += experienceMap[experience] || '';
    }
    
    // Open the URL in a new tab
    window.open(url, '_blank');
}

function searchOnLinkedInFeed() {
    if (!validateSearchForm()) return;
    
    const role = document.getElementById('role').value.trim();
    const location = document.getElementById('location').value.trim();
    const selectedPhrases = getSelectedHiringPhrases();
    const experience = document.getElementById('experience').value;
    
    if (!selectedPhrases) return;
    
    // Track this search
    storeLastSearch('linkedin_feed', role, location, experience);
    
    // Select a random phrase from selected options
    const randomPhrase = selectedPhrases[Math.floor(Math.random() * selectedPhrases.length)];
    
    // Generate the search URL for LinkedIn feed
    const searchParams = new URLSearchParams();
    searchParams.append('keywords', `${randomPhrase} ${role}`);
    
    if (location) {
        searchParams.append('geo', location);
    }
    
    const url = `https://www.linkedin.com/search/results/content/?${searchParams.toString()}`;
    window.open(url, '_blank');
}

function searchOnGoogle() {
    if (!validateSearchForm()) return;
    
    const role = document.getElementById('role').value.trim();
    const location = document.getElementById('location').value.trim();
    const experience = document.getElementById('experience').value;
    
    // Get selected job board sites (or use all if none selected)
    const selectedJobSites = Array.from(document.querySelectorAll('input[name="job-board"]:checked'))
        .map(input => input.value);
    
    // Use all sites if none are selected
    const atsSites = selectedJobSites.length > 0 ? selectedJobSites : [
        'jobs.lever.co',
        'boards.greenhouse.io',
        'apply.workable.com',
        'ashbyhq.com',
        'jobs.smartrecruiters.com'
    ];
    
    // Track this search with selected sites info
    storeLastSearch('job_boards', role, location, experience, selectedJobSites.length > 0 ? selectedJobSites : []);
    
    // Construct site search query
    const siteQuery = atsSites.map(site => `site:${site}`).join(' OR ');
    
    // Put the role in double quotes
    const query = `(${siteQuery}) "${role}" ${location}`;
    
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
}

function searchInDocsAndPages() {
    if (!validateSearchForm()) return;
    
    const role = document.getElementById('role').value.trim();
    const location = document.getElementById('location').value.trim();
    const selectedPhrases = getSelectedHiringPhrases();
    const experience = document.getElementById('experience').value;
    
    if (!selectedPhrases) return;
    
    // Get selected document sites (or use all if none selected)
    const selectedDocSites = Array.from(document.querySelectorAll('input[name="doc-site"]:checked'))
        .map(input => input.value);
    
    // Use all sites if none are selected
    const documentSites = selectedDocSites.length > 0 ? selectedDocSites : [
        'docs.google.com',
        'notion.site',
        'coda.io'
    ];
    
    // Track this search with selected sites info
    storeLastSearch('docs_and_pages', role, location, experience, selectedDocSites.length > 0 ? selectedDocSites : []);
    
    // Construct the site search query
    const siteQuery = documentSites.map(site => `site:${site}`).join(' OR ');
    
    // Select a random phrase
    const randomPhrase = selectedPhrases[Math.floor(Math.random() * selectedPhrases.length)];
    
    // Build the search query
    let query = `(${siteQuery}) AND ("${randomPhrase}") AND "${role}"`;
    
    // Add location if provided
    if (location) {
        query += ` AND "${location}"`;
    }
    
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
}

function searchWithAI() {
    if (!validateSearchForm()) return;
    
    const role = document.getElementById('role').value.trim();
    const location = document.getElementById('location').value.trim();
    const experience = document.getElementById('experience').value;

    // Track this search
    storeLastSearch('AI', role, location, experience);
    
    // Create an improved prompt that's more focused on job search quality
    let prompt = `Find recent job postings for "${role}"`;
    
    // Add location context if provided
    if (location.toLowerCase().includes('remote')) {
        prompt += ` that are fully remote`;
    } else if (location) {
        prompt += ` in ${location}`;
    }
    
    // Add experience level context if provided
    if (experience) {
        const experienceText = {
            'entry': 'entry-level or junior',
            'mid': 'mid-level',
            'senior': 'senior-level',
            'lead': 'leadership or management level'
        }[experience] || '';
        
        if (experienceText) {
            prompt += ` for ${experienceText} candidates`;
        }
    }
    
    // Add time relevance
    prompt += ` posted in the last 30 days.`;
    
    // Add instructions for high-quality results
    prompt += ` For each position, provide:
1. Job title and company
2. Location and remote options
3. Salary range if available
4. Key responsibilities and required skills
5. Direct application link
6. Any notable benefits or company culture details

Focus on active job listings from reputable companies with complete information. Exclude outdated or vague listings.`;

    const url = `https://www.perplexity.ai/?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank');
}

// Initialize search on page load
document.addEventListener('DOMContentLoaded', initSearch);