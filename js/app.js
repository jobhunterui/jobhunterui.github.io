// Main application controller for the Job Hunter Web App

// Global variable to store current user's subscription details
window.currentUserSubscription = null;

// Initialize the application
function initApp() {
    console.log('Job Hunter Web App initializing...');

    loadSavedJobs();
    loadProfileData();
    setupEventListeners();
    checkStorageUsage();
    showFirstTimeGuidance();
    setupHeaderProfileClick();
    initProfiling();
    initAdminDashboard();

    // Initial UI update based on potential pre-existing auth state
    if (window.auth && window.auth.currentUser) {
        handleAuthStateChange(window.auth.currentUser);
    } else {
        handleAuthStateChange(null);
    }

    if (typeof trackEvent === 'function') {
        trackEvent('web_app_page_view', {
            page_title: document.title,
            page_location: window.location.href
        });
    }

    console.log('Job Hunter Web App initialized');
}

/**
 * Initialize Admin Dashboard
 */
function initAdminDashboard() {
    console.log('Initializing Admin Dashboard...');
    
    // Initialize the AdminDashboard object
    if (typeof AdminDashboard !== 'undefined') {
        AdminDashboard.init();
        
        // Set up tab switching to load admin data
        const adminTabButton = document.querySelector('.tab-button[data-tab="admin"]');
        if (adminTabButton) {
            adminTabButton.addEventListener('click', () => {
                // Double-check admin access when clicking tab
                if (!AdminDashboard.checkAdminAccess()) {
                    // Hide the tab immediately if somehow it was visible but user isn't admin
                    adminTabButton.classList.remove('show-admin');
                    
                    if (window.currentUser) {
                        showModal('Access Denied', 
                            'You do not have administrator privileges. If you believe this is an error, please contact support.',
                            [{ id: 'ok-access-denied', text: 'OK', class: 'default-button' }]
                        );
                    } else {
                        showModal('Sign In Required', 
                            'Please sign in with an administrator account to access the Admin Dashboard.',
                            [
                                { 
                                    id: 'sign-in-admin', 
                                    text: 'Sign In', 
                                    class: 'primary-button', 
                                    action: () => window.signInWithGoogle() 
                                }
                            ]
                        );
                    }
                    return; // Stop execution if not admin
                }
                
                // If user is admin, proceed to load profiles
                setTimeout(() => {
                    AdminDashboard.loadProfiles();
                }, 100);
            });
        }
        
        console.log('Admin Dashboard initialized successfully');
    } else {
        console.warn('AdminDashboard object not found - admin functionality disabled');
    }
}

let currentPage = 1;
const jobsPerPage = 5;
let currentFilter = 'all';

// Auth state management
async function handleAuthStateChange(user) {
    const authStatusDiv = document.getElementById('auth-status'); // In Profile Tab

    if (user) {
        console.log('User signed in (app.js handleAuthStateChange):', user.email);
        window.currentUser = user; // Set global currentUser

        // Fetch full user profile including subscription from backend
        await fetchAndStoreUserProfile();

        updateTabContentForAuthState(true); // Enables tab access checks

        // Update profile tab's auth status display (simplified)
        if (authStatusDiv) {
            authStatusDiv.innerHTML = `
                <p>Signed in as: <strong>${user.email}</strong></p>
                <button id="sign-out-profile-appjs" class="secondary-button">Sign Out</button>
            `;
            const signOutBtnAppJs = document.getElementById('sign-out-profile-appjs');
            if (signOutBtnAppJs) {
                signOutBtnAppJs.addEventListener('click', async () => {
                    if (window.signOut) await window.signOut();
                });
            }
        }

        if (typeof trackEvent === 'function') {
            trackEvent('user_session_start', {
                user_id: user.uid,
                email: user.email
            });
        }
    } else {
        console.log('User signed out (app.js handleAuthStateChange)');
        if (window.currentUser && window.firestoreUnsubscribeUser && window.firestoreUnsubscribeUser[window.currentUser.uid]) {
            console.log(`[Firestore] Unsubscribing listener for user ${window.currentUser.uid} on sign-out.`);
            window.firestoreUnsubscribeUser[window.currentUser.uid]();
            delete window.firestoreUnsubscribeUser[window.currentUser.uid];
        }
        window.currentUser = null;
        window.currentUserSubscription = null; // Clear subscription data

        if (authStatusDiv) {
            authStatusDiv.innerHTML = `
                <p>📱 Sign in to sync across devices and manage your subscription.</p>
                <button id="sign-in-profile-appjs" class="primary-button">Sign In with Google</button>
            `;
            const signInBtnAppJs = document.getElementById('sign-in-profile-appjs');
            if (signInBtnAppJs) {
                signInBtnAppJs.addEventListener('click', () => {
                    if (window.signInWithGoogle) window.signInWithGoogle();
                });
            }
        }

        updateUserSubscriptionUI(null); // Update UI to reflect signed-out state (e.g., free tier)
        updateTabContentForAuthState(false); // Disables tab access checks for restricted tabs
        updateFeatureAccessUI(); // Reset feature UI for signed-out state
    }
}

window.handleAuthStateChange = handleAuthStateChange;
window.firestoreUnsubscribeUser = {};

// Fetch user profile from backend /users/me
async function fetchAndStoreUserProfile() {
    if (!window.currentUser) {
        console.warn("fetchAndStoreUserProfile: No current user, cannot fetch profile.");
        window.currentUserSubscription = null;
        updateUserSubscriptionUI(null);
        updateFeatureAccessUI();
        return;
    }

    try {
        const idToken = await window.currentUser.getIdToken(true);
        // Assuming CV_API_CONFIG is globally available from cv-api.js
        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.userProfilePath}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            console.error("Failed to fetch user profile:", response.status, await response.text());
            window.currentUserSubscription = { tier: 'free', status: 'error_fetching' };
        } else {
            const userProfileData = await response.json();
            console.log("User profile fetched:", userProfileData);
            window.currentUserSubscription = userProfileData.subscription || { tier: 'free', status: 'no_subscription_data' };
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        window.currentUserSubscription = { tier: 'free', status: 'exception_fetching' };
    }
    updateUserSubscriptionUI(window.currentUserSubscription);
    updateFeatureAccessUI();

    // The call to displayUserProfile for onSnapshot listener can still be here
    // if you want real-time updates from Firestore IN ADDITION to the /users/me fetch.
    // However, ensure it doesn't create conflicting states if /users/me is the primary source of truth on load.
    displayUserProfile(window.currentUser); // This will set up the Firestore listener.
}


// Update UI elements based on subscription data
function updateUserSubscriptionUI(subscriptionData) { // Parameter changed from `subscription` to `subscriptionData` to match original file's `displayUserProfile` call
    const planNameEl = document.getElementById('user-current-plan');
    const planExpiryEl = document.getElementById('user-plan-expiry');
    const planExpiryDateEl = document.getElementById('user-plan-expiry-date');
    const planMessageEl = document.getElementById('user-plan-message');
    const upgradeOptionsEl = document.getElementById('subscription-options');
    const manageSubscriptionOptionsEl = document.getElementById('manage-subscription-options');

    if (!planNameEl || !planExpiryEl || !planExpiryDateEl || !planMessageEl || !upgradeOptionsEl || !manageSubscriptionOptionsEl) {
        console.warn("Subscription UI elements not found in Profile tab.");
        return;
    }

    // Reset all
    planMessageEl.textContent = '';
    planExpiryEl.classList.add('hidden');
    upgradeOptionsEl.classList.add('hidden');
    manageSubscriptionOptionsEl.classList.add('hidden');

    // The `subscriptionData` might be the full user data from Firestore snapshot,
    // so we access `subscriptionData.subscription` if it's structured that way.
    // Or, if `WorkspaceAndStoreUserProfile` directly passes the subscription object, this check is fine.
    const subscription = subscriptionData?.subscription || subscriptionData;


    if (window.currentUser && subscription) {
        let tierDisplay = 'Free';
        let isActivePro = false; // Changed from isActivePremium

        if (subscription.tier && subscription.tier.toLowerCase() !== 'free') {
            tierDisplay = `Pro ${subscription.tier.includes('yearly') ? 'Yearly' : subscription.tier.includes('monthly') ? 'Monthly' : ''}`.trim(); // "Pro"
            if (subscription.status === 'active') {
                if (subscription.current_period_ends_at) {
                    const expiryDate = new Date(subscription.current_period_ends_at);
                    if (expiryDate > new Date()) {
                        isActivePro = true;
                        planExpiryDateEl.textContent = expiryDate.toLocaleDateString();
                        planExpiryEl.classList.remove('hidden');
                    } else {
                        planMessageEl.textContent = 'Your Pro plan has expired.'; // "Pro plan"
                        tierDisplay = 'Free (Expired Pro)'; // "Pro"
                    }
                } else {
                    isActivePro = true;
                    planMessageEl.textContent = 'You have an active Pro plan.'; // "Pro plan"
                }
            } else if (subscription.status === 'cancelled' && subscription.cancellation_effective_date) {
                const effectiveCancelDate = new Date(subscription.cancellation_effective_date);
                if (effectiveCancelDate > new Date()) {
                    isActivePro = true;
                    planMessageEl.textContent = `Your Pro plan will be cancelled on ${effectiveCancelDate.toLocaleDateString()}. Access remains until then.`; // "Pro plan"
                    planExpiryDateEl.textContent = effectiveCancelDate.toLocaleDateString();
                    planExpiryEl.classList.remove('hidden');
                } else {
                    planMessageEl.textContent = 'Your Pro plan is cancelled.'; // "Pro plan"
                }
            } else if (subscription.status && subscription.status !== 'active') {
                planMessageEl.textContent = `Subscription status: ${subscription.status}. Please update your payment or contact support.`;
            }
        }
        planNameEl.textContent = tierDisplay;

        if (isActivePro) {
            manageSubscriptionOptionsEl.classList.remove('hidden');
            manageSubscriptionOptionsEl.innerHTML = `<button id="manage-subscription-btn" class="primary-button">Manage Subscription</button>`;
            const manageBtn = document.getElementById('manage-subscription-btn');
            if (manageBtn && window.handleManageSubscription) {
                manageBtn.addEventListener('click', window.handleManageSubscription);
            } else if (manageBtn) {
                manageBtn.addEventListener('click', () => {
                    showModal("Manage Subscription", "Subscription management via Paystack customer portal will be available here. For now, contact support for changes.");
                });
            }
        } else {
            upgradeOptionsEl.classList.remove('hidden');
            if (!window.currentUser) {
                planMessageEl.textContent = "Sign in to subscribe.";
                upgradeOptionsEl.classList.add('hidden');
            }
        }
    } else {
        planNameEl.textContent = 'Free';
        planMessageEl.textContent = window.currentUser ? 'Upgrade to unlock Pro features.' : 'Sign in to view or manage subscriptions.'; // "Pro features"
        if (window.currentUser) {
            upgradeOptionsEl.classList.remove('hidden');
        } else {
            upgradeOptionsEl.classList.add('hidden');
        }
    }
}
window.updateUserSubscriptionUI = updateUserSubscriptionUI;


