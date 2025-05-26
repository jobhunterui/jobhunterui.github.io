// js/payments.js

const API_BASE_URL = 'https://jobhunter-api-3gbd.onrender.com/api/v1'; // Your backend API URL

let APP_CONFIG = {
    environment: 'production', // Default
    paystack_public_key: null // Default
};

// Use let instead of const for variables that need to be reassigned
let PAYMENT_CALLBACK_URL = 'https://jobhunterui.github.io/payment-callback.html'; // Default production callback

// Function to fetch app configuration from backend
async function fetchAppConfig() {
    try {
        // CORRECTED URL:
        const response = await fetch(`${API_BASE_URL}/payments/app-config`); 
        if (!response.ok) {
            console.error('Failed to fetch app config from backend', response.status);
            return;
        }
        const config = await response.json();
        APP_CONFIG.environment = config.environment.toLowerCase();
        APP_CONFIG.paystack_public_key = config.paystack_public_key;
        console.log('App config loaded:', APP_CONFIG);

        if (APP_CONFIG.environment === 'development') {
            PAYMENT_CALLBACK_URL = 'http://127.0.0.1:5500/payment-callback.html'; // Local dev callback
            console.log('Environment is DEVELOPMENT, using local callback URL:', PAYMENT_CALLBACK_URL);
        } else {
            PAYMENT_CALLBACK_URL = 'https://jobhunterui.github.io/payment-callback.html'; // Production callback
            console.log('Environment is PRODUCTION, using production callback URL:', PAYMENT_CALLBACK_URL);
        }

    } catch (error) {
        console.error('Error fetching app config:', error);
    }
}

/**
 * Initiates a Paystack transaction for the selected plan.
 * @param {string} planIdentifier - e.g., "monthly", "yearly"
 */
