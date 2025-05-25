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
    // showExtensionPromo('job-save'); // Consider enabling based on UX preference
    showFirstTimeGuidance();

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
function updateFeatureAccessUI() {
    const subscription = window.currentUserSubscription;
    let userHasActivePro = false; // Changed from userHasActivePremium

    if (window.currentUser && subscription && subscription.tier && subscription.tier.toLowerCase() !== 'free' && subscription.status === 'active') {
        if (subscription.current_period_ends_at) {
            userHasActivePro = new Date(subscription.current_period_ends_at) > new Date();
        } else {
            userHasActivePro = true;
        }
    }

    const proUiElements = document.querySelectorAll('[data-pro-feature]'); // Changed from data-premium-feature

    proUiElements.forEach(element => {
        const featureName = element.dataset.proFeature; // Changed from data-premium-feature
        const isGatedBySubscription = true;

        let badge = element.querySelector('.pro-badge'); // Changed from .premium-badge
        if (!badge) {
            const parent = element.closest('.tab-button') || element;
            badge = parent.querySelector('.pro-badge'); // Changed from .premium-badge
        }

        // Specific handling for CV Upload section's sign-in message
        if (featureName === "cv_upload_and_parse") {
            const cvUploadSection = document.getElementById('cv-upload-section');
            const cvUploadUiContainer = document.getElementById('cv-upload-ui-container');
            const cvUploadSignInMessage = document.getElementById('cv-upload-signin-message');

            if (cvUploadSection && cvUploadUiContainer && cvUploadSignInMessage) {
                if (userHasActivePro) { // User has Pro access
                    cvUploadUiContainer.classList.remove('hidden');
                    cvUploadSignInMessage.classList.add('hidden');
                } else { // User does NOT have Pro access
                    cvUploadUiContainer.classList.add('hidden'); // Hide actual upload inputs/button
                    if (!window.currentUser) { // If not signed in at all
                        cvUploadSignInMessage.classList.remove('hidden'); // Show "sign in to use"
                    } else { // Signed in, but not Pro
                        cvUploadSignInMessage.classList.add('hidden'); // Hide the specific "sign in" msg, modal will prompt to upgrade
                    }
                }
            }
        }

        if (isGatedBySubscription) {
            if (userHasActivePro) {
                element.disabled = false;
                element.classList.remove('disabled-pro-feature'); // Changed from disabled-premium
                if (element.dataset.hideBadgeOnActive === "true" && badge) {
                    badge.classList.add('hidden');
                } else if (badge) {
                    // Badge can remain visible but could be styled differently for active pro users if desired
                    // For now, let's assume if it's a pro feature and user is pro, badge isn't strictly needed or can be more subtle
                    badge.classList.add('hidden'); // Hiding badge if user is Pro
                }
            } else {
                element.disabled = true;
                element.classList.add('disabled-pro-feature'); // Changed from disabled-premium
                if (badge) badge.classList.remove('hidden');

                if (!element.dataset.proClickListenerAttached) { // Changed from premiumClickListenerAttached
                    element.addEventListener('click', (e) => {
                        if (element.disabled) {
                            e.preventDefault();
                            e.stopPropagation();
                            let featureDisplayName = element.dataset.featureDisplayName || featureName.replace(/_/g, ' ');
                            featureDisplayName = featureDisplayName.charAt(0).toUpperCase() + featureDisplayName.slice(1);

                            showModal( // Using "Pro"
                                "Upgrade to Pro",
                                `The "${featureDisplayName}" feature requires a Pro plan. Please upgrade to access it.`,
                                [
                                    {
                                        id: 'upgrade-modal-action-btn',
                                        text: 'Upgrade Plan',
                                        class: 'primary-button',
                                        action: () => {
                                            document.querySelector('.tab-button[data-tab="profile"]').click();
                                            setTimeout(() => {
                                                document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' });
                                            }, 100);
                                        }
                                    },
                                    { id: 'cancel-modal-action-btn', text: 'Maybe Later', class: 'default-button' }
                                ]
                            );
                        }
                    });
                    element.dataset.proClickListenerAttached = 'true'; // Changed from premiumClickListenerAttached
                }
            }
        }
    });
}
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

function checkTabAccess(tabName) {
    const restrictedTabsMap = {
        'insights': 'Career Insights',
        'learning': 'Learning Dashboard'
    };

    if (restrictedTabsMap.hasOwnProperty(tabName) && !window.isUserSignedIn) {
        showSignInRequiredModal(tabName, restrictedTabsMap[tabName]); // Pass display name
        return false;
    }

    const subscription = window.currentUserSubscription;
    let userHasActivePro = false; // Changed from userHasActivePremium
    if (window.isUserSignedIn && subscription && subscription.tier && subscription.tier.toLowerCase() !== 'free' && subscription.status === 'active') {
        if (subscription.current_period_ends_at) {
            userHasActivePro = new Date(subscription.current_period_ends_at) > new Date();
        } else {
            userHasActivePro = true;
        }
    }

    const tabIsProFeature = (tabName === 'insights' || tabName === 'learning'); // "Pro"

    if (tabIsProFeature && !userHasActivePro) { // Check for Pro plan
        showModal( // Using "Pro"
            "Upgrade to Pro",
            `The "${restrictedTabsMap[tabName]}" tab requires a Pro plan. Please upgrade your plan to access it.`,
            [
                {
                    id: 'upgrade-tab-modal-btn',
                    text: 'Upgrade Plan',
                    class: 'primary-button',
                    action: () => {
                        document.querySelector('.tab-button[data-tab="profile"]').click();
                        setTimeout(() => {
                            document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                    }
                },
                { id: 'cancel-tab-modal-btn', text: 'Maybe Later', class: 'default-button' }
            ]
        );
        return false;
    }

    return true;
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

function loadProfileData() {
    const cvTextarea = document.getElementById('cv');
    if (cvTextarea) cvTextarea.value = getProfileData().cv || '';
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

    if (!window.currentUser) {
        showModal("Sign In Required", `Please sign in to use the "CV Upload & Parse" feature.`, [
            { id: 'sign-in-cv-parse', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
        ]);
        return;
    }

    let userHasActivePro = false;
    if (window.currentUserSubscription &&
        window.currentUserSubscription.tier &&
        window.currentUserSubscription.tier.toLowerCase() !== 'free' &&
        window.currentUserSubscription.status === 'active') {
        if (window.currentUserSubscription.current_period_ends_at) {
            userHasActivePro = new Date(window.currentUserSubscription.current_period_ends_at) > new Date();
        } else {
            userHasActivePro = true;
        }
    }
    
    const isPremiumFeatureDefinedInSettings = true; // Placeholder, ideally check against a config

    if (isPremiumFeatureDefinedInSettings && !userHasActivePro) {
        showModal("Upgrade to Pro", `The "CV Upload & Parse" feature requires a Pro plan. Please upgrade your plan.`, [
            { id: 'upgrade-cv-parse-btn', text: 'Upgrade Plan', class: 'primary-button', action: () => {
                document.querySelector('.tab-button[data-tab="profile"]').click();
                setTimeout(() => document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }},
            { id: 'cancel-cv-parse-btn', text: 'Maybe Later', class: 'default-button' }
        ]);
        return;
    }

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

document.addEventListener('DOMContentLoaded', initApp);