// Dynamically update UI for pro features
// TEMPORARILY DISABLED: Premium feature UI restrictions - all features now free
// Original function preserved for re-enabling later:
function updateFeatureAccessUI() {
    // const subscription = window.currentUserSubscription;
    // let userHasActivePro = false;

    // if (window.currentUser && subscription && subscription.tier && subscription.tier.toLowerCase() !== 'free' && subscription.status === 'active') {
    //     if (subscription.current_period_ends_at) {
    //         userHasActivePro = new Date(subscription.current_period_ends_at) > new Date();
    //     } else {
    //         userHasActivePro = true;
    //     }
    // }

    const proUiElements = document.querySelectorAll('[data-pro-feature]');

    proUiElements.forEach(element => {
        // const featureName = element.dataset.proFeature;
        // const isGatedBySubscription = true;

        let badge = element.querySelector('.pro-badge');
        if (!badge) {
            const parent = element.closest('.tab-button') || element;
            badge = parent.querySelector('.pro-badge');
        }

        // TEMPORARILY DISABLED: All features now accessible
        // Original premium logic preserved above for re-enabling later
        
        // Always enable all features (no premium restrictions)
        element.disabled = false;
        element.classList.remove('disabled-pro-feature');
        if (badge) badge.classList.add('hidden'); // Hide pro badges

        // Handle CV Upload section specifically
        const featureName = element.dataset.proFeature;
        if (featureName === "cv_upload_and_parse") {
            const cvUploadSection = document.getElementById('cv-upload-section');
            const cvUploadUiContainer = document.getElementById('cv-upload-ui-container');
            const cvUploadSignInMessage = document.getElementById('cv-upload-signin-message');

            if (cvUploadSection && cvUploadUiContainer && cvUploadSignInMessage) {
                cvUploadUiContainer.classList.remove('hidden'); // Always show upload UI
                cvUploadSignInMessage.classList.add('hidden'); // Always hide sign-in message
            }
        }
    });
}
window.updateFeatureAccessUI = updateFeatureAccessUI;
window.updateFeatureAccessUI = updateFeatureAccessUI;

// Function to display user profile details including subscription (from original app.js)
// This sets up the Firestore onSnapshot listener.
async function displayUserProfile(user) {
    // REMOVED FIRESTORE LISTENER - Using backend as single source of truth
    // The subscription data is already fetched and stored via fetchAndStoreUserProfile()
    console.log(`[App] displayUserProfile called for user ${user.uid} - Firestore listener disabled, using backend data`);
}


function updateTabContentForAuthState(isSignedIn) {
    window.isUserSignedIn = isSignedIn;
    updateFeatureAccessUI();
}

// TEMPORARILY DISABLED: Premium tab restrictions - all tabs now free
// Original function preserved for re-enabling later:
function checkTabAccess(tabName) {
    // const restrictedTabsMap = {
    //     'insights': 'Career Insights',
    //     'learning': 'Learning Dashboard'
    // };

    // if (restrictedTabsMap.hasOwnProperty(tabName) && !window.isUserSignedIn) {
    //     showSignInRequiredModal(tabName, restrictedTabsMap[tabName]);
    //     return false;
    // }

    // const subscription = window.currentUserSubscription;
    // let userHasActivePro = false;
    // if (window.isUserSignedIn && subscription && subscription.tier && subscription.tier.toLowerCase() !== 'free' && subscription.status === 'active') {
    //     if (subscription.current_period_ends_at) {
    //         userHasActivePro = new Date(subscription.current_period_ends_at) > new Date();
    //     } else {
    //         userHasActivePro = true;
    //     }
    // }

    // const tabIsProFeature = (tabName === 'insights' || tabName === 'learning');

    // if (tabIsProFeature && !userHasActivePro) {
    //     showModal(
    //         "Upgrade to Pro",
    //         `The "${restrictedTabsMap[tabName]}" tab requires a Pro plan. Please upgrade your plan to access it.`,
    //         [
    //             {
    //                 id: 'upgrade-tab-modal-btn',
    //                 text: 'Upgrade Plan',
    //                 class: 'primary-button',
    //                 action: () => {
    //                     document.querySelector('.tab-button[data-tab="profile"]').click();
    //                     setTimeout(() => {
    //                         document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' });
    //                     }, 100);
    //                 }
    //             },
    //             { id: 'cancel-tab-modal-btn', text: 'Maybe Later', class: 'default-button' }
    //         ]
    //     );
    //     return false;
    // }

    return true; // Always allow tab access - all tabs now free
}
window.checkTabAccess = checkTabAccess;

function showSignInRequiredModal(tabName, tabDisplayName) { // Added tabDisplayName parameter
    showModal(
        '🔒 Sign In Required',
        `To access the "${tabDisplayName}" tab, you need to sign in. This feature uses your saved data to provide personalized content.`,
        [
            { id: 'sign-in-tab-modal', text: 'Sign In with Google', class: 'primary-button', action: () => window.signInWithGoogle() },
            { id: 'cancel-tab-modal', text: 'Cancel', class: 'secondary-button' }
        ]
    );
}

function setupEventListeners() {
    const jobForm = document.getElementById('job-entry-form');
    if (jobForm) jobForm.addEventListener('submit', (e) => { e.preventDefault(); saveJobFromForm(); });

    const saveProfileButton = document.getElementById('save-profile');
    if (saveProfileButton) saveProfileButton.addEventListener('click', () => { saveProfileFromForm(); if (typeof trackEvent === 'function') trackEvent('profile_saved', { action: 'save_profile' }); });

    const refreshJobsButton = document.getElementById('refresh-jobs');
    if (refreshJobsButton) {
        refreshJobsButton.addEventListener('click', () => {
            const list = document.getElementById('saved-jobs-list');
            if (list) list.innerHTML = '<div class="loading-jobs">Refreshing jobs...</div>';
            if (typeof trackEvent === 'function') trackEvent('refresh_jobs');
            setTimeout(() => loadSavedJobs(), 300);
        });
    }

    const addNewJobBtn = document.getElementById('add-new-job-btn');
    if (addNewJobBtn) {
        addNewJobBtn.addEventListener('click', () => {
            document.querySelector('.job-entry-section')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    const removeJobButton = document.getElementById('remove-job');
    if (removeJobButton) removeJobButton.addEventListener('click', () => { if (typeof trackEvent === 'function') trackEvent('remove_job_click'); removeSelectedJob(); });

    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function () {
            currentFilter = this.value;
            currentPage = 1;
            loadSavedJobs();
            if (typeof trackEvent === 'function') trackEvent('filter_jobs_by_status', { status: currentFilter });
        });
    }

    const prevPageBtn = document.getElementById('prev-page');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--; loadSavedJobs(); if (typeof trackEvent === 'function') trackEvent('pagination_click', { direction: 'prev', page: currentPage });
            }
        });
    }

    const nextPageBtn = document.getElementById('next-page');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const savedJobs = getSavedJobs();
            let filteredJobs = (currentFilter !== 'all') ? savedJobs.filter(job => job.status === currentFilter) : savedJobs;
            const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
            if (currentPage < totalPages) {
                currentPage++; loadSavedJobs(); if (typeof trackEvent === 'function') trackEvent('pagination_click', { direction: 'next', page: currentPage });
            }
        });
    }

    const uploadParseCvButton = document.getElementById('upload-parse-cv-btn');
    if (uploadParseCvButton) {
        uploadParseCvButton.addEventListener('click', handleCvUploadAndParse);
    }

    const cvUploadSignInLink = document.getElementById('cv-upload-signin-link');
    if (cvUploadSignInLink) {
        cvUploadSignInLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.signInWithGoogle) window.signInWithGoogle();
        });
    }

    // Career goal radio button listeners with enhanced UI updates
    const careerGoalRadios = document.querySelectorAll('input[name="career-goal"]');
    careerGoalRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                handleCareerGoalSelection(e.target.value);
                
                // Update visual feedback immediately
                if (typeof updateCareerGoalVisualFeedback === 'function') {
                    updateCareerGoalVisualFeedback();
                }
            }
        });
    });

    // Add click handlers for the entire goal option cards
    const goalOptions = document.querySelectorAll('.career-goal-option');
    goalOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            // Don't trigger if clicking on feature links
            if (e.target.classList.contains('feature-link')) {
                return;
            }
            
            const radio = option.querySelector('input[type="radio"]');
            if (radio && !radio.checked) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }
        });
    });

    setupSubscriptionButtonListeners();
}

