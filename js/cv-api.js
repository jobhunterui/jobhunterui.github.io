// Gemini CV Generator API Client

/**
 * Configuration for the CV Generator API
 */
const CV_API_CONFIG = {
    baseUrl: 'https://jobhunter-api-3gbd.onrender.com', // Your actual backend URL
    API_V1_STR: '/api/v1',
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
window.generateCoverLetter = generateCoverLetter_API; // Expose globally

/**
 * Uploads a CV file to the backend for parsing and structuring.
 *
 * @param {File} fileObject - The file object to upload.
 * @returns {Promise<Object>} - The structured CV data and quota information.
 * @throws {Error} - If the API request fails, user is not authenticated, or requires upgrade.
 */
async function uploadAndParseCV(fileObject) {
    if (!fileObject) {
        throw new Error('File object is required for uploading.');
    }

    const idToken = await getIdToken(); // Uses existing getIdToken function
    if (!idToken) {
        // This will be caught by the calling function in app.js which can show a more contextual modal
        throw new Error('AUTH_FAILED: User not authenticated. Please sign in.');
    }

    const formData = new FormData();
    formData.append('file', fileObject);

    const options = {
        method: 'POST',
        headers: {
            // 'Content-Type' is not set here; browser sets it for FormData with boundary
            'Authorization': `Bearer ${idToken}`
        },
        body: formData
    };

    const controller = new AbortController();
    // Longer timeout for file upload + parsing + AI structuring
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout * 1.5); // 180 seconds
    options.signal = controller.signal;

    try {
        if (typeof trackEvent === 'function') trackEvent('cv_parse_upload_started', { file_name: fileObject.name, file_type: fileObject.type });

        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.API_V1_STR || '/api/v1'}/cv/upload_and_parse_cv`, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status} ${response.statusText}` }));
            let customError = new Error(errorData.detail || `API error: ${response.status}`);
            customError.status = response.status;

            if (response.status === 401) {
                customError.message = "AUTH_FAILED: " + (errorData.detail || 'Authentication failed. Please sign in again.');
            } else if (response.status === 402 || response.status === 403) { // Payment Required or Forbidden
                customError.message = "UPGRADE_REQUIRED: " + (errorData.detail || "This is a premium feature.");
            } else if (response.status === 400) { // Bad request (e.g., unsupported file type)
                customError.message = "BAD_REQUEST: " + (errorData.detail || "Invalid file or request.");
            } else if (response.status === 422) { // Unprocessable entity (e.g. cannot extract text)
                customError.message = "UNPROCESSABLE_FILE: " + (errorData.detail || "Could not process the file content.");
            } else if (response.status === 429) { // Rate limited
                customError.message = errorData.detail || 'Daily API quota reached.';
            }
            throw customError;
        }

        const data = await response.json();
        if (typeof trackEvent === 'function') trackEvent('cv_parse_upload_success', { remaining_quota: data.quota?.remaining || 0 });
        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            if (typeof trackEvent === 'function') trackEvent('cv_parse_upload_timeout');
            throw new Error('CV upload and parse request timed out. The server might be busy or the file too large. Please try again.');
        }
        console.error("Full error in uploadAndParseCV:", error);
        throw error; // Re-throw the processed/custom error
    }
}
window.uploadAndParseCV = uploadAndParseCV; // Expose globally

/**
 * Generates a professional profile using the API
 *
 * @param {string} cvText - The user's CV/resume text
 * @param {string} nonProfessionalExperience - Non-professional experiences
 * @param {string} workApproach - Selected work approach (leader, analyst, creative, independent, adaptive)
 * @param {string} problemSolvingExample - Problem-solving example text
 * @param {string} workValues - Selected work values (impact, learning, stability, balance, meaningful, innovation)
 * @returns {Promise<Object>} - The generated professional profile data
 * @throws {Error} - If the API request fails or user is not authenticated
 */
