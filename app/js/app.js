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
    
    // Check storage usage
    checkStorageUsage();
    
    // Show extension promotion in strategic locations
    showExtensionPromo('job-save');
    showExtensionPromo('job-view');
    
    // Show welcome tour for first-time users
    setTimeout(() => {
        showWelcomeTour();
    }, 1000);
    
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
    // Set up job form save button
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
    
    // Set up refresh jobs button
    const refreshJobsButton = document.getElementById('refresh-jobs');
    if (refreshJobsButton) {
        refreshJobsButton.addEventListener('click', function() {
            // Clear the jobs list and reload from storage
            const savedJobsList = document.getElementById('saved-jobs-list');
            if (savedJobsList) {
                savedJobsList.innerHTML = '<div class="loading-jobs">Loading saved jobs...</div>';
            }
            
            // Add a small delay to show the loading message
            setTimeout(() => {
                loadSavedJobs();
            }, 300);
        });
    }
    
    // Set up job action buttons
    const generateApplicationButton = document.getElementById('generate-application');
    if (generateApplicationButton) {
        generateApplicationButton.addEventListener('click', generateApplication);
    }
    
    const interviewPrepButton = document.getElementById('interview-prep');
    if (interviewPrepButton) {
        interviewPrepButton.addEventListener('click', generateInterviewPrep);
    }
    
    const removeJobButton = document.getElementById('remove-job');
    if (removeJobButton) {
        removeJobButton.addEventListener('click', removeSelectedJob);
    }

    initializeToggles();
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
    const jobActions = jobItem.querySelector('.job-item-actions');
    
    // Create status selector
    const statusContainer = document.createElement('div');
    statusContainer.className = 'job-status-container';
    
    const statusLabel = document.createElement('span');
    statusLabel.className = 'status-label';
    statusLabel.textContent = 'Status: ';
    
    const statusSelect = document.createElement('select');
    statusSelect.className = 'job-status-select';
    statusSelect.setAttribute('data-index', index);
    
    // Define status options
    const statuses = [
        { value: 'reviewing', text: 'Reviewing', color: '#f39c12' },
        { value: 'applied', text: 'Applied', color: '#3498db' },
        { value: 'interviewing', text: 'Interviewing', color: '#9b59b6' },
        { value: 'offer', text: 'Offer Received', color: '#2ecc71' },
        { value: 'rejected', text: 'Rejected', color: '#e74c3c' },
        { value: 'accepted', text: 'Accepted', color: '#27ae60' },
        { value: 'declined', text: 'Declined', color: '#7f8c8d' }
    ];
    
    // Add options to select
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status.value;
        option.textContent = status.text;
        
        // Set selected if job has this status
        if (job.status === status.value) {
            option.selected = true;
        }
        
        statusSelect.appendChild(option);
    });
    
    // Default to 'reviewing' if no status is set
    if (!job.status) {
        statusSelect.value = 'reviewing';
    }
    
    // Add event listener to status select
    statusSelect.addEventListener('change', (e) => {
        e.stopPropagation(); // Prevent parent click
        updateJobStatus(index, e.target.value);
    });
    
    // Add elements to container
    statusContainer.appendChild(statusLabel);
    statusContainer.appendChild(statusSelect);
    
    // Add status color indicator
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'status-indicator';
    const currentStatus = statuses.find(s => s.value === (job.status || 'reviewing'));
    statusIndicator.style.backgroundColor = currentStatus.color;
    statusContainer.appendChild(statusIndicator);
    
    // Add status container before job-item-actions
    jobItem.insertBefore(statusContainer, jobActions);
    
    // Update job item appearance based on status
    updateJobItemAppearance(jobItem, job.status || 'reviewing');
}

// Update job status
function updateJobStatus(jobIndex, newStatus) {
    const savedJobs = getSavedJobs();
    
    if (savedJobs[jobIndex]) {
        // Update job status
        savedJobs[jobIndex].status = newStatus;
        
        // Save updated jobs
        const success = setStorageData(STORAGE_KEYS.SAVED_JOBS, savedJobs);
        
        if (success) {
            // Update visual appearance
            const jobItem = document.querySelector(`.job-item[data-index="${jobIndex}"]`);
            if (jobItem) {
                updateJobItemAppearance(jobItem, newStatus);
                
                // Update status indicator color
                const statusIndicator = jobItem.querySelector('.status-indicator');
                const statuses = [
                    { value: 'reviewing', color: '#f39c12' },
                    { value: 'applied', color: '#3498db' },
                    { value: 'interviewing', color: '#9b59b6' },
                    { value: 'offer', color: '#2ecc71' },
                    { value: 'rejected', color: '#e74c3c' },
                    { value: 'accepted', color: '#27ae60' },
                    { value: 'declined', color: '#7f8c8d' }
                ];
                
                const currentStatus = statuses.find(s => s.value === newStatus);
                if (statusIndicator && currentStatus) {
                    statusIndicator.style.backgroundColor = currentStatus.color;
                }
            }
            
            // Track this status change
            if (typeof trackEvent === 'function') {
                trackEvent('update_job_status', {
                    job_title: savedJobs[jobIndex].title || 'Unknown',
                    new_status: newStatus
                });
            }
        }
    }
}

// Update job item appearance based on status
function updateJobItemAppearance(jobItem, status) {
    // Remove any existing status classes
    const statusClasses = ['status-reviewing', 'status-applied', 'status-interviewing', 
                           'status-offer', 'status-rejected', 'status-accepted', 'status-declined'];
    
    jobItem.classList.remove(...statusClasses);
    
    // Add appropriate status class
    jobItem.classList.add(`status-${status}`);
}

