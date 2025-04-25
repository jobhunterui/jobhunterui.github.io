// Main application controller for the Job Hunter Web App

// Initialize the application
function initApp() {
    console.log('Job Hunter Web App initializing...');
    
    // Load saved jobs
    loadSavedJobs();
    
    // Load profile data
    loadProfileData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Track page view
    if (typeof trackEvent === 'function') {
        trackEvent('page_view', { 
            page_title: document.title,
            page_location: window.location.href
        });
    }
    
    console.log('Job Hunter Web App initialized');
}

// Set up event listeners for interactive elements
function setupEventListeners() {
    // Set up job saving form
    const jobForm = document.getElementById('job-entry-form');
    if (jobForm) {
        jobForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveJobFromForm();
        });
    }
    
    // Set up profile save button
    const saveProfileButton = document.getElementById('save-profile');
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', function() {
            saveProfileFromForm();
        });
    }
    
    // Set up any additional interactive elements
    // ...
}

// Load saved jobs from storage and display in the UI
function loadSavedJobs() {
    const savedJobsList = document.getElementById('saved-jobs-list');
    const jobActions = document.getElementById('job-actions');
    
    if (!savedJobsList) return;
    
    const savedJobs = getSavedJobs();
    
    if (savedJobs.length > 0) {
        // Clear empty state
        savedJobsList.innerHTML = '';
        
        // Add job items
        savedJobs.forEach((job, index) => {
            const jobItem = document.createElement('div');
            jobItem.className = 'job-item';
            jobItem.setAttribute('data-index', index);
            
            // Add job details to item
            const displayUrl = job.url ? 
                (job.url.length > 40 ? job.url.substring(0, 37) + '...' : job.url) : 
                'URL not available';
            
            jobItem.innerHTML = `
                <div class="job-title">${job.title || 'Untitled Position'}</div>
                <div class="job-company">${job.company || 'Company not specified'}</div>
                <div class="job-location">${job.location || 'Location not specified'}</div>
                <div class="job-url"><a href="${job.url}" target="_blank" title="${job.url}">${displayUrl}</a></div>
                <div class="job-item-actions">
                    <button class="view-details-btn">View Details</button>
                </div>
            `;
            
            // Add selection functionality
            jobItem.addEventListener('click', (e) => {
                // Don't select if clicking on buttons or links
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
                    return;
                }
                
                // Toggle selection
                document.querySelectorAll('.job-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                jobItem.classList.add('selected');
                
                if (jobActions) {
                    jobActions.classList.remove('hidden');
                }
            });
            
            // Add view details functionality
            const viewDetailsBtn = jobItem.querySelector('.view-details-btn');
            if (viewDetailsBtn) {
                viewDetailsBtn.addEventListener('click', () => {
                    showJobDetails(job, index);
                });
            }
            
            // Add status tracking
            addStatusTracking(jobItem, job, index);
            
            savedJobsList.appendChild(jobItem);
        });
    } else {
        savedJobsList.innerHTML = '<div class="empty-state">No saved jobs yet.</div>';
        
        if (jobActions) {
            jobActions.classList.add('hidden');
        }
    }
}

// Add status tracking UI to job items
function addStatusTracking(jobItem, job, index) {
    // Implementation will go here
    // This will be fleshed out in Phase 2
}

// Show job details modal
function showJobDetails(job, index) {
    // Implementation will go here
    // This will be fleshed out in Phase 2
}

// Save job from form input
function saveJobFromForm() {
    // Implementation will go here
    // This will be fleshed out in Phase 2
}

// Load profile data from storage
function loadProfileData() {
    const cvTextarea = document.getElementById('cv');
    
    if (cvTextarea) {
        const profileData = getProfileData();
        cvTextarea.value = profileData.cv || '';
    }
}

// Save profile data from form
function saveProfileFromForm() {
    const cvTextarea = document.getElementById('cv');
    
    if (cvTextarea) {
        const profileData = {
            cv: cvTextarea.value
        };
        
        const success = saveProfileData(profileData);
        
        if (success) {
            showModal('Profile Saved', 'Your profile has been saved successfully.');
            
            // Track profile save
            if (typeof trackEvent === 'function') {
                trackEvent('save_profile');
            }
        } else {
            showModal('Error', 'There was an error saving your profile. Please try again.');
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);