async function generateProfessionalProfile(cvText, nonProfessionalExperience, workApproach, problemSolvingExample, workValues) {
    if (!cvText || !nonProfessionalExperience || !workApproach || !problemSolvingExample || !workValues) {
        throw new Error('All profile parameters are required');
    }

    const idToken = await getIdToken();
    if (!idToken) {
        throw new Error('User not authenticated. Please sign in.');
    }

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
            cv_text: cvText,
            non_professional_experience: nonProfessionalExperience,
            work_approach: workApproach,
            problem_solving_example: problemSolvingExample,
            work_values: workValues
        })
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout * 1.5); // 180 seconds for profiling
    options.signal = controller.signal;

    try {
        if (typeof trackEvent === 'function') {
            trackEvent('professional_profiling_started', {
                work_approach: workApproach,
                work_values: workValues
            });
        }

        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.API_V1_STR}/profiling/generate_profile`, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status} ${response.statusText}` }));
            let customError = new Error(errorData.detail || `API error: ${response.status}`);
            customError.status = response.status;

            if (response.status === 401) {
                if (typeof showModal === 'function' && typeof window.signInWithGoogle === 'function') {
                    showModal('Authentication Failed', errorData.detail || 'Your session may have expired. Please sign in again.', [
                        { id: 'sign-in-profiling-auth-fail', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
                    ]);
                }
                customError.message = "AUTH_FAILED: " + customError.message;
            } else if (response.status === 402 || response.status === 403) {
                if (typeof trackEvent === 'function') trackEvent('profiling_premium_required');
                customError.message = "UPGRADE_REQUIRED: " + (errorData.detail || "This is a premium feature.");
            } else if (response.status === 429) {
                if (typeof trackEvent === 'function') trackEvent('profiling_rate_limited');
                customError.message = errorData.detail || 'Daily profiling limit reached.';
            }
            throw customError;
        }

        const data = await response.json();
        if (typeof trackEvent === 'function') {
            trackEvent('professional_profiling_success', {
                remaining_quota: data.quota?.remaining || 0,
                work_approach: workApproach,
                work_values: workValues
            });
        }
        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            if (typeof trackEvent === 'function') trackEvent('profiling_timeout');
            throw new Error('Professional profiling request timed out. The analysis takes longer due to its depth. Please try again.');
        }
        console.error("Full error in generateProfessionalProfile:", error);
        throw error;
    }
}

/**
 * Retrieves the user's existing professional profile
 *
 * @returns {Promise<Object>} - The user's existing professional profile or null if none exists
 * @throws {Error} - If the API request fails or user is not authenticated
 */
async function getExistingProfile() {
    const idToken = await getIdToken();
    if (!idToken) {
        throw new Error('User not authenticated. Please sign in.');
    }

    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout);
    options.signal = controller.signal;

    try {
        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.API_V1_STR}/profiling/my_profile`, options);
        clearTimeout(timeoutId);

        if (response.status === 404) {
            // No profile exists yet
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status} ${response.statusText}` }));
            let customError = new Error(errorData.detail || `API error: ${response.status}`);
            customError.status = response.status;

            if (response.status === 401) {
                customError.message = "AUTH_FAILED: " + customError.message;
            }
            throw customError;
        }

        const data = await response.json();
        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request to fetch existing profile timed out. Please try again.');
        }
        console.error("Error in getExistingProfile:", error);
        throw error;
    }
}

/**
 * Check if current user has admin access based on email
 * @returns {boolean} - Whether user has admin access
 */
function hasAdminAccess() {
    // Define admin email addresses - KEEP THIS IN SYNC WITH app.js
    const ADMIN_EMAILS = [
        'osiokeitseuwa@gmail.com',
        // 'another-admin@example.com',  // Add more admin emails here
    ];

    const isAdmin = window.currentUser &&
        window.currentUser.email &&
        ADMIN_EMAILS.includes(window.currentUser.email.toLowerCase());

    if (!isAdmin && window.currentUser) {
        console.warn('Admin API access denied for user:', window.currentUser.email);

        if (typeof trackEvent === 'function') {
            trackEvent('admin_api_access_denied', {
                user_email: window.currentUser.email,
                timestamp: new Date().toISOString()
            });
        }
    }

    return isAdmin;
}

/**
 * Admin API Functions for fetching all user profiles
 */

/**
 * Fetches all user profiles for admin dashboard
 * @returns {Promise<Object>} - Array of all user profiles with pagination info
 * @throws {Error} - If the API request fails or user is not authenticated
 */
