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

    // Check if this is the first visit and show welcome guidance
    showFirstTimeGuidance();
    
    // Track page view
    trackEvent('web_app_page_view', { 
        page_title: document.title,
        page_location: window.location.href
    });
    
    console.log('Job Hunter Web App initialized');
}

let currentPage = 1;
const jobsPerPage = 5;
let currentFilter = 'all';

// Auth state management
function handleAuthStateChange(user) {
    const authStatusDiv = document.getElementById('auth-status'); // In Profile Tab
    
    if (user) {
        console.log('User signed in (app.js handleAuthStateChange):', user.email);
        window.currentUser = user;
        
        // This function will now handle fetching user data and updating subscription UI
        displayUserProfile(user); 
        
        updateTabContentForAuthState(true);
        
        if (authStatusDiv) { // From your existing app.js logic for profile tab auth status
            authStatusDiv.innerHTML = `
                <p>Signed in as: <strong>${user.email}</strong></p>
                <p>User ID: <small>${user.uid}</small></p>
                <button id="sign-out-profile-appjs" class="secondary-button">Sign Out from Profile Tab</button>
            `;
            const signOutBtnAppJs = document.getElementById('sign-out-profile-appjs');
            if (signOutBtnAppJs) {
                signOutBtnAppJs.addEventListener('click', async () => {
                    if (window.signOut) await window.signOut();
                });
            }
        }
        
        // Track sign-in
        if (typeof trackEvent === 'function') { // Ensure trackEvent is available
            trackEvent('user_session_start', { 
                user_id: user.uid,
                email: user.email
            });
        }
    } else {
        console.log('User signed out (app.js handleAuthStateChange)');
        if (window.currentUser && window.firestoreUnsubscribeUser && window.firestoreUnsubscribeUser[window.currentUser.uid]) {
            console.log(`[Firestore] Unsubscribing listener for user ${window.currentUser.uid} on sign-out.`);
            window.firestoreUnsubscribeUser[window.currentUser.uid](); // Unsubscribe from the listener
            delete window.firestoreUnsubscribeUser[window.currentUser.uid]; // Clean up
        }
        window.currentUser = null;
        
        if (authStatusDiv) { // From your existing app.js logic for profile tab auth status
            authStatusDiv.innerHTML = `
                <p>📱 Sign in to sync across devices and manage your subscription.</p>
                <button id="sign-in-profile-appjs" class="primary-button">Sign In with Google</button>
            `;
            const signInBtnAppJs = document.getElementById('sign-in-profile-appjs');
            if (signInBtnAppJs) {
                signInBtnAppJs.addEventListener('click', () => {
                    if(window.signInWithGoogle) window.signInWithGoogle();
                });
            }
        }
        
        if (typeof window.updateUserSubscriptionUI === 'function') {
            window.updateUserSubscriptionUI(null); // Clear subscription UI for signed-out user
        }
        updateTabContentForAuthState(false);
    }
}

// Expose handleAuthStateChange to global scope so firebase-config.js can call it
window.handleAuthStateChange = handleAuthStateChange;
// Ensure firebase-config.js uses window.handleAppAuthStateChange or rename this to window.handleAuthStateChange

// Object to store unsubscribe functions for Firestore listeners
window.firestoreUnsubscribeUser = {};

