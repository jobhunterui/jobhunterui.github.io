// js/payments.js

const API_BASE_URL = 'https://jobhunter-api-3gbd.onrender.com/api/v1'; // Your backend API URL
const PAYMENT_CALLBACK_URL = 'https://jobhunterui.github.io/payment-callback.html'; // Your deployed callback URL

/**
 * Initiates a Paystack transaction for the selected plan.
 * @param {string} planIdentifier - e.g., "monthly", "yearly"
 */
async function initializePaystackTransaction(planIdentifier) {
    if (!window.auth || !window.auth.currentUser) {
        console.error("User not signed in. Cannot initialize payment.");
        showModal("Authentication Required", "Please sign in to subscribe.", [
            { id: 'sign-in-subscribe', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
        ]);
        return;
    }

    const user = window.auth.currentUser;
    const idToken = await user.getIdToken(true); // Force refresh token

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
                callback_url: PAYMENT_CALLBACK_URL
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
            // Redirect to Paystack's payment page
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
        if (planName.startsWith("premium_")) {
            planName = planName.replace("premium_", "");
            planName = planName.charAt(0).toUpperCase() + planName.slice(1) + " Premium";
        } else if (planName === "free") {
            planName = "Free";
        }
        currentPlanEl.textContent = planName;

        if (sub.tier !== "free" && sub.status === "active") {
            subscriptionOptionsEl.classList.add('hidden'); // Hide upgrade options if already premium
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
            // User is on a premium plan that will not renew
            subscriptionOptionsEl.classList.add('hidden'); // Still on premium, don't show upgrade yet
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