async function initializePaystackTransaction(planIdentifier) {
    // Ensure config is fetched before proceeding (could be improved with a promise/flag)
    if (!APP_CONFIG.paystack_public_key && APP_CONFIG.environment !== 'development') {
         // If public key is needed by Paystack.js and not yet loaded for prod
        console.warn("Paystack public key not yet loaded. Consider awaiting fetchAppConfig.");
        // Depending on your flow, you might want to await fetchAppConfig() here or show a message.
    }
    // The rest of your initializePaystackTransaction function remains largely the same,
    // but now it will use the dynamically set PAYMENT_CALLBACK_URL.

    if (!window.auth || !window.auth.currentUser) {
        console.error("User not signed in. Cannot initialize payment.");
        showModal("Authentication Required", "Please sign in to subscribe.", [
            { id: 'sign-in-subscribe', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
        ]);
        return;
    }

    const user = window.auth.currentUser;
    const idToken = await user.getIdToken(true);

    if (!idToken) {
        console.error("Could not get ID token.");
        showModal("Error", "Could not authenticate your session. Please try signing in again.");
        return;
    }

    const planMessageElement = document.getElementById('user-plan-message');
    if (planMessageElement) planMessageElement.textContent = 'Processing... Please wait.';

    try {
        const response = await fetch(`${API_BASE_URL}/payments/initialize_transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                email: user.email,
                plan_identifier: planIdentifier,
                callback_url: PAYMENT_CALLBACK_URL // Uses the dynamically set URL
            })
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error("Error initializing payment:", responseData.detail || response.statusText);
            if (planMessageElement) planMessageElement.textContent = `Error: ${responseData.detail || 'Could not start payment.'}`;
            showModal("Payment Error", responseData.detail || "Could not initiate payment. Please try again or contact support if the issue persists.");
            return;
        }

        if (responseData.status && responseData.data && responseData.data.authorization_url) {
            if (planMessageElement) planMessageElement.textContent = 'Redirecting to payment page...';
            window.location.href = responseData.data.authorization_url;
        } else {
            console.error("Invalid response from payment initialization:", responseData);
            if (planMessageElement) planMessageElement.textContent = 'Error: Received invalid data from server.';
            showModal("Payment Error", responseData.message || "Received invalid data from our server. Please try again.");
        }

    } catch (error) {
        console.error("Network or other error during payment initialization:", error);
        if (planMessageElement) planMessageElement.textContent = 'Error: A network error occurred.';
        showModal("Payment Error", "A network error occurred while trying to initiate payment. Please check your connection and try again.");
    }
}

/**
 * Updates the subscription UI based on user data from Firestore.
 * @param {object} userData - User data object, typically from Firestore.
 */
function updateUserSubscriptionUI(userData) {
    const currentPlanEl = document.getElementById('user-current-plan');
    const planExpiryEl = document.getElementById('user-plan-expiry');
    const planExpiryDateEl = document.getElementById('user-plan-expiry-date');
    const subscriptionOptionsEl = document.getElementById('subscription-options');
    // const manageSubscriptionEl = document.getElementById('manage-subscription-options'); // For future use

    if (!currentPlanEl || !planExpiryEl || !planExpiryDateEl || !subscriptionOptionsEl) {
        console.warn("Subscription UI elements not found.");
        return;
    }

    // Hide all by default, show based on state
    subscriptionOptionsEl.classList.add('hidden');
    planExpiryEl.classList.add('hidden');
    // manageSubscriptionEl.classList.add('hidden');


    if (userData && userData.subscription) {
        const sub = userData.subscription;
        let planName = sub.tier || "Free";
        if (planName.startsWith("pro_")) {
            planName = planName.replace("pro_", "");
            planName = planName.charAt(0).toUpperCase() + planName.slice(1) + " Pro";
        } else if (planName === "free") {
            planName = "Free";
        }
        currentPlanEl.textContent = planName;

        if (sub.tier !== "free" && sub.status === "active") {
            subscriptionOptionsEl.classList.add('hidden'); // Hide upgrade options if already pro
            // manageSubscriptionEl.classList.remove('hidden'); // Show manage options
            if (sub.current_period_ends_at) {
                try {
                    // Firestore timestamp can be toDate() if it's a Firestore Timestamp object,
                    // or it might already be an ISO string or a Date object if user_service converted it.
                    let endsAtDate;
                    if (sub.current_period_ends_at.toDate) { // Check if it's a Firestore Timestamp
                        endsAtDate = sub.current_period_ends_at.toDate();
                    } else if (typeof sub.current_period_ends_at === 'string') {
                        endsAtDate = new Date(sub.current_period_ends_at);
                    } else if (sub.current_period_ends_at instanceof Date) {
                        endsAtDate = sub.current_period_ends_at;
                    } else {
                        throw new Error("Unknown date format for current_period_ends_at");
                    }
                    planExpiryDateEl.textContent = endsAtDate.toLocaleDateString();
                    planExpiryEl.classList.remove('hidden');
                } catch (e) {
                    console.error("Error formatting plan expiry date:", e, sub.current_period_ends_at);
                    planExpiryDateEl.textContent = "N/A";
                    planExpiryEl.classList.remove('hidden');
                }
            }
        } else if (sub.status === "non-renewing" && sub.tier !== "free") {
            // User is on a pro plan that will not renew
            subscriptionOptionsEl.classList.add('hidden'); // Still on pro, don't show upgrade yet
            // manageSubscriptionEl.classList.remove('hidden');
            if (sub.cancellation_effective_date) {
                let effectiveDate;
                if (sub.cancellation_effective_date.toDate) {
                    effectiveDate = sub.cancellation_effective_date.toDate();
                } else if (typeof sub.cancellation_effective_date === 'string') {
                    effectiveDate = new Date(sub.cancellation_effective_date);
                } else {
                    effectiveDate = sub.cancellation_effective_date;
                }
                planExpiryDateEl.textContent = `${effectiveDate.toLocaleDateString()} (Access remains until this date)`;
                planExpiryEl.classList.remove('hidden');
            }

        } else { // Free tier or other non-active states
            currentPlanEl.textContent = "Free";
            subscriptionOptionsEl.classList.remove('hidden'); // Show upgrade options
            planExpiryEl.classList.add('hidden');
        }
    } else { // No subscription data, assume free
        currentPlanEl.textContent = "Free";
        subscriptionOptionsEl.classList.remove('hidden');
        planExpiryEl.classList.add('hidden');
    }
}


// Expose functions to global scope if they need to be called from HTML or other scripts directly
window.initializePaystackTransaction = initializePaystackTransaction;
window.updateUserSubscriptionUI = updateUserSubscriptionUI;
window.fetchAppConfig = fetchAppConfig;