// Function to display user profile details including subscription
async function displayUserProfile(user) {
    if (window.db && user && window.firestoreExports && window.firestoreExports.onSnapshot) {
        try {
            const userDocRef = window.firestoreExports.doc(window.db, "users", user.uid);

            // Unsubscribe from any previous listener for this user to avoid multiple listeners
            if (window.firestoreUnsubscribeUser[user.uid]) {
                console.log(`[Firestore] Unsubscribing previous listener for user ${user.uid}`);
                window.firestoreUnsubscribeUser[user.uid](); // Call the unsubscribe function
            }

            // Set up a new real-time listener
            console.log(`[Firestore] Setting up onSnapshot listener for user ${user.uid}`);
            window.firestoreUnsubscribeUser[user.uid] = window.firestoreExports.onSnapshot(
                userDocRef, 
                (docSnapshot) => { // Renamed 'doc' to 'docSnapshot' to avoid conflict if 'doc' function is in scope
                    if (docSnapshot.exists()) {
                        const userDataFromFirestore = docSnapshot.data();
                        console.log("[Firestore] User data updated via onSnapshot:", userDataFromFirestore);

                        // Convert Firestore timestamps for subscription fields
                        if (userDataFromFirestore.subscription) {
                            const sub = userDataFromFirestore.subscription;
                            const dateFields = ['current_period_ends_at', 'current_period_starts_at', 'cancellation_effective_date', 'updated_at'];
                            dateFields.forEach(field => {
                                if (sub[field] && typeof sub[field].toDate === 'function') {
                                    sub[field] = sub[field].toDate();
                                }
                            });
                        }
                        
                        if (typeof window.updateUserSubscriptionUI === 'function') {
                            window.updateUserSubscriptionUI(userDataFromFirestore);
                        }
                    } else {
                        console.log("[Firestore] User document does not exist (onSnapshot). User might be new or data deleted.");
                        // Handle case where user doc might not exist yet.
                        // Backend's get_or_create_user should create it.
                        // For UI, assume free tier until data appears.
                        if (typeof window.updateUserSubscriptionUI === 'function') {
                            window.updateUserSubscriptionUI({ subscription: { tier: 'free', status: 'active' } });
                        }
                    }
                },
                (error) => {
                    console.error("[Firestore] Error in onSnapshot listener for user profile:", error);
                    // Optionally, handle the error more gracefully in the UI
                    if (typeof window.updateUserSubscriptionUI === 'function') {
                        window.updateUserSubscriptionUI(null); // Show default on error
                    }
                }
            );

        } catch (error) {
            console.error("Error setting up onSnapshot listener for user profile:", error);
            if (typeof window.updateUserSubscriptionUI === 'function') {
                window.updateUserSubscriptionUI(null); // Show default free state on error
            }
        }
    } else {
        console.warn("[Firestore] Cannot display user profile: Firebase DB, user, onSnapshot, or firestoreExports not available.");
        if (typeof window.updateUserSubscriptionUI === 'function') {
            window.updateUserSubscriptionUI(null); // No user or DB, show default free state
        }
    }
}

// Update tab content based on auth state
function updateTabContentForAuthState(isSignedIn) {
    // Store auth state globally for tab click handling
    window.isUserSignedIn = isSignedIn;
}

// Check if tab requires sign-in and show modal if needed
function checkTabAccess(tabName) {
    const restrictedTabs = ['insights', 'learning'];
    
    if (!window.isUserSignedIn && restrictedTabs.includes(tabName)) {
        showSignInRequiredModal(tabName);
        return false; // Prevent tab switch
    }
    return true; // Allow tab switch
}

// Show sign-in required modal
function showSignInRequiredModal(tabName) {
    const tabDisplayNames = {
        'insights': 'Career Insights',
        'learning': 'Learning Dashboard'
    };
    
    const modal = showModal(
        '🔒 Sign In Required',
        `To access ${tabDisplayNames[tabName]}, you need to sign in. This feature requires your saved jobs and profile data to provide personalized recommendations.`,
        [
            {
                id: 'sign-in-modal',
                text: 'Sign In with Google',
                class: 'primary-button',
                action: () => {
                    window.signInWithGoogle();
                }
            },
            {
                id: 'cancel-modal',
                text: 'Cancel',
                class: 'secondary-button'
            }
        ]
    );
}

// Make checkTabAccess global so ui.js can use it
window.checkTabAccess = checkTabAccess;

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
            
            // Track profile save
            trackEvent('profile_saved', { 
                action: 'save_profile'
            });
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
            
            // Track refresh jobs
            trackEvent('refresh_jobs');
            
            // Add a small delay to show the loading message
            setTimeout(() => {
                loadSavedJobs();
            }, 300);
        });
    }
    
    // Set up add job button
    const addNewJobBtn = document.getElementById('add-new-job-btn');
    if (addNewJobBtn) {
        addNewJobBtn.addEventListener('click', function() {
            // Scroll to the job entry form
            const jobEntrySection = document.querySelector('.job-entry-section');
            if (jobEntrySection) {
                jobEntrySection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    //Set up remove job button
    // This button should be hidden by default and only shown when a job is selected
    const removeJobButton = document.getElementById('remove-job');
    if (removeJobButton) {
        removeJobButton.addEventListener('click', function() {
            // Track job removal click
            trackEvent('remove_job_click');
            removeSelectedJob();
        });
    }

    // Set up status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentFilter = this.value;
            currentPage = 1; // Reset to first page when filter changes
            loadSavedJobs();
            
            // Track filter usage
            trackEvent('filter_jobs_by_status', { status: currentFilter });
        });
    }

    // Set up pagination buttons
    const prevPageBtn = document.getElementById('prev-page');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                loadSavedJobs();
                
                // Track pagination usage
                trackEvent('pagination_click', { direction: 'prev', page: currentPage });
            }
        });
    }

    const nextPageBtn = document.getElementById('next-page');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            const savedJobs = getSavedJobs();
            let filteredJobs = savedJobs;
            
            if (currentFilter !== 'all') {
                filteredJobs = savedJobs.filter(job => job.status === currentFilter);
            }
            
            const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
            
            if (currentPage < totalPages) {
                currentPage++;
                loadSavedJobs();
                
                // Track pagination usage
                trackEvent('pagination_click', { direction: 'next', page: currentPage });
            }
        });
    }

    // Add listeners for subscription buttons
    setupSubscriptionButtonListeners();
}