function setupSubscriptionButtonListeners() {
    const planContainer = document.getElementById('subscription-options');
    if (planContainer) {
        planContainer.addEventListener('click', function (event) {
            const button = event.target.closest('.subscribe-button');
            if (button) {
                const planIdentifier = button.dataset.plan;
                if (window.currentUser) {
                    if (planIdentifier && typeof window.initializePaystackTransaction === 'function') {
                        const planMessageElement = document.getElementById('user-plan-message');
                        if (planMessageElement) planMessageElement.textContent = '';
                        window.initializePaystackTransaction(planIdentifier);
                    } else {
                        console.error('Plan identifier missing or Paystack init function not found for plan:', planIdentifier);
                        if (typeof showModal === 'function') showModal("Error", "Could not process subscription request.");
                    }
                } else {
                    showModal("Sign In Required", "Please sign in to subscribe to a plan.", [
                        { id: 'sign-in-subscribe', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
                    ]);
                }
            }
        });
    }
}

function loadSavedJobs() {
    const savedJobsList = document.getElementById('saved-jobs-list');
    const jobActions = document.getElementById('job-actions');
    const paginationControls = document.querySelector('.pagination-controls');

    if (!savedJobsList) return;

    const savedJobs = getSavedJobs();

    let filteredJobs = savedJobs;
    if (currentFilter !== 'all') {
        filteredJobs = savedJobs.filter(job => job.status === currentFilter);
    } else {
        filteredJobs = [...savedJobs].sort((a, b) => {
            const statusPriority = { 'accepted': 1, 'offer': 2, 'interviewing': 3, 'reviewing': 4, 'applied': 5, 'rejected': 6, 'declined': 7 };
            const priorityA = statusPriority[a.status || 'reviewing'] || 999;
            const priorityB = statusPriority[b.status || 'reviewing'] || 999;
            if (priorityA !== priorityB) return priorityA - priorityB;
            return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
        });
    }

    const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

    const startIndex = (currentPage - 1) * jobsPerPage;
    const endIndex = Math.min(startIndex + jobsPerPage, filteredJobs.length);
    const jobsToShow = filteredJobs.slice(startIndex, endIndex);

    const pageInfo = document.getElementById('page-info');
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;

    const prevPageBtn = document.getElementById('prev-page');
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;

    const nextPageBtn = document.getElementById('next-page');
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;

    if (paginationControls) paginationControls.classList.toggle('hidden', filteredJobs.length <= jobsPerPage);

    if (jobsToShow.length > 0) {
        savedJobsList.innerHTML = '';
        jobsToShow.forEach((job) => {
            const actualIndex = savedJobs.indexOf(job);
            const jobItem = document.createElement('div');
            jobItem.className = 'job-item';
            jobItem.setAttribute('data-index', actualIndex);
            const displayUrl = job.url ? (job.url.length > 40 ? job.url.substring(0, 37) + '...' : job.url) : 'URL not available';
            jobItem.innerHTML = `
                <div class="job-title">${job.title || 'Untitled Position'}</div>
                <div class="job-company">${job.company || 'Company not specified'}</div>
                <div class="job-location">${job.location || 'Not specified'}</div>
                <div class="job-url"><a href="${job.url}" target="_blank" title="${job.url}">${displayUrl}</a></div>
                <div class="job-item-actions">
                    <button class="view-details-btn default-button">View Details</button>
                </div>`;

            jobItem.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('select')) return;
                document.querySelectorAll('.job-item.selected').forEach(item => item.classList.remove('selected'));
                jobItem.classList.add('selected');
                if (jobActions) jobActions.classList.remove('hidden');
                document.dispatchEvent(new CustomEvent('jobSelected', { detail: { jobIndex: actualIndex } }));
            });

            const viewDetailsBtn = jobItem.querySelector('.view-details-btn');
            if (viewDetailsBtn) viewDetailsBtn.addEventListener('click', () => showJobDetails(job, actualIndex));
            addStatusTracking(jobItem, job, actualIndex);
            savedJobsList.appendChild(jobItem);
        });
    } else {
        savedJobsList.innerHTML = `<div class="empty-state">${currentFilter !== 'all' ? `No jobs found with status "${currentFilter}".` : 'No saved jobs yet. Add a new job below.'}</div>`;
        if (jobActions) jobActions.classList.add('hidden');
    }
}

function addStatusTracking(jobItem, job, index) {
    const jobActionsContainer = jobItem.querySelector('.job-item-actions');
    const statusContainer = document.createElement('div');
    statusContainer.className = 'job-status-container';
    const statusLabel = document.createElement('span');
    statusLabel.className = 'status-label';
    statusLabel.textContent = 'Status: ';
    const statusSelect = document.createElement('select');

    statusSelect.className = 'job-status-select';
    statusSelect.setAttribute('data-index', index);
    const statuses = [
        { value: 'reviewing', text: 'Reviewing', color: '#f39c12' }, { value: 'applied', text: 'Applied', color: '#3498db' },
        { value: 'interviewing', text: 'Interviewing', color: '#9b59b6' }, { value: 'offer', text: 'Offer Received', color: '#2ecc71' },
        { value: 'rejected', text: 'Rejected', color: '#e74c3c' }, { value: 'accepted', text: 'Accepted', color: '#27ae60' },
        { value: 'declined', text: 'Declined', color: '#7f8c8d' }
    ];
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status.value; option.textContent = status.text;
        if (job.status === status.value) option.selected = true;
        statusSelect.appendChild(option);
    });
    if (!job.status) statusSelect.value = 'reviewing';
    statusSelect.addEventListener('change', (e) => { e.stopPropagation(); updateJobStatus(index, e.target.value); });
    statusContainer.appendChild(statusLabel); statusContainer.appendChild(statusSelect);
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'status-indicator';
    const currentStatus = statuses.find(s => s.value === (job.status || 'reviewing'));
    if (currentStatus) statusIndicator.style.backgroundColor = currentStatus.color;
    statusContainer.appendChild(statusIndicator);
    jobItem.insertBefore(statusContainer, jobActionsContainer);
    updateJobItemAppearance(jobItem, job.status || 'reviewing');
}

function updateJobStatus(jobIndex, newStatus) {
    const savedJobs = getSavedJobs();
    if (savedJobs[jobIndex]) {
        savedJobs[jobIndex].status = newStatus;
        if (setStorageData(STORAGE_KEYS.SAVED_JOBS, savedJobs)) {
            loadSavedJobs();
            if (typeof trackEvent === 'function') trackEvent('update_job_status', { job_title: savedJobs[jobIndex].title || 'Unknown', new_status: newStatus });
        }
    }
}

function updateJobItemAppearance(jobItem, status) {
    const statusClasses = ['status-reviewing', 'status-applied', 'status-interviewing', 'status-offer', 'status-rejected', 'status-accepted', 'status-declined'];
    jobItem.classList.remove(...statusClasses);
    jobItem.classList.add(`status-${status}`);
}

function showJobDetails(job, index) {
    if (typeof trackEvent === 'function') trackEvent('view_job_details', { job_title: job.title, company: job.company });
    const shortDescription = job.description && job.description.length > 300 ? job.description.substring(0, 300) + '...' : job.description || 'No description available';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span><h2>${job.title || 'Untitled Position'}</h2>
            <p><strong>Company:</strong> ${job.company || 'Not specified'}</p>
            <p><strong>Location:</strong> ${job.location || 'Not specified'}</p>
            ${job.url ? `<p><strong>URL:</strong> <a href="${job.url}" target="_blank">${job.url}</a></p>` : ''}
            <div class="job-description-preview"><h3>Description Preview:</h3><p>${shortDescription.replace(/\n/g, "<br>")}</p></div>
            <div class="modal-buttons">
                <button id="view-full-description" class="secondary-button">View Full Description</button>
                ${job.url ? `<button id="open-original" class="primary-button">Open Original Page</button>` : ''}
                <button id="close-details" class="default-button">Close</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    modal.querySelector('.close-modal').addEventListener('click', () => closeModal(modal));
    const closeButton = modal.querySelector('#close-details');
    if (closeButton) closeButton.addEventListener('click', () => closeModal(modal));
    const viewFullDescButton = modal.querySelector('#view-full-description');
    if (viewFullDescButton) viewFullDescButton.addEventListener('click', () => showFullDescription(job.description || 'No description available'));
    const openOriginalButton = modal.querySelector('#open-original');
    if (openOriginalButton) openOriginalButton.addEventListener('click', () => { if (job.url) window.open(job.url, '_blank'); else alert('Original URL not available'); });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
}

