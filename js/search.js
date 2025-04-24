document.addEventListener('DOMContentLoaded', function() {
    // Set up search buttons
    document.getElementById('search-linkedin').addEventListener('click', searchOnLinkedIn);
    document.getElementById('search-linkedin-feed').addEventListener('click', searchOnLinkedInFeed);
    document.getElementById('search-google').addEventListener('click', searchOnGoogle);
    document.getElementById('search-docs').addEventListener('click', searchInDocsAndPages);
    document.getElementById('search-ai').addEventListener('click', searchWithAI);

    // Set up toggles for job boards and doc sites
    document.getElementById('show-job-boards').addEventListener('click', toggleJobBoardsSelection);
    document.getElementById('show-doc-sites').addEventListener('click', toggleDocSitesSelection);
});

// Functions to show/hide the site selection panels
function toggleJobBoardsSelection() {
    const optionsEl = document.getElementById('job-boards-options');
    const toggleEl = document.getElementById('show-job-boards');
    
    if (optionsEl.classList.contains('hidden')) {
        optionsEl.classList.remove('hidden');
        toggleEl.classList.add('active');
    } else {
        optionsEl.classList.add('hidden');
        toggleEl.classList.remove('active');
    }
}

function toggleDocSitesSelection() {
    const optionsEl = document.getElementById('doc-sites-options');
    const toggleEl = document.getElementById('show-doc-sites');
    
    if (optionsEl.classList.contains('hidden')) {
        optionsEl.classList.remove('hidden');
        toggleEl.classList.add('active');
    } else {
        optionsEl.classList.add('hidden');
        toggleEl.classList.remove('active');
    }
}

// Common functions for getting selected hiring phrases
function getSelectedHiringPhrases() {
    const selectedPhrases = Array.from(document.querySelectorAll('input[name="hiring-phrase"]:checked'))
        .map(input => input.value);
    
    if (selectedPhrases.length === 0) {
        alert('Please select at least one hiring phrase.');
        return null;
    }
    
    return selectedPhrases;
}

// Validate form fields
function validateSearchForm() {
    const role = document.getElementById('role').value.trim();
    
    if (!role) {
        alert('Please enter a job role to search for.');
        return false;
    }
    
    return true;
}

// Find Jobs Tab Functions
function searchOnLinkedIn() {
    if (!validateSearchForm()) return;
    
    const role = encodeURIComponent(document.getElementById('role').value.trim());
    const location = encodeURIComponent(document.getElementById('location').value.trim());
    const experience = document.getElementById('experience').value;
    
    // Track this search
    trackEvent('search', {
        platform: 'linkedin',
        search_term: role,
        search_location: location,
        experience_level: experience
    });
    
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
    trackEvent('search', {
        platform: 'linkedin_feed',
        search_term: role,
        search_location: location,
        experience_level: experience,
        hiring_phrases: selectedPhrases.join(', ')
    });
    
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
    trackEvent('search', {
        platform: 'job_boards',
        search_term: role,
        search_location: location,
        experience_level: experience,
        selected_sites: selectedJobSites.length > 0 ? selectedJobSites.join(',') : 'all'
    });
    
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
    trackEvent('search', {
        platform: 'docs_and_pages',
        search_term: role,
        search_location: location,
        experience_level: experience,
        hiring_phrases: selectedPhrases.join(', '),
        selected_sites: selectedDocSites.length > 0 ? selectedDocSites.join(',') : 'all'
    });
    
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
    trackEvent('search', {
        platform: 'ai',
        search_term: role,
        search_location: location,
        experience_level: experience
    });
    
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