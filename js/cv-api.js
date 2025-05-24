// Gemini CV Generator API Client

/**
 * Configuration for the CV Generator API
 */
const CV_API_CONFIG = {
    baseUrl: 'https://jobhunter-api-3gbd.onrender.com',
    cvGeneratePath: '/api/v1/cv/generate',
    coverLetterGeneratePath: '/api/v1/cv/generate-cover-letter',
    userProfilePath: '/api/v1/users/me', // Added for fetching user profile
    timeout: 120000, // Increased timeout to 120 seconds for potentially longer AI generations
};

/**
 * Helper function to get the Firebase ID token.
 * @returns {Promise<string|null>} The Firebase ID token or null if not available.
 */
async function getIdToken() {
    if (window.auth && window.auth.currentUser) {
        try {
            return await window.auth.currentUser.getIdToken(true);
        } catch (error) {
            console.error("Error getting Firebase ID token:", error);
            if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
                showModal('Session Expired', 'Your session has expired or is invalid. Please sign in again to continue.', [
                    { id: 'sign-in-token-refresh-api', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
                ]);
            }
            return null;
        }
    }
    console.warn("User not signed in or Firebase auth not available. Cannot get ID token.");
    return null;
}

/**
 * Generates a CV using the API based on job description and resume
 *
 * @param {string} jobDescription - The job description text
 * @param {string} resume - The user's resume text
 * @param {string} [feedback=""] - Optional feedback for regeneration
 * @returns {Promise<Object>} - The generated CV data and quota information
 * @throws {Error} - If the API request fails, user is not authenticated, or requires upgrade.
 */
async function generateCV_API(jobDescription, resume, feedback = "") { // Renamed to avoid conflict if old generateCV is global
    if (!jobDescription || !resume) {
        throw new Error('Job description and resume are required');
    }

    const idToken = await getIdToken();
    if (!idToken) {
        // No need to show modal here, prompts.js's canAccessFeature will handle it or getIdToken itself.
        throw new Error('User not authenticated. Please sign in.');
    }

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ job_description: jobDescription, resume: resume, feedback: feedback })
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout);
    options.signal = controller.signal;

    try {
        if (typeof trackEvent === 'function') trackEvent('cv_generation_started', { /* ...params */ });

        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.cvGeneratePath}`, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status} ${response.statusText}` }));
            let customError = new Error(errorData.detail || `API error: ${response.status}`);
            customError.status = response.status; // Attach status to the error object

            if (response.status === 401) { // Unauthorized (e.g. bad token)
                if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
                    showModal('Authentication Failed', errorData.detail || 'Your session may have expired. Please sign in again.', [
                        { id: 'sign-in-cv-auth-fail-api', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
                    ]);
                }
                customError.message = "AUTH_FAILED: " + customError.message; // For prompts.js to potentially catch
            } else if (response.status === 402 || response.status === 403) { // Payment Required or Forbidden
                if (typeof trackEvent === 'function') trackEvent('cv_generation_premium_required');
                // Message will be handled by prompts.js to show upgrade modal
                customError.message = "UPGRADE_REQUIRED: " + (errorData.detail || "This is a premium feature.");
            } else if (response.status === 429) { // Rate limited
                if (typeof trackEvent === 'function') trackEvent('cv_generation_rate_limited');
                customError.message = errorData.detail || 'Daily generation limit reached.'; // Already specific
            }
            throw customError;
        }

        const data = await response.json();
        if (typeof trackEvent === 'function') trackEvent('cv_generation_success', { remaining_quota: data.quota?.remaining || 0 });
        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            if (typeof trackEvent === 'function') trackEvent('cv_generation_timeout');
            throw new Error('CV generation request timed out. The server might be busy. Please try again shortly.');
        }
        // Log original error for more details if needed
        console.error("Full error in generateCV_API:", error);
        // Re-throw the processed/custom error for prompts.js
        throw error;
    }
}
window.generateCV = generateCV_API; // Expose with a consistent name

/**
 * Generates a cover letter using the API
 * @param {string} jobDescription
 * @param {string} resume
 * @param {string} [feedback=""]
 * @returns {Promise<Object>}
 * @throws {Error}
 */
async function generateCoverLetter_API(jobDescription, resume, feedback = "") { // Renamed
    if (!jobDescription || !resume) throw new Error('Job description and resume are required');

    const idToken = await getIdToken();
    if (!idToken) throw new Error('User not authenticated. Please sign in.');

    const feedbackStr = typeof feedback === 'object' ? JSON.stringify(feedback) : (feedback || "");
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ job_description: jobDescription, resume: resume, feedback: feedbackStr })
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout);
    options.signal = controller.signal;

    try {
        if (typeof trackEvent === 'function') trackEvent('cover_letter_generation_started', { /* ...params */ });

        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.coverLetterGeneratePath}`, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status} ${response.statusText}` }));
            let customError = new Error(errorData.detail || `API error: ${response.status}`);
            customError.status = response.status;

            if (response.status === 401) {
                if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
                    showModal('Authentication Failed', errorData.detail || 'Your session may have expired. Please sign in again.', [
                        { id: 'sign-in-cl-auth-fail-api', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
                    ]);
                }
                customError.message = "AUTH_FAILED: " + customError.message;
            } else if (response.status === 402 || response.status === 403) {
                if (typeof trackEvent === 'function') trackEvent('cl_generation_premium_required');
                customError.message = "UPGRADE_REQUIRED: " + (errorData.detail || "This is a premium feature.");
            } else if (response.status === 429) {
                if (typeof trackEvent === 'function') trackEvent('cover_letter_generation_rate_limited');
                customError.message = errorData.detail || 'Daily generation limit reached.';
            }
            throw customError;
        }

        const data = await response.json();
        if (typeof trackEvent === 'function') trackEvent('cover_letter_generation_success', { remaining_quota: data.quota?.remaining || 0 });
        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            if (typeof trackEvent === 'function') trackEvent('cover_letter_generation_timeout');
            throw new Error('Cover letter generation request timed out. The server might be busy. Please try again shortly.');
        }
        console.error("Full error in generateCoverLetter_API:", error);
        throw error;
    }
}
window.generateCoverLetter = generateCoverLetter_API; // Expose