function showFullDescription(description) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content full-description-modal">
            <span class="close-modal">&times;</span><h2>Full Job Description</h2>
            <div class="full-description-content"><pre>${description}</pre></div>
            <div class="modal-buttons"><button id="close-full-description" class="default-button">Close</button></div>
        </div>`;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    modal.querySelector('.close-modal').addEventListener('click', () => closeModal(modal));
    const closeButton = modal.querySelector('#close-full-description');
    if (closeButton) closeButton.addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    if (typeof trackEvent === 'function') trackEvent('view_full_description');
}

function removeSelectedJob() {
    const selectedJobItem = document.querySelector('.job-item.selected');
    if (selectedJobItem) {
        const jobIndex = parseInt(selectedJobItem.getAttribute('data-index'));
        showModal('Confirm Removal', 'Are you sure you want to remove this job?', [
            { id: 'cancel-remove', text: 'Cancel', class: 'secondary-button' },
            {
                id: 'confirm-remove', text: 'Remove', class: 'danger-button', action: () => {
                    if (removeJob(jobIndex)) {
                        loadSavedJobs();
                        const jobActions = document.getElementById('job-actions');
                        if (jobActions) jobActions.classList.add('hidden');
                        if (typeof trackEvent === 'function') trackEvent('remove_job');
                    } else {
                        showModal('Error', 'There was an error removing the job.');
                    }
                }
            }
        ]);
    }
}

function saveJobFromForm() {
    const jobTitle = document.getElementById('job-title').value.trim();
    const jobCompany = document.getElementById('job-company').value.trim();
    const jobDescription = document.getElementById('job-description').value.trim();
    if (!jobTitle || !jobCompany || !jobDescription) {
        showModal('Missing Information', 'Please fill in Job Title, Company, and Description.'); return null;
    }
    const jobData = {
        title: jobTitle, company: jobCompany,
        location: document.getElementById('job-location').value.trim(),
        url: document.getElementById('job-url').value.trim(),
        description: jobDescription, dateAdded: new Date().toISOString(), status: 'reviewing'
    };
    if (saveJob(jobData)) {
        document.getElementById('job-entry-form').reset();
        loadSavedJobs();
        showModal('Job Saved', 'The job has been saved successfully.');
        if (typeof trackJobInteraction === 'function') trackJobInteraction('job_saved', jobData);
        return jobData;
    } else {
        showModal('Error', 'There was an error saving the job. Please try again.'); return null;
    }
}

// Career goal selection handlers
function handleCareerGoalSelection(goalType) {
    if (saveCareerGoal(goalType)) {
        updateCareerGoalUI();
        
        // Track goal selection for analytics (no modal)
        if (typeof trackEvent === 'function') {
            trackEvent('career_goal_selected', {
                goal_type: goalType,
                goal_title: CAREER_GOALS[goalType].title
            });
        }
    }
}

function updateCareerGoalUI() {
    const currentGoal = getCurrentCareerGoal();
    const goalRadios = document.querySelectorAll('input[name="career-goal"]');
    
    // Update radio button selection
    goalRadios.forEach(radio => {
        radio.checked = radio.value === currentGoal;
    });
    
    // Update visual feedback using the UI function
    if (typeof updateCareerGoalVisualFeedback === 'function') {
        updateCareerGoalVisualFeedback();
    }
    
    // Update any UI elements that depend on goal selection
    updateGoalDependentFeatures(currentGoal);
}

function updateGoalDependentFeatures(goalType) {
    // This function will be expanded in later phases
    // For now, just log the current goal for debugging
    console.log('Current career goal:', goalType);
}

function loadProfileData() {
    const cvTextarea = document.getElementById('cv');
    if (cvTextarea) cvTextarea.value = getProfileData().cv || '';

    // Load and update career goal UI
    updateCareerGoalUI();
}

function saveProfileFromForm() {
    const cvTextarea = document.getElementById('cv');
    if (cvTextarea) {
        if (saveProfileData({ cv: cvTextarea.value })) {
            showModal('Profile Saved', 'Your profile has been saved successfully.');
            if (typeof trackEvent === 'function') trackEvent('save_profile');
        } else {
            showModal('Error', 'There was an error saving your profile.');
        }
    }
}

function showFirstTimeGuidance() {
    if (!getStorageData('hasSeenGuidance', false)) {
        const modal = document.createElement('div');
        modal.className = 'modal'; modal.id = 'welcome-guidance-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span><h2>Welcome to JobHunter!</h2>
                <div class="welcome-guidance"><div class="welcome-content-scrollable">
                    <p>Get started:</p>
                    <h4>1. Set Up Profile</h4><p>Go to Profile tab, paste your CV.</p>
                    <h4>2. Find & Save Jobs</h4><p>Use Find Jobs, then save details in Apply tab.</p>
                    <h4>3. Generate Documents</h4><p>Use Auto (Gemini) or Manual (Claude) generation.</p>
                    <h4>4. Career Insights & Learning</h4><p>Analyze skills and create learning plans (Sign-in may be required for some features).</p>
                    <p class="notes">Data is saved in your browser. Sign in to sync & access Pro features.</p>
                </div></div>
                <div class="modal-buttons"><button id="got-it-btn" class="primary-button welcome-button">Got it!</button></div>
            </div>`; // Updated "premium" to "Pro"
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 50);
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) closeBtn.addEventListener('click', () => { closeModal(modal); setStorageData('hasSeenGuidance', true); });
        const gotItBtn = document.getElementById('got-it-btn');
        if (gotItBtn) gotItBtn.addEventListener('click', () => { closeModal(modal); setStorageData('hasSeenGuidance', true); });
        if (typeof trackEvent === 'function') trackEvent('first_time_guidance_shown');
    }
}