async function getAllProfiles() {
    // Check admin access before making API call
    if (!hasAdminAccess()) {
        throw new Error('ACCESS_DENIED: Admin access required. Contact administrator if you need access.');
    }
    
    const idToken = await getIdToken();
    if (!idToken) {
        throw new Error('User not authenticated. Please sign in.');
    }

    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout);
    options.signal = controller.signal;

    try {
        const response = await fetch(`${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.API_V1_STR}/profiling/admin/all_profiles`, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status} ${response.statusText}` }));
            let customError = new Error(errorData.detail || `API error: ${response.status}`);
            customError.status = response.status;

            if (response.status === 401) {
                customError.message = "AUTH_FAILED: " + customError.message;
            } else if (response.status === 403) {
                customError.message = "ACCESS_DENIED: Admin access required.";
            }
            throw customError;
        }

        const data = await response.json();

        // Track admin dashboard usage
        if (typeof trackEvent === 'function') {
            trackEvent('admin_profiles_fetched', {
                total_profiles: data.profiles?.length || 0,
                admin_user: window.currentUser?.email || 'unknown'
            });
        }

        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request to fetch profiles timed out. Please try again.');
        }
        console.error("Error in getAllProfiles:", error);
        throw error;
    }
}

/**
 * Fetches paginated user profiles for admin dashboard
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of profiles per page
 * @param {Object} filters - Filter criteria (optional)
 * @returns {Promise<Object>} - Paginated profiles with metadata
 * @throws {Error} - If the API request fails
 */
async function getProfilesPaginated(page = 1, limit = 20, filters = {}) {
    const idToken = await getIdToken();
    if (!idToken) {
        throw new Error('User not authenticated. Please sign in.');
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
    });

    // Add filters to query params
    Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim()) {
            queryParams.append(key, value);
        }
    });

    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout);
    options.signal = controller.signal;

    try {
        const url = `${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.API_V1_STR}/profiling/admin/all_profiles?${queryParams}`;
        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `API error: ${response.status} ${response.statusText}` }));
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
        }
        console.error("Error in getProfilesPaginated:", error);
        throw error;
    }
}

/**
 * Export all profiles data for admin purposes
 * @param {string} format - Export format ('json' or 'csv')
 * @returns {Promise<Blob>} - Export data as blob
 * @throws {Error} - If the API request fails
 */
async function exportAllProfiles(format = 'json') {
    try {
        const profilesData = await getAllProfiles();

        if (format === 'csv') {
            return exportProfilesToCSV(profilesData.profiles);
        } else {
            return exportProfilesToJSON(profilesData);
        }
    } catch (error) {
        console.error("Error in exportAllProfiles:", error);
        throw error;
    }
}

/**
 * Helper function to export profiles to JSON format
 * @param {Object} profilesData - Complete profiles data
 * @returns {Blob} - JSON blob for download
 */
function exportProfilesToJSON(profilesData) {
    const exportData = {
        exportType: 'admin_profiles_export',
        exportDate: new Date().toISOString(),
        totalProfiles: profilesData.profiles?.length || 0,
        profiles: profilesData.profiles || [],
        summary: profilesData.summary || {},
        version: '1.0.0'
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
}

/**
 * Helper function to export profiles to CSV format
 * @param {Array} profiles - Array of profile objects
 * @returns {Blob} - CSV blob for download
 */
function exportProfilesToCSV(profiles) {
    if (!profiles || profiles.length === 0) {
        return new Blob(['No profiles available for export'], { type: 'text/csv' });
    }

    // Define CSV headers
    const headers = [
        'User Email',
        'Profile Created',
        'Communication Style',
        'Motivation Drivers',
        'Top Skills',
        'Recommended Roles',
        'Match Percentages',
        'Personality Traits',
        'Work Approach',
        'Work Values'
    ];

    // Convert profiles to CSV rows
    const rows = profiles.map(profile => {
        const personality = profile.profile_data?.personality_analysis || {};
        const skills = profile.profile_data?.skills_assessment || {};
        const roles = profile.profile_data?.role_recommendations || [];

        // Extract top skills from different categories
        const topSkills = [];
        if (skills.technical_skills?.expert_level) {
            topSkills.push(...skills.technical_skills.expert_level.slice(0, 5));
        }
        if (skills.soft_skills) {
            topSkills.push(...skills.soft_skills.slice(0, 3));
        }

        // Extract role recommendations
        const roleNames = roles.map(role => role.role_title).slice(0, 3);
        const matchPercentages = roles.map(role => `${role.role_title}: ${role.match_percentage}%`).slice(0, 3);

        // Extract personality traits
        const personalityTraits = [];
        if (personality.core_traits) {
            Object.entries(personality.core_traits).forEach(([trait, data]) => {
                personalityTraits.push(`${trait}: ${data.level}`);
            });
        }

        return [
            profile.user_email || 'Unknown',
            profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown',
            personality.communication_style || 'Not specified',
            personality.motivation_drivers || 'Not specified',
            topSkills.join('; ') || 'Not specified',
            roleNames.join('; ') || 'Not specified',
            matchPercentages.join('; ') || 'Not specified',
            personalityTraits.join('; ') || 'Not specified',
            profile.user_inputs?.work_approach || 'Not specified',
            profile.user_inputs?.work_values || 'Not specified'
        ];
    });

    // Combine headers and rows
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    return new Blob([csvContent], { type: 'text/csv' });
}

/**
 * Download blob as file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - Filename for download
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Expose globally for admin dashboard
window.getAllProfiles = getAllProfiles;
window.getProfilesPaginated = getProfilesPaginated;
window.exportAllProfiles = exportAllProfiles;
window.downloadBlob = downloadBlob;

// Expose globally
window.generateProfessionalProfile = generateProfessionalProfile;
window.getExistingProfile = getExistingProfile;