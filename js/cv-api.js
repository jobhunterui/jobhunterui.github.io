// Gemini CV Generator API Client

/**
 * Configuration for the CV Generator API
 */
const CV_API_CONFIG = {
    baseUrl: 'https://jobhunter-api-3gbd.onrender.com',
    // It's good practice to define the full path to specific endpoints here
    // or construct them dynamically if you have many.
    // Assuming your API_V1_STR is '/api/v1' as per your backend config.
    cvGeneratePath: '/api/v1/cv/generate',
    coverLetterGeneratePath: '/api/v1/cv/generate-cover-letter',
    timeout: 45000, // 45 seconds timeout for API calls
};

/**
 * Helper function to get the Firebase ID token.
 * @returns {Promise<string|null>} The Firebase ID token or null if not available.
 */
async function getIdToken() {
    if (window.auth && window.auth.currentUser) {
        try {
            // true forces a token refresh if the current token is expired.
            return await window.auth.currentUser.getIdToken(true);
        } catch (error) {
            console.error("Error getting Firebase ID token:", error);
            // Potentially trigger a sign-in prompt or handle re-authentication
            if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
                showModal('Session Expired', 'Your session has expired. Please sign in again to continue.', [
                    { id: 'sign-in-token-refresh', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
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
 * @throws {Error} - If the API request fails or user is not authenticated
 */
async function generateCV(jobDescription, resume, feedback = "") {
    if (!jobDescription || !resume) {
        throw new Error('Job description and resume are required');
    }

    const idToken = await getIdToken();
    if (!idToken) {
        if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
            showModal('Authentication Required', 'Please sign in to generate CVs.', [
                { id: 'sign-in-cv-gen', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
            ]);
        }
        throw new Error('User not authenticated. Cannot generate CV.');
    }

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` // Add the token here
        },
        body: JSON.stringify({
            job_description: jobDescription,
            resume: resume,
            feedback: feedback // Ensure this matches your CVRequest Pydantic model
        })
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout);
    options.signal = controller.signal;

    try {
        if (typeof trackEvent === 'function') {
            trackEvent('cv_generation_started', {
                job_description_length: jobDescription.length,
                resume_length: resume.length,
                has_feedback: !!feedback
            });
        }

        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.cvGeneratePath}`, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status}` }));
            if (response.status === 401) { // Unauthorized
                if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
                    showModal('Authentication Failed', errorData.detail || 'Please sign in again.', [
                        { id: 'sign-in-cv-auth-failed', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
                    ]);
                }
            } else if (response.status === 429) { // Rate limited
                if (typeof trackEvent === 'function') trackEvent('cv_generation_rate_limited');
                // The detail message comes from your backend's HTTPException
                throw new Error(errorData.detail || 'Daily generation limit reached.');
            }
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        const data = await response.json();
        if (typeof trackEvent === 'function') {
            trackEvent('cv_generation_success', {
                remaining_quota: data.quota?.remaining || 0
            });
        }
        return data;

    } catch (error) {
        clearTimeout(timeoutId); // Ensure timeout is cleared on any error
        if (error.name === 'AbortError') {
            if (typeof trackEvent === 'function') trackEvent('cv_generation_timeout');
            throw new Error('Request timed out. Please try again.');
        }
        if (typeof trackEvent === 'function') {
            trackEvent('cv_generation_error', { error_message: error.message });
        }
        throw error; // Re-throw for higher-level handlers
    }
}


/**
 * Generates a cover letter using the API based on job description and resume
 *
 * @param {string} jobDescription - The job description text
 * @param {string} resume - The user's resume text
 * @param {string} [feedback=""] - Optional feedback for regeneration
 * @returns {Promise<Object>} - The generated cover letter text and quota information
 * @throws {Error} - If the API request fails or user is not authenticated
 */
async function generateCoverLetter(jobDescription, resume, feedback = "") {
    if (!jobDescription || !resume) {
        throw new Error('Job description and resume are required');
    }

    const idToken = await getIdToken();
    if (!idToken) {
        if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
            showModal('Authentication Required', 'Please sign in to generate cover letters.', [
                { id: 'sign-in-cl-gen', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
            ]);
        }
        throw new Error('User not authenticated. Cannot generate cover letter.');
    }

    const feedbackStr = typeof feedback === 'object' ? JSON.stringify(feedback) : (feedback || "");

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` // Add the token here
        },
        body: JSON.stringify({
            job_description: jobDescription,
            resume: resume,
            feedback: feedbackStr
        })
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout);
    options.signal = controller.signal;

    try {
        if (typeof trackEvent === 'function') {
            trackEvent('cover_letter_generation_started', {
                job_description_length: jobDescription.length,
                resume_length: resume.length,
                has_feedback: !!feedbackStr
            });
        }

        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.coverLetterGeneratePath}`, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status}` }));
             if (response.status === 401) { // Unauthorized
                if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
                    showModal('Authentication Failed', errorData.detail || 'Please sign in again.', [
                        { id: 'sign-in-cl-auth-failed', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
                    ]);
                }
            } else if (response.status === 429) { // Rate limited
                if (typeof trackEvent === 'function') trackEvent('cover_letter_generation_rate_limited');
                throw new Error(errorData.detail || 'Daily generation limit reached.');
            }
            console.error('API Error Response for Cover Letter:', errorData);
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        const data = await response.json();
        if (typeof trackEvent === 'function') {
            trackEvent('cover_letter_generation_success', {
                remaining_quota: data.quota?.remaining || 0
            });
        }
        return data;

    } catch (error) {
        clearTimeout(timeoutId); // Ensure timeout is cleared on any error
        if (error.name === 'AbortError') {
            if (typeof trackEvent === 'function') trackEvent('cover_letter_generation_timeout');
            throw new Error('Request timed out. Please try again.');
        }
        if (typeof trackEvent === 'function') {
            trackEvent('cover_letter_generation_error', { error_message: error.message });
        }
        throw error; // Re-throw for higher-level handlers
    }
}