// CV Upload and Parse Handler
async function handleCvUploadAndParse() {
    console.log("Attempting CV Upload and Parse");
    const featureIdentifier = "cv_upload_and_parse";

    // TEMPORARILY DISABLED: CV Upload premium restrictions - feature now free
    // Original premium checks preserved for re-enabling later:
    // if (!window.currentUser) {
    //     showModal("Sign In Required", `Please sign in to use the "CV Upload & Parse" feature.`, [
    //         { id: 'sign-in-cv-parse', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
    //     ]);
    //     return;
    // }

    // let userHasActivePro = false;
    // if (window.currentUserSubscription &&
    //     window.currentUserSubscription.tier &&
    //     window.currentUserSubscription.tier.toLowerCase() !== 'free' &&
    //     window.currentUserSubscription.status === 'active') {
    //     if (window.currentUserSubscription.current_period_ends_at) {
    //         userHasActivePro = new Date(window.currentUserSubscription.current_period_ends_at) > new Date();
    //     } else {
    //         userHasActivePro = true;
    //     }
    // }
    
    // const isPremiumFeatureDefinedInSettings = true;

    // if (isPremiumFeatureDefinedInSettings && !userHasActivePro) {
    //     showModal("Upgrade to Pro", `The "CV Upload & Parse" feature requires a Pro plan. Please upgrade your plan.`, [
    //         { id: 'upgrade-cv-parse-btn', text: 'Upgrade Plan', class: 'primary-button', action: () => {
    //             document.querySelector('.tab-button[data-tab="profile"]').click();
    //             setTimeout(() => document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
    //         }},
    //         { id: 'cancel-cv-parse-btn', text: 'Maybe Later', class: 'default-button' }
    //     ]);
    //     return;
    // }

    // CV Upload now free for all users - continue with upload logic

    const fileInput = document.getElementById('cv-file-input');
    const loadingIndicator = document.getElementById('cv-parse-loading');
    const errorIndicator = document.getElementById('cv-parse-error');
    const cvTextarea = document.getElementById('cv');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showModal("No File Selected", "Please select a CV file to upload.");
        return;
    }

    const file = fileInput.files[0];
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        showModal("Invalid File Type", "Please upload a PDF, DOCX, DOC, or TXT file.");
        return;
    }

    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (errorIndicator) errorIndicator.classList.add('hidden');

    try {
        if (typeof window.uploadAndParseCV !== 'function') {
            throw new Error("CV parsing API function is not available.");
        }
        const result = await window.uploadAndParseCV(file);

        if (result && result.cv_data) {
            const formattedCvText = formatStructuredCvForTextarea(result.cv_data);
            cvTextarea.value = formattedCvText;
            showModal("CV Populated", "Your CV has been populated from the uploaded file. Please review and save.", [
                { id: 'ok-cv-populated', text: 'OK' }
            ]);
            if (typeof trackEvent === 'function') {
                trackEvent('cv_parsed_and_populated', { file_name: file.name, remaining_quota: result.quota.remaining });
            }
        } else {
            throw new Error("Received no CV data from parsing service.");
        }
    } catch (error) {
        console.error("Error during CV upload and parse:", error);
        let userMessage = "An unexpected error occurred while parsing your CV.";
        if (error.message) {
            if (error.message.startsWith("UPGRADE_REQUIRED:")) {
                userMessage = error.message.replace("UPGRADE_REQUIRED:", "").trim() || "This is a Pro feature. Please upgrade.";
                showModal("Upgrade to Pro", userMessage, [
                    { id: 'upgrade-cvp-error-btn', text: 'Upgrade Plan', class: 'primary-button', action: () => {
                        document.querySelector('.tab-button[data-tab="profile"]').click();
                        setTimeout(() => document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                    }}
                ]);
                return; 
            } else if (error.message.startsWith("AUTH_FAILED:")) {
                userMessage = error.message.replace("AUTH_FAILED:", "").trim() || "Authentication failed. Please sign in again.";
                showModal("Authentication Failed", userMessage, [
                    { id: 'signin-cvp-error-btn', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
                ]);
                return; 
            } else if (error.message.startsWith("BAD_REQUEST:")) {
                userMessage = error.message.replace("BAD_REQUEST:", "").trim();
            } else if (error.message.startsWith("UNPROCESSABLE_FILE:")) {
                userMessage = error.message.replace("UNPROCESSABLE_FILE:", "").trim();
            } else if (error.message.includes("Daily API quota")) {
                userMessage = error.message;
            } else if (error.message.includes("timed out")) {
                userMessage = "The request timed out. Please try again."
            }
        }
        if (errorIndicator) {
            errorIndicator.textContent = userMessage;
            errorIndicator.classList.remove('hidden');
        } else {
            showModal("Parsing Error", userMessage);
        }
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        fileInput.value = ''; 
    }
}

// Helper to format structured CV for textarea
function formatStructuredCvForTextarea(cvData) {
    let output = "";

    if (cvData.fullName) output += `Full Name: ${cvData.fullName}\n`;
    if (cvData.jobTitle) output += `Target Job Title: ${cvData.jobTitle}\n`;
    if (cvData.email) output += `Email: ${cvData.email}\n`;
    if (cvData.phone) output += `Phone: ${cvData.phone}\n`;
    if (cvData.linkedin) output += `LinkedIn: ${cvData.linkedin}\n`;
    if (cvData.location) output += `Location: ${cvData.location}\n\n`;

    if (cvData.summary) {
        output += "SUMMARY\n--------------------\n";
        output += `${cvData.summary}\n\n`;
    }

    if (cvData.experience && cvData.experience.length > 0) {
        output += "EXPERIENCE\n--------------------\n";
        cvData.experience.forEach(exp => {
            output += `${exp.jobTitle || ''} at ${exp.company || ''} (${exp.dates || ''})\n`;
            if (exp.description) output += `${exp.description}\n`;
            if (exp.achievements && exp.achievements.length > 0) {
                exp.achievements.forEach(ach => output += `- ${ach}\n`);
            }
            output += "\n";
        });
    }

    if (cvData.education && cvData.education.length > 0) {
        output += "EDUCATION\n--------------------\n";
        cvData.education.forEach(edu => {
            output += `${edu.degree || ''} - ${edu.institution || ''} (${edu.dates || ''})\n`;
        });
        output += "\n";
    }

    if (cvData.skills && cvData.skills.length > 0) {
        output += "SKILLS\n--------------------\n";
        cvData.skills.forEach(skill => output += `${skill}\n`);
        output += "\n";
    }

    if (cvData.certifications && cvData.certifications.length > 0) {
        output += "CERTIFICATIONS\n--------------------\n";
        cvData.certifications.forEach(cert => output += `${cert}\n`);
        output += "\n";
    }
    // Note: skillGapAnalysis is not typically put into the main CV text.

    return output.trim();
}

function setupHeaderProfileClick() {
    const userProfileHeader = document.getElementById('user-profile'); // The div containing avatar and name
    const profileTabButton = document.querySelector('.tab-button[data-tab="profile"]');

    if (userProfileHeader && profileTabButton) {
        userProfileHeader.addEventListener('click', () => {
            profileTabButton.click(); // Simulate a click on the Profile tab button
        });
        userProfileHeader.style.cursor = 'pointer'; // Make it look clickable
    }
}

// Professional Profiling Functions for app.js

/**
 * Initialize profiling functionality
 */
function initProfiling() {
    setupProfilingEventListeners();
    loadProfilingFormData();
    checkExistingProfile();
}

/**
 * Setup event listeners for profiling features
 */
function setupProfilingEventListeners() {
    // Gemini profile generation button
    const generateGeminiBtn = document.getElementById('generate-profile-gemini');
    if (generateGeminiBtn) {
        generateGeminiBtn.addEventListener('click', function() {
            if (typeof trackEvent === 'function') {
                trackEvent('profiling_gemini_clicked', {
                    has_cv: !!getProfileData().cv,
                    form_completed: isProfilingFormComplete()
                });
            }
            if (typeof generateProfessionalProfileWithGemini === 'function') {
                generateProfessionalProfileWithGemini();
            } else {
                console.error('generateProfessionalProfileWithGemini function not found');
            }
        });
    }

    // Claude profile generation button
    const generateClaudeBtn = document.getElementById('generate-profile-claude');
    if (generateClaudeBtn) {
        generateClaudeBtn.addEventListener('click', function() {
            if (typeof trackEvent === 'function') {
                trackEvent('profiling_claude_clicked', {
                    has_cv: !!getProfileData().cv,
                    form_completed: isProfilingFormComplete()
                });
            }
            if (typeof generateProfessionalProfileWithClaude === 'function') {
                generateProfessionalProfileWithClaude();
            } else {
                console.error('generateProfessionalProfileWithClaude function not found');
            }
        });
    }

    // View existing profile button
    const viewProfileBtn = document.getElementById('view-profile-btn');
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', function() {
            const existingProfile = getProfessionalProfile();
            if (existingProfile) {
                displayProfessionalProfile(existingProfile);
                if (typeof trackEvent === 'function') {
                    trackEvent('existing_profile_viewed');
                }
            }
        });
    }

    // Regenerate profile button
    const regenerateBtn = document.getElementById('regenerate-profile-btn');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', function() {
            showProfilingForm();
            if (typeof trackEvent === 'function') {
                trackEvent('profile_regenerate_clicked');
            }
        });
    }

    // Save profile results button
    const saveResultsBtn = document.getElementById('save-profile-results');
    if (saveResultsBtn) {
        saveResultsBtn.addEventListener('click', function() {
            const profileContent = document.getElementById('profile-content');
            if (profileContent && profileContent.innerHTML.trim()) {
                showModal('Profile Saved', 'Your professional profile has been saved successfully.');
                if (typeof trackEvent === 'function') {
                    trackEvent('profile_results_saved');
                }
            }
        });
    }

    // Create new profile button
    const createNewBtn = document.getElementById('create-new-profile');
    if (createNewBtn) {
        createNewBtn.addEventListener('click', function() {
            showModal('Create New Profile', 'Are you sure you want to create a new profile? This will replace your current one.', [
                {
                    id: 'confirm-new-profile',
                    text: 'Yes, Create New',
                    class: 'primary-button',
                    action: () => {
                        clearProfessionalProfile();
                        showProfilingForm();
                        if (typeof trackEvent === 'function') {
                            trackEvent('new_profile_created');
                        }
                    }
                },
                {
                    id: 'cancel-new-profile',
                    text: 'Cancel',
                    class: 'secondary-button'
                }
            ]);
        });
    }

    // Export profile button
    const exportBtn = document.getElementById('export-profile');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportProfessionalProfileData();
        });
    }

    // Form auto-save functionality
    const formFields = [
        'non-professional-experience',
        'problem-solving-example'
    ];

    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', debounce(saveProfilingFormDataFromUI, 1000));
        }
    });

    // Radio button change listeners
    const radioButtons = document.querySelectorAll('input[name="work-approach"], input[name="work-values"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', saveProfilingFormDataFromUI);
    });
}

/**
 * Check if profiling form is complete
 */
function isProfilingFormComplete() {
    const nonProfExp = document.getElementById('non-professional-experience')?.value.trim();
    const problemSolving = document.getElementById('problem-solving-example')?.value.trim();
    const workApproach = document.querySelector('input[name="work-approach"]:checked');
    const workValues = document.querySelector('input[name="work-values"]:checked');

    return !!(nonProfExp && problemSolving && workApproach && workValues);
}

/**
 * Load profiling form data from storage
 */
function loadProfilingFormData() {
    const formData = getProfilingFormData();
    
    // Load text fields
    const nonProfField = document.getElementById('non-professional-experience');
    if (nonProfField && formData.nonProfessionalExperience) {
        nonProfField.value = formData.nonProfessionalExperience;
    }

    const problemSolvingField = document.getElementById('problem-solving-example');
    if (problemSolvingField && formData.problemSolvingExample) {
        problemSolvingField.value = formData.problemSolvingExample;
    }

    // Load radio buttons
    if (formData.workApproach) {
        const workApproachRadio = document.querySelector(`input[name="work-approach"][value="${formData.workApproach}"]`);
        if (workApproachRadio) {
            workApproachRadio.checked = true;
        }
    }

    if (formData.workValues) {
        const workValuesRadio = document.querySelector(`input[name="work-values"][value="${formData.workValues}"]`);
        if (workValuesRadio) {
            workValuesRadio.checked = true;
        }
    }
}

/**
 * Save profiling form data from UI
 */
function saveProfilingFormDataFromUI() {
    const formData = {
        nonProfessionalExperience: document.getElementById('non-professional-experience')?.value.trim() || '',
        problemSolvingExample: document.getElementById('problem-solving-example')?.value.trim() || '',
        workApproach: document.querySelector('input[name="work-approach"]:checked')?.value || '',
        workValues: document.querySelector('input[name="work-values"]:checked')?.value || ''
    };

    saveProfilingFormData(formData);
}

/**
 * Check for existing professional profile
 */
async function checkExistingProfile() {
    try {
        // Check local storage first
        const localProfile = getProfessionalProfile();
        
        if (localProfile) {
            showExistingProfileStatus(localProfile);
            return;
        }

        // Check cloud profile if user is signed in
        if (window.currentUser && typeof getExistingProfile === 'function') {
            try {
                const cloudProfile = await getExistingProfile();
                if (cloudProfile && cloudProfile.profile_data) {
                    // Save to local storage and show
                    saveProfessionalProfile(cloudProfile.profile_data);
                    showExistingProfileStatus(cloudProfile.profile_data);
                    return;
                }
            } catch (error) {
                console.log('No cloud profile found or error fetching:', error.message);
            }
        }

        // No existing profile found - show form
        showProfilingForm();

    } catch (error) {
        console.error('Error checking existing profile:', error);
        showProfilingForm();
    }
}