// Show job details modal
function showJobDetails(job, index) {
    // Track this viewing
    if (typeof trackEvent === 'function') {
        trackEvent('view_job_details', { 
            job_title: job.title,
            company: job.company
        });
    }
    
    // Create shortened description (first 300 chars)
    const shortDescription = job.description && job.description.length > 300 
        ? job.description.substring(0, 300) + '...' 
        : job.description || 'No description available';
    
    // Show modal with job details
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2>${job.title || 'Untitled Position'}</h2>
            <p><strong>Company:</strong> ${job.company || 'Not specified'}</p>
            <p><strong>Location:</strong> ${job.location || 'Not specified'}</p>
            ${job.url ? `<p><strong>URL:</strong> <a href="${job.url}" target="_blank">${job.url}</a></p>` : ''}
            <div class="job-description-preview">
                <h3>Description Preview:</h3>
                <p>${shortDescription}</p>
            </div>
            <div class="modal-buttons">
                <button id="view-full-description" class="secondary-button">View Full Description</button>
                ${job.url ? `<button id="open-original" class="primary-button">Open Original Page</button>` : ''}
                <button id="close-details" class="default-button">Close</button>
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.appendChild(modal);
    
    // Show modal with fade-in effect
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // Set up close button
    modal.querySelector('.close-modal').addEventListener('click', () => {
        closeModal(modal);
    });
    
    // Set up close details button
    const closeButton = modal.querySelector('#close-details');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            closeModal(modal);
        });
    }
    
    // Set up view full description button
    const viewFullDescriptionButton = modal.querySelector('#view-full-description');
    if (viewFullDescriptionButton) {
        viewFullDescriptionButton.addEventListener('click', () => {
            showFullDescription(job.description || 'No description available');
        });
    }
    
    // Set up open original button
    const openOriginalButton = modal.querySelector('#open-original');
    if (openOriginalButton) {
        openOriginalButton.addEventListener('click', () => {
            if (job.url) {
                window.open(job.url, '_blank');
            } else {
                alert('Original URL not available');
            }
        });
    }
    
    // Close when clicking outside the modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
}

// Remove selected job
function removeSelectedJob() {
    const selectedJob = document.querySelector('.job-item.selected');
    
    if (selectedJob) {
        const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
        
        // Confirm before removing
        const confirmModal = showModal(
            'Confirm Removal', 
            'Are you sure you want to remove this job?',
            [
                {
                    id: 'cancel-remove',
                    text: 'Cancel',
                    class: 'secondary-button'
                },
                {
                    id: 'confirm-remove',
                    text: 'Remove',
                    class: 'danger-button',
                    action: () => {
                        const success = removeJob(jobIndex);
                        
                        if (success) {
                            loadSavedJobs();
                            
                            const jobActions = document.getElementById('job-actions');
                            if (jobActions) {
                                jobActions.classList.add('hidden');
                            }
                            
                            // Track job removal
                            if (typeof trackEvent === 'function') {
                                trackEvent('remove_job');
                            }
                        } else {
                            showModal('Error', 'There was an error removing the job. Please try again.');
                        }
                    }
                }
            ]
        );
    }
}

// Save job from form input
function saveJobFromForm() {
    const jobTitle = document.getElementById('job-title').value.trim();
    const jobCompany = document.getElementById('job-company').value.trim();
    const jobLocation = document.getElementById('job-location').value.trim();
    const jobUrl = document.getElementById('job-url').value.trim();
    const jobDescription = document.getElementById('job-description').value.trim();
    
    if (!jobTitle || !jobCompany || !jobDescription) {
        showModal('Missing Information', 'Please fill in at least the job title, company, and description.');
        return;
    }
    
    const jobData = {
        title: jobTitle,
        company: jobCompany,
        location: jobLocation,
        url: jobUrl,
        description: jobDescription,
        dateAdded: new Date().toISOString(),
        status: 'reviewing' // Default status
    };
    
    // Save the job
    const success = saveJob(jobData);
    
    if (success) {
        // Clear the form
        document.getElementById('job-title').value = '';
        document.getElementById('job-company').value = '';
        document.getElementById('job-location').value = '';
        document.getElementById('job-url').value = '';
        document.getElementById('job-description').value = '';
        
        // Refresh the job list
        loadSavedJobs();
        
        // Show success message
        showModal('Job Saved', 'The job has been saved successfully.');
        
        // Track job save
        if (typeof trackEvent === 'function') {
            trackEvent('job_saved', {
                job_title: jobData.title,
                company: jobData.company,
                location: jobData.location,
                url: jobData.url,
                source: 'web_app',
                description_snippet: jobData.description.substring(0, 200) + (jobData.description.length > 200 ? '...' : '')
            });
        }
    } else {
        showModal('Error', 'There was an error saving the job. Please try again.');
    }
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

function initializeToggles() {
    const toggles = document.querySelectorAll('.toggle-header');
    
    toggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isActive = this.classList.contains('active');
            
            // Toggle this section
            this.classList.toggle('active');
            content.classList.toggle('active');
            
            // Track toggle
            if (typeof trackEvent === 'function') {
                trackEvent('toggle_section', { 
                    section: this.textContent.trim(),
                    action: isActive ? 'close' : 'open'
                });
            }
        });
    });
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);