// Function to set up listeners for subscribe buttons
function setupSubscriptionButtonListeners() {
    const subscribeButtons = document.querySelectorAll('.subscribe-button');
    subscribeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const planIdentifier = this.dataset.plan;
            if (planIdentifier && typeof window.initializePaystackTransaction === 'function') {
                const planMessageElement = document.getElementById('user-plan-message');
                if (planMessageElement) planMessageElement.textContent = ''; // Clear previous messages
                window.initializePaystackTransaction(planIdentifier);
            } else {
                console.error('Plan identifier missing or initializePaystackTransaction not found for plan:', planIdentifier);
                if (typeof showModal === 'function') showModal("Error", "Could not process subscription request for this plan.");
            }
        });
    });
}

// Show first-time guidance modal for new users
function showFirstTimeGuidance() {
    // Check if user has seen the guidance
    const hasSeenGuidance = getStorageData('hasSeenGuidance', false);
    
    if (!hasSeenGuidance) {
        // Create modal element
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'welcome-guidance-modal';
        
        // Add modal content
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h2>Welcome to JobHunter!</h2>
                <div class="welcome-guidance">
                    <div class="welcome-content-scrollable">
                        <p>JobHunter helps you find and apply for jobs more efficiently. Here's how to get started:</p>
                        
                        <h4>1. Set Up Your Profile</h4>
                        <p>Go to the Profile tab and paste your CV/resume text. This information will be used to generate tailored applications.</p>
                        
                        <h4>2. Find Jobs</h4>
                        <p>Use the Find Jobs tab to search for opportunities across LinkedIn, job boards, and document sites.</p>
                        
                        <h4>3. Save Jobs</h4>
                        <p>When you find a job, copy the details and save it in the Apply tab.</p>
                        
                        <h4>4. Generate Documents</h4>
                        <p>Use either:</p>
                        <ul>
                            <li><strong>Auto Generation</strong>: One-click CV and cover letter generation (no account needed)</li>
                            <li><strong>Manual Generation</strong>: Copy our prompt to Claude for more customization</li>
                        </ul>
                        
                        <h4>5. Using Claude for Manual Generation</h4>
                        <p>When using the manual process with Claude:</p>
                        <ol>
                            <li>Click "Generate CV" or "Generate Cover Letter"</li>
                            <li>Paste the copied prompt into Claude</li>
                            <li>Claude will generate a CV in JSON format or a cover letter</li>
                            <li>Copy the JSON content (from Claude's artifact or the JSON between curly braces)</li>
                            <li>Go to the Profile tab and paste it in the "Tailored JSON" field</li>
                            <li>Click "Preview CV" to see your tailored CV</li>
                        </ol>
                        
                        <h4>6. Career Insights</h4>
                        <p>After generating a CV, check the Career Insights tab to:</p>
                        <ul>
                            <li>See how well your skills match the job requirements</li>
                            <li>Identify skill gaps to improve your chances</li>
                            <li>Get personalized learning recommendations</li>
                            <li>View which of your experiences are most relevant</li>
                        </ul>
                        
                        <h4>7. Learning Dashboard</h4>
                        <p>Use the Learning tab to create and track personalized learning plans based on the skill gaps identified in Career Insights.</p>
                        
                        <p class="notes">Your data is saved in your browser. If you clear your browser data, you'll lose it.</p>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button id="got-it-btn" class="primary-button welcome-button">Got it!</button>
                </div>
            </div>
        `;
        
        // Add modal to document
        document.body.appendChild(modal);
        
        // Show modal with slight delay to allow CSS transitions
        setTimeout(() => {
            modal.classList.add('active');
        }, 50);
        
        // Set up close button
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeModal(modal);
                // Mark guidance as seen
                setStorageData('hasSeenGuidance', true);
            });
        }
        
        // Set up Got it button
        const gotItBtn = document.getElementById('got-it-btn');
        if (gotItBtn) {
            gotItBtn.addEventListener('click', () => {
                closeModal(modal);
                // Mark guidance as seen
                setStorageData('hasSeenGuidance', true);
            });
        }
        
        // Track this event
        if (typeof trackEvent === 'function') {
            trackEvent('first_time_guidance_shown');
        }
    }
}

// Load saved jobs from storage and display in the UI
function loadSavedJobs() {
    const savedJobsList = document.getElementById('saved-jobs-list');
    const jobActions = document.getElementById('job-actions');
    const paginationControls = document.querySelector('.pagination-controls');
    
    if (!savedJobsList) return;
    
    const savedJobs = getSavedJobs();
    
    // Apply status filter
    let filteredJobs = savedJobs;
    if (currentFilter !== 'all') {
        filteredJobs = savedJobs.filter(job => job.status === currentFilter);
    } else {
        // When showing all statuses, sort by priority
        filteredJobs = [...savedJobs].sort((a, b) => {
            // Define status priority (lower number = higher priority)
            const statusPriority = {
                'accepted': 1,
                'offer': 2,
                'interviewing': 3,
                'reviewing': 4,
                'applied': 5,
                'rejected': 6,
                'declined': 7
            };
            
            // Get priority for each job's status (default to lowest priority if undefined)
            const priorityA = statusPriority[a.status || 'reviewing'] || 999;
            const priorityB = statusPriority[b.status || 'reviewing'] || 999;
            
            // Sort by priority first
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            // If same priority, sort by date added (newest first)
            const dateA = new Date(a.dateAdded || 0);
            const dateB = new Date(b.dateAdded || 0);
            return dateB - dateA;
        });
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    const startIndex = (currentPage - 1) * jobsPerPage;
    const endIndex = Math.min(startIndex + jobsPerPage, filteredJobs.length);
    const jobsToShow = filteredJobs.slice(startIndex, endIndex);
    
    // Update pagination controls
    const pageInfo = document.getElementById('page-info');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    }
    
    const prevPageBtn = document.getElementById('prev-page');
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage <= 1;
    }
    
    const nextPageBtn = document.getElementById('next-page');
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    // Show/hide pagination controls based on job count
    if (paginationControls) {
        if (filteredJobs.length > jobsPerPage) {
            paginationControls.classList.remove('hidden');
        } else {
            paginationControls.classList.add('hidden');
        }
    }
    
    if (jobsToShow.length > 0) {
        // Clear empty state
        savedJobsList.innerHTML = '';
        
        // Add job items for current page
        jobsToShow.forEach((job) => {
            const actualIndex = savedJobs.indexOf(job); // Get original index for actions
            
            const jobItem = document.createElement('div');
            jobItem.className = 'job-item';
            jobItem.setAttribute('data-index', actualIndex);
            
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
                
                // Dispatch a custom event for job selection
                // This will be used by the insights tab to update
                const jobSelectedEvent = new CustomEvent('jobSelected', {
                    detail: {
                        jobIndex: actualIndex
                    }
                });
                document.dispatchEvent(jobSelectedEvent);
            });
            
            // Add view details functionality
            const viewDetailsBtn = jobItem.querySelector('.view-details-btn');
            if (viewDetailsBtn) {
                viewDetailsBtn.addEventListener('click', () => {
                    showJobDetails(job, actualIndex);
                });
            }
            
            // Add status tracking
            addStatusTracking(jobItem, job, actualIndex);
            
            savedJobsList.appendChild(jobItem);
        });
    } else {
        if (currentFilter !== 'all') {
            savedJobsList.innerHTML = `<div class="empty-state">No jobs found with status "${currentFilter}". Try another filter.</div>`;
        } else {
            savedJobsList.innerHTML = '<div class="empty-state">No saved jobs yet. Add a new job below.</div>';
        }
        
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
            // Reload jobs to reflect filter and pagination
            loadSavedJobs();
            
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

/**
 * Shows a modal with the full job description text
 * @param {string} description - The full job description text to display
 */
function showFullDescription(description) {
    // Create modal for showing the full description
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content full-description-modal">
            <span class="close-modal">&times;</span>
            <h2>Full Job Description</h2>
            <div class="full-description-content">
                <pre>${description}</pre>
            </div>
            <div class="modal-buttons">
                <button id="close-full-description" class="default-button">Close</button>
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
    
    // Set up close button
    const closeButton = modal.querySelector('#close-full-description');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            closeModal(modal);
        });
    }
    
    // Close when clicking outside the modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
    
    // Track this viewing
    if (typeof trackEvent === 'function') {
        trackEvent('view_full_description');
    }
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
        return null;
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
        
        // Track job save with new function
        trackJobInteraction('job_saved', jobData);
        
        return jobData;
    } else {
        showModal('Error', 'There was an error saving the job. Please try again.');
        return null;
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

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);