/**
 * Show existing profile status
 */
function showExistingProfileStatus(profileData) {
    const existingProfileStatus = document.getElementById('existing-profile-status');
    const profilingForm = document.getElementById('profiling-form');
    const profileResults = document.getElementById('profile-results');
    const profileDateElement = document.getElementById('profile-generated-date');

    if (existingProfileStatus) {
        existingProfileStatus.classList.remove('hidden');
    }
    
    if (profilingForm) {
        profilingForm.classList.add('hidden');
    }
    
    if (profileResults) {
        profileResults.classList.add('hidden');
    }

    // Set profile date
    if (profileDateElement && profileData.savedAt) {
        profileDateElement.textContent = new Date(profileData.savedAt).toLocaleDateString();
    } else if (profileDateElement) {
        profileDateElement.textContent = 'Recently';
    }
}

/**
 * Show profiling form
 */
function showProfilingForm() {
    const existingProfileStatus = document.getElementById('existing-profile-status');
    const profilingForm = document.getElementById('profiling-form');
    const profileResults = document.getElementById('profile-results');

    if (existingProfileStatus) {
        existingProfileStatus.classList.add('hidden');
    }
    
    if (profilingForm) {
        profilingForm.classList.remove('hidden');
    }
    
    if (profileResults) {
        profileResults.classList.add('hidden');
    }
}

/**
 * Export professional profile data
 */
function exportProfessionalProfileData() {
    const profile = getProfessionalProfile();
    if (!profile) {
        showModal('No Profile to Export', 'You don\'t have a professional profile to export yet.');
        return;
    }

    const exportData = exportProfessionalProfile();
    if (!exportData) {
        showModal('Export Failed', 'Failed to prepare profile data for export.');
        return;
    }

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const date = new Date().toISOString().split('T')[0];
    const exportFileName = `jobhunter-professional-profile-${date}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();

    if (typeof trackEvent === 'function') {
        trackEvent('professional_profile_exported', {
            export_date: date,
            has_personality: !!(profile.personality_analysis),
            has_skills: !!(profile.skills_assessment)
        });
    }

    showModal('Profile Exported', 'Your professional profile has been exported successfully.');
}

/**
 * Debounce function for form auto-save
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Admin Dashboard Functionality

/**
 * Admin Dashboard State Management
 */
const AdminDashboard = {
    profiles: [],
    filteredProfiles: [],
    currentPage: 1,
    profilesPerPage: 12,
    currentView: 'grid', // 'grid' or 'list'
    filters: {
        search: '',
        personality: '',
        skillCategory: '',
        roleType: ''
    },
    
    // Initialize admin dashboard
    async init() {
        console.log('Initializing Admin Dashboard...');
        
        // Show admin tab if user has admin access
        this.checkAdminAccess();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadProfiles();
    },
    
    // Check if user should have admin access (using centralized email management)
    checkAdminAccess() {
        const adminTabButton = document.getElementById('admin-tab-button');
        
        // Use centralized admin checking function
        const isAdmin = typeof isCurrentUserAdmin === 'function' ? isCurrentUserAdmin() : false;
        
        if (adminTabButton) {
            if (isAdmin) {
                adminTabButton.classList.add('show-admin');
                console.log('Admin access granted for user:', window.currentUser.email);
                
                // Log admin access for security monitoring
                if (typeof logAdminAccess === 'function') {
                    logAdminAccess('admin_dashboard_access', true);
                }
            } else {
                adminTabButton.classList.remove('show-admin');
                
                // Log unauthorized access attempts for security
                if (window.currentUser && typeof logAdminAccess === 'function') {
                    logAdminAccess('admin_dashboard_access', false);
                }
            }
        }
        
        return isAdmin;
    },
    
    // Set up event listeners for admin dashboard
    setupEventListeners() {
        // Tab switching
        const adminTab = document.querySelector('[data-tab="admin"]');
        if (adminTab) {
            adminTab.addEventListener('click', () => {
                // Refresh data when tab is opened
                this.loadProfiles();
            });
        }
        
        // Search functionality
        const searchInput = document.getElementById('admin-search');
        const searchBtn = document.getElementById('admin-search-btn');
        const clearSearchBtn = document.getElementById('admin-clear-search');
        
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => {
                this.filters.search = searchInput.value;
                this.applyFilters();
            }, 300));
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.filters.search = searchInput.value;
                this.applyFilters();
            });
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.clearFilters();
            });
        }
        
        // Filter dropdowns
        const personalityFilter = document.getElementById('personality-filter');
        const skillCategoryFilter = document.getElementById('skill-category-filter');
        const roleTypeFilter = document.getElementById('role-type-filter');
        
        if (personalityFilter) {
            personalityFilter.addEventListener('change', (e) => {
                this.filters.personality = e.target.value;
                this.applyFilters();
            });
        }
        
        if (skillCategoryFilter) {
            skillCategoryFilter.addEventListener('change', (e) => {
                this.filters.skillCategory = e.target.value;
                this.applyFilters();
            });
        }
        
        if (roleTypeFilter) {
            roleTypeFilter.addEventListener('change', (e) => {
                this.filters.roleType = e.target.value;
                this.applyFilters();
            });
        }
        
        // View toggle buttons
        const gridViewBtn = document.getElementById('grid-view-btn');
        const listViewBtn = document.getElementById('list-view-btn');
        
        if (gridViewBtn) {
            gridViewBtn.addEventListener('click', () => {
                this.switchView('grid');
            });
        }
        
        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => {
                this.switchView('list');
            });
        }
        
        // Action buttons
        const exportBtn = document.getElementById('export-profiles-btn');
        const refreshBtn = document.getElementById('refresh-profiles-btn');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportProfiles();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadProfiles();
            });
        }
        
        // Pagination
        const prevPageBtn = document.getElementById('admin-prev-page');
        const nextPageBtn = document.getElementById('admin-next-page');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderProfiles();
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredProfiles.length / this.profilesPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderProfiles();
                }
            });
        }
        
        // Modal close functionality
        const profileDetailModal = document.getElementById('profile-detail-modal');
        const closeModalBtn = profileDetailModal?.querySelector('.close-modal');
        const closeDetailBtn = document.getElementById('close-profile-detail');
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeProfileModal();
            });
        }
        
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => {
                this.closeProfileModal();
            });
        }
        
        // Export single profile
        const exportSingleBtn = document.getElementById('export-single-profile');
        if (exportSingleBtn) {
            exportSingleBtn.addEventListener('click', () => {
                this.exportSingleProfile();
            });
        }
    },
    
    // Load all profiles from the API
    async loadProfiles() {
        const loadingElement = document.getElementById('admin-loading');
        const emptyStateElement = document.getElementById('admin-empty-state');
        const profilesContainer = document.getElementById('admin-profiles-container');
        
        if (loadingElement) loadingElement.classList.remove('hidden');
        if (emptyStateElement) emptyStateElement.classList.add('hidden');
        if (profilesContainer) profilesContainer.classList.add('hidden');
        
        try {
            if (typeof trackEvent === 'function') {
                trackEvent('admin_dashboard_load_started');
            }
            
            const data = await window.getAllProfiles();
            this.profiles = data.profiles || [];
            this.filteredProfiles = [...this.profiles];
            
            console.log(`Loaded ${this.profiles.length} profiles for admin dashboard`);
            
            // Update dashboard statistics
            this.updateDashboardStats(data.summary || {});
            
            // Render the profiles
            this.renderProfiles();
            
            if (typeof trackEvent === 'function') {
                trackEvent('admin_dashboard_load_success', {
                    total_profiles: this.profiles.length
                });
            }
            
        } catch (error) {
            console.error('Error loading admin profiles:', error);
            this.showError('Failed to load community profiles. ' + error.message);
            
            if (typeof trackEvent === 'function') {
                trackEvent('admin_dashboard_load_error', {
                    error_message: error.message
                });
            }
        } finally {
            if (loadingElement) loadingElement.classList.add('hidden');
        }
    },
    
    // Update dashboard statistics
    updateDashboardStats(summary) {
        const totalProfilesEl = document.getElementById('total-profiles-count');
        const activeUsersEl = document.getElementById('active-users-count');
        const skillDiversityEl = document.getElementById('skill-diversity-count');
        const personalityDistributionEl = document.getElementById('personality-distribution');
        
        if (totalProfilesEl) {
            totalProfilesEl.textContent = this.profiles.length;
        }
        
        if (activeUsersEl) {
            // Count profiles created in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const activeUsers = this.profiles.filter(profile => 
                new Date(profile.created_at) > thirtyDaysAgo
            ).length;
            activeUsersEl.textContent = activeUsers;
        }
        
        if (skillDiversityEl) {
            // Count unique skills across all profiles
            const allSkills = new Set();
            this.profiles.forEach(profile => {
                const skills = profile.profile_data?.skills_assessment;
                if (skills?.technical_skills) {
                    Object.values(skills.technical_skills).forEach(skillArray => {
                        if (Array.isArray(skillArray)) {
                            skillArray.forEach(skill => allSkills.add(skill.toLowerCase()));
                        }
                    });
                }
            });
            skillDiversityEl.textContent = allSkills.size;
        }
        
        if (personalityDistributionEl) {
            // Count different personality types
            const personalityTypes = new Set();
            this.profiles.forEach(profile => {
                const personality = profile.profile_data?.personality_analysis?.core_traits;
                if (personality) {
                    // Create a simple personality signature
                    const traits = Object.entries(personality)
                        .filter(([trait, data]) => data.level === 'High')
                        .map(([trait]) => trait);
                    if (traits.length > 0) {
                        personalityTypes.add(traits.sort().join('-'));
                    }
                }
            });
            personalityDistributionEl.textContent = personalityTypes.size;
        }
    },
    
    // Apply filters to profiles
    applyFilters() {
        this.filteredProfiles = this.profiles.filter(profile => {
            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const profileText = [
                    profile.user_email,
                    JSON.stringify(profile.profile_data?.skills_assessment || {}),
                    JSON.stringify(profile.profile_data?.role_recommendations || [])
                ].join(' ').toLowerCase();
                
                if (!profileText.includes(searchTerm)) {
                    return false;
                }
            }
            
            // Personality filter
            if (this.filters.personality) {
                const personality = profile.profile_data?.personality_analysis?.core_traits;
                if (!personality) return false;
                
                const filterType = this.filters.personality.replace('high-', '').replace('low-', '');
                const isHigh = this.filters.personality.startsWith('high-');
                const expectedLevel = isHigh ? 'High' : 'Low';
                
                const trait = personality[filterType];
                if (!trait || trait.level !== expectedLevel) {
                    return false;
                }
            }
            
            // Skill category filter
            if (this.filters.skillCategory) {
                const skills = profile.profile_data?.skills_assessment;
                if (!skills) return false;
                
                const hasSkillCategory = this.hasSkillInCategory(skills, this.filters.skillCategory);
                if (!hasSkillCategory) {
                    return false;
                }
            }
            
            // Role type filter
            if (this.filters.roleType) {
                const roles = profile.profile_data?.role_recommendations || [];
                const hasRoleType = roles.some(role => 
                    role.role_title.toLowerCase().includes(this.filters.roleType.toLowerCase())
                );
                if (!hasRoleType) {
                    return false;
                }
            }
            
            return true;
        });
        
        this.currentPage = 1; // Reset to first page
        this.renderProfiles();
    },
    
    // Helper to check if profile has skills in category
    hasSkillInCategory(skills, category) {
        const categoryMap = {
            'technical': ['technical_skills', 'software_and_tools'],
            'leadership': ['soft_skills'],
            'communication': ['soft_skills'],
            'analytical': ['technical_skills', 'methodologies_and_frameworks'],
            'creative': ['soft_skills', 'industry_knowledge']
        };
        
        const relevantCategories = categoryMap[category] || [];
        
        for (const skillCategory of relevantCategories) {
            const skillData = skills[skillCategory];
            if (skillData) {
                if (Array.isArray(skillData)) {
                    const hasMatch = skillData.some(skill => 
                        skill.toLowerCase().includes(category.toLowerCase())
                    );
                    if (hasMatch) return true;
                } else if (typeof skillData === 'object') {
                    const hasMatch = Object.values(skillData).some(skillArray => 
                        Array.isArray(skillArray) && skillArray.some(skill => 
                            skill.toLowerCase().includes(category.toLowerCase())
                        )
                    );
                    if (hasMatch) return true;
                }
            }
        }
        
        return false;
    },
    
    // Clear all filters
    clearFilters() {
        this.filters = {
            search: '',
            personality: '',
            skillCategory: '',
            roleType: ''
        };
        
        // Reset UI elements
        const searchInput = document.getElementById('admin-search');
        const personalityFilter = document.getElementById('personality-filter');
        const skillCategoryFilter = document.getElementById('skill-category-filter');
        const roleTypeFilter = document.getElementById('role-type-filter');
        
        if (searchInput) searchInput.value = '';
        if (personalityFilter) personalityFilter.value = '';
        if (skillCategoryFilter) skillCategoryFilter.value = '';
        if (roleTypeFilter) roleTypeFilter.value = '';
        
        this.filteredProfiles = [...this.profiles];
        this.currentPage = 1;
        this.renderProfiles();
    },
    
    // Switch between grid and list view
    switchView(viewType) {
        this.currentView = viewType;
        
        const gridBtn = document.getElementById('grid-view-btn');
        const listBtn = document.getElementById('list-view-btn');
        const container = document.getElementById('admin-profiles-container');
        
        if (gridBtn && listBtn) {
            gridBtn.classList.toggle('active', viewType === 'grid');
            listBtn.classList.toggle('active', viewType === 'list');
        }
        
        if (container) {
            container.className = viewType === 'grid' ? 'admin-profiles-grid' : 'admin-profiles-list';
        }
        
        this.renderProfiles();
    },
    
    // Render profiles based on current filters and pagination
    renderProfiles() {
        const container = document.getElementById('admin-profiles-container');
        const emptyState = document.getElementById('admin-empty-state');
        const pagination = document.getElementById('admin-pagination');
        const filteredCount = document.getElementById('filtered-count');
        
        if (!container) return;
        
        // Update filtered count
        if (filteredCount) {
            filteredCount.textContent = `(${this.filteredProfiles.length})`;
        }
        
        if (this.filteredProfiles.length === 0) {
            container.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            if (pagination) pagination.classList.add('hidden');
            return;
        }
        
        // Show container and hide empty state
        container.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        
        // Calculate pagination
        const totalPages = Math.ceil(this.filteredProfiles.length / this.profilesPerPage);
        const startIndex = (this.currentPage - 1) * this.profilesPerPage;
        const endIndex = Math.min(startIndex + this.profilesPerPage, this.filteredProfiles.length);
        const currentProfiles = this.filteredProfiles.slice(startIndex, endIndex);
        
        // Render profile cards
        container.innerHTML = '';
        currentProfiles.forEach(profile => {
            const profileCard = this.createProfileCard(profile);
            container.appendChild(profileCard);
        });
        
        // Update pagination
        this.updatePagination(totalPages);
    },
    
    // Create individual profile card
    createProfileCard(profile) {
        const card = document.createElement('div');
        card.className = `admin-profile-card ${this.currentView === 'list' ? 'list-view' : ''}`;
        
        const profileData = profile.profile_data || {};
        const personality = profileData.personality_analysis || {};
        const skills = profileData.skills_assessment || {};
        const roles = profileData.role_recommendations || [];
        
        // Extract preview data
        const personalityTraits = this.extractPersonalityTraits(personality);
        const topSkills = this.extractTopSkills(skills);
        const topRoles = roles.slice(0, 3);
        
        card.innerHTML = `
            <div class="profile-card-header">
                <div class="profile-basic-info">
                    <h4>${profile.user_email || 'Unknown User'}</h4>
                    <div class="profile-timestamp">${this.formatDate(profile.created_at)}</div>
                </div>
                <div class="profile-actions">
                    <button class="profile-action-btn" onclick="AdminDashboard.viewProfileDetail('${profile.user_id}')">View</button>
                    <button class="profile-action-btn" onclick="AdminDashboard.exportSingleProfileById('${profile.user_id}')">Export</button>
                </div>
            </div>
            
            <div class="profile-personality-preview">
                <h5>🧠 Personality</h5>
                <div class="personality-traits-mini">
                    ${personalityTraits.map(trait => 
                        `<span class="personality-trait-tag">${trait}</span>`
                    ).join('')}
                </div>
            </div>
            
            <div class="profile-skills-preview">
                <h5>💼 Top Skills</h5>
                <div class="skills-preview-list">
                    ${topSkills.join(', ') || 'No skills identified'}
                </div>
            </div>
            
            <div class="profile-roles-preview">
                <h5>🎯 Role Recommendations</h5>
                <div class="role-recommendations-mini">
                    ${topRoles.map(role => `
                        <div class="role-recommendation-item">
                            <span class="role-title-mini">${role.role_title}</span>
                            <span class="role-match-mini">${role.match_percentage}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Add click handler for the card (excluding action buttons)
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('profile-action-btn')) {
                this.viewProfileDetail(profile.user_id);
            }
        });
        
        return card;
    },
    
    // Extract personality traits for preview
    extractPersonalityTraits(personality) {
        const traits = [];
        if (personality.core_traits) {
            Object.entries(personality.core_traits).forEach(([trait, data]) => {
                if (data.level === 'High') {
                    traits.push(trait.replace(/_/g, ' '));
                }
            });
        }
        return traits.slice(0, 3); // Show top 3 traits
    },
    
    // Extract top skills for preview
    extractTopSkills(skills) {
        const topSkills = [];
        
        // Get expert level technical skills
        if (skills.technical_skills?.expert_level) {
            topSkills.push(...skills.technical_skills.expert_level.slice(0, 3));
        }
        
        // Get top soft skills
        if (skills.soft_skills) {
            topSkills.push(...skills.soft_skills.slice(0, 2));
        }
        
        return topSkills.slice(0, 5);
    },
    
    // Format date for display
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString();
    },
    
    // Update pagination controls
    updatePagination(totalPages) {
        const pagination = document.getElementById('admin-pagination');
        const pageInfo = document.getElementById('admin-page-info');
        const prevBtn = document.getElementById('admin-prev-page');
        const nextBtn = document.getElementById('admin-next-page');
        
        if (totalPages <= 1) {
            if (pagination) pagination.classList.add('hidden');
            return;
        }
        
        if (pagination) pagination.classList.remove('hidden');
        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    },
    
    // View detailed profile in modal
    viewProfileDetail(userId) {
        const profile = this.profiles.find(p => p.user_id === userId);
        if (!profile) {
            this.showError('Profile not found');
            return;
        }
        
        this.currentProfileForModal = profile;
        this.renderProfileDetailModal(profile);
        
        if (typeof trackEvent === 'function') {
            trackEvent('admin_profile_detail_viewed', {
                user_id: userId,
                has_personality: !!(profile.profile_data?.personality_analysis),
                has_skills: !!(profile.profile_data?.skills_assessment)
            });
        }
    },
    
    // Render profile detail modal
    renderProfileDetailModal(profile) {
        const modal = document.getElementById('profile-detail-modal');
        const content = document.getElementById('profile-detail-content');
        
        if (!modal || !content) return;
        
        const profileData = profile.profile_data || {};
        const personality = profileData.personality_analysis || {};
        const skills = profileData.skills_assessment || {};
        const roles = profileData.role_recommendations || [];
        const careerDev = profileData.career_development || {};
        
        content.innerHTML = `
            <div class="profile-detail-header">
                <div class="profile-detail-basic">
                    <h2>${profile.user_email || 'Unknown User'}</h2>
                    <div class="profile-detail-timestamp">Profile created: ${this.formatDate(profile.created_at)}</div>
                </div>
            </div>
            
            ${personality.core_traits ? `
                <div class="profile-detail-section">
                    <h3>🧠 Personality Analysis</h3>
                    <div class="personality-traits-detail">
                        ${Object.entries(personality.core_traits).map(([trait, data]) => `
                            <div class="trait-detail-item">
                                <h4>${trait.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                                <div class="trait-level">Level: ${data.level}</div>
                                <div class="trait-description">${data.description || 'No description available'}</div>
                            </div>
                        `).join('')}
                    </div>
                    ${personality.communication_style ? `
                        <p><strong>Communication Style:</strong> ${personality.communication_style}</p>
                    ` : ''}
                    ${personality.motivation_drivers ? `
                        <p><strong>Motivation Drivers:</strong> ${personality.motivation_drivers}</p>
                    ` : ''}
                </div>
            ` : ''}
            
            ${Object.keys(skills).length > 0 ? `
                <div class="profile-detail-section">
                    <h3>💼 Skills Assessment</h3>
                    <div class="skills-detail-grid">
                        ${Object.entries(skills).map(([category, skillData]) => {
                            if (typeof skillData === 'object' && !Array.isArray(skillData)) {
                                // Handle nested skill categories (like technical_skills)
                                return Object.entries(skillData).map(([subCategory, skillArray]) => `
                                    <div class="skill-category-detail">
                                        <h4>${subCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                                        <div class="skill-items-detail">
                                            ${Array.isArray(skillArray) ? skillArray.map(skill => 
                                                `<span class="skill-item-detail">${skill}</span>`
                                            ).join('') : ''}
                                        </div>
                                    </div>
                                `).join('');
                            } else if (Array.isArray(skillData)) {
                                // Handle direct skill arrays
                                return `
                                    <div class="skill-category-detail">
                                        <h4>${category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                                        <div class="skill-items-detail">
                                            ${skillData.map(skill => 
                                                `<span class="skill-item-detail">${skill}</span>`
                                            ).join('')}
                                        </div>
                                    </div>
                                `;
                            }
                            return '';
                        }).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${roles.length > 0 ? `
                <div class="profile-detail-section">
                    <h3>🎯 Role Recommendations</h3>
                    <div class="role-recommendations-detail">
                        ${roles.map(role => `
                            <div class="role-detail-card">
                                <h4>${role.role_title}</h4>
                                <span class="role-match-detail">${role.match_percentage}% Match</span>
                                <p><strong>Why it fits:</strong> ${role.fit_reasoning || 'No reasoning provided'}</p>
                                ${role.growth_potential ? `
                                    <p><strong>Growth potential:</strong> ${role.growth_potential}</p>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${careerDev.immediate_priorities || careerDev.long_term_vision ? `
                <div class="profile-detail-section">
                    <h3>📈 Career Development</h3>
                    ${careerDev.immediate_priorities ? `
                        <p><strong>Immediate Priorities:</strong></p>
                        <ul>
                            ${Array.isArray(careerDev.immediate_priorities) ? 
                                careerDev.immediate_priorities.map(priority => `<li>${priority}</li>`).join('') :
                                `<li>${careerDev.immediate_priorities}</li>`
                            }
                        </ul>
                    ` : ''}
                    ${careerDev.long_term_vision ? `
                        <p><strong>Long-term Vision:</strong> ${careerDev.long_term_vision}</p>
                    ` : ''}
                </div>
            ` : ''}
            
            ${profileData.unique_value_proposition ? `
                <div class="profile-detail-section">
                    <h3>💡 Unique Value Proposition</h3>
                    <p>${profileData.unique_value_proposition}</p>
                </div>
            ` : ''}
        `;
        
        // Show modal
        modal.classList.remove('hidden');
        modal.classList.add('active');
    },
    
    // Close profile detail modal
    closeProfileModal() {
        const modal = document.getElementById('profile-detail-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('active');
        }
        this.currentProfileForModal = null;
    },
    
    // Export all profiles
    async exportProfiles() {
        try {
            const exportBtn = document.getElementById('export-profiles-btn');
            if (exportBtn) {
                exportBtn.textContent = 'Exporting...';
                exportBtn.disabled = true;
            }
            
            // Show export format selection
            this.showExportFormatModal();
            
        } catch (error) {
            console.error('Error exporting profiles:', error);
            this.showError('Failed to export profiles: ' + error.message);
        } finally {
            const exportBtn = document.getElementById('export-profiles-btn');
            if (exportBtn) {
                exportBtn.textContent = 'Export All Profiles';
                exportBtn.disabled = false;
            }
        }
    },
    
    // Show export format selection modal
    showExportFormatModal() {
        if (typeof showModal === 'function') {
            showModal('Export Community Profiles', 
                'Choose the export format for the community profiles data:',
                [
                    {
                        id: 'export-json',
                        text: 'Export as JSON',
                        class: 'primary-button',
                        action: () => this.performExport('json')
                    },
                    {
                        id: 'export-csv',
                        text: 'Export as CSV',
                        class: 'secondary-button',
                        action: () => this.performExport('csv')
                    },
                    {
                        id: 'cancel-export',
                        text: 'Cancel',
                        class: 'default-button'
                    }
                ]
            );
        }
    },
    
    // Perform actual export
    async performExport(format) {
        try {
            const blob = await window.exportAllProfiles(format);
            const date = new Date().toISOString().split('T')[0];
            const filename = `jobhunter-community-profiles-${date}.${format}`;
            
            if (typeof window.downloadBlob === 'function') {
                window.downloadBlob(blob, filename);
            }
            
            if (typeof trackEvent === 'function') {
                trackEvent('admin_profiles_exported', {
                    format: format,
                    total_profiles: this.profiles.length,
                    admin_user: window.currentUser?.email || 'unknown'
                });
            }
            
            if (typeof showModal === 'function') {
                showModal('Export Complete', `Successfully exported ${this.profiles.length} profiles as ${format.toUpperCase()}.`);
            }
            
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Export failed: ' + error.message);
        }
    },
    
    // Export single profile by ID
    exportSingleProfileById(userId) {
        const profile = this.profiles.find(p => p.user_id === userId);
        if (profile) {
            this.exportSingleProfileData(profile);
        }
    },
    
    // Export single profile (for modal)
    exportSingleProfile() {
        if (this.currentProfileForModal) {
            this.exportSingleProfileData(this.currentProfileForModal);
        }
    },
    
    // Export single profile data
    exportSingleProfileData(profile) {
        try {
            const exportData = {
                exportType: 'single_profile_export',
                exportDate: new Date().toISOString(),
                profile: profile,
                version: '1.0.0'
            };
            
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            const date = new Date().toISOString().split('T')[0];
            const filename = `profile-${profile.user_email || 'unknown'}-${date}.json`;
            
            if (typeof window.downloadBlob === 'function') {
                window.downloadBlob(blob, filename);
            }
            
            if (typeof trackEvent === 'function') {
                trackEvent('admin_single_profile_exported', {
                    user_id: profile.user_id,
                    admin_user: window.currentUser?.email || 'unknown'
                });
            }
            
        } catch (error) {
            console.error('Error exporting single profile:', error);
            this.showError('Failed to export profile: ' + error.message);
        }
    },
    
    // Show error message
    showError(message) {
        if (typeof showModal === 'function') {
            showModal('Error', message);
        } else {
            alert(message);
        }
    }
};

// Utility function for debouncing search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize admin dashboard when auth state changes
const originalHandleAuthStateChange = window.handleAuthStateChange;
window.handleAuthStateChange = function(user) {
    // Call original function
    if (originalHandleAuthStateChange) {
        originalHandleAuthStateChange(user);
    }
    
    // Initialize admin dashboard for signed-in users
    if (user) {
        setTimeout(() => {
            AdminDashboard.checkAdminAccess();
        }, 100);
    } else {
        // Hide admin tab when user signs out
        const adminTabButton = document.getElementById('admin-tab-button');
        if (adminTabButton) {
            adminTabButton.classList.remove('show-admin');
        }
    }
};

// Expose AdminDashboard globally for event handlers
window.AdminDashboard = AdminDashboard;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed for app.js");
    if (typeof window.fetchAppConfig === 'function') {
        console.log("Attempting to fetch app config from app.js...");
        await window.fetchAppConfig(); // Ensure config is loaded before initializing the rest
        console.log("App config fetch attempt complete from app.js.");
    } else {
        console.warn("fetchAppConfig function not found on window when app.js loaded.");
    }
    
    // Your existing initApp function or other initializations
    initApp(); 
});