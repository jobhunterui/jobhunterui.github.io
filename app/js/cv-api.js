// Gemini CV Generator API Client

/**
 * Configuration for the CV Generator API
 */
const CV_API_CONFIG = {
    baseUrl: 'https://jobhunter-api.onrender.com', // Will be updated once deployed
    localUrl: 'http://localhost:8000',
    apiPath: '/api/v1/cv/generate',
    timeout: 45000, // 45 seconds timeout for API calls
};

/**
 * Generates a CV using the API based on job description and resume
 * 
 * @param {string} jobDescription - The job description text
 * @param {string} resume - The user's resume text
 * @returns {Promise<Object>} - The generated CV data and quota information
 * @throws {Error} - If the API request fails
 */
async function generateCV(jobDescription, resume) {
    // Validate inputs
    if (!jobDescription || !resume) {
        throw new Error('Job description and resume are required');
    }

    // Determine API URL (use local in development if available)
    let apiUrl = `${CV_API_CONFIG.baseUrl}${CV_API_CONFIG.apiPath}`;
    
    // Create request options
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            job_description: jobDescription,
            resume: resume
        })
    };

    try {
        // Track API request start
        if (typeof trackEvent === 'function') {
            trackEvent('cv_generation_started', {
                job_description_length: jobDescription.length,
                resume_length: resume.length
            });
        }

        // Set timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CV_API_CONFIG.timeout);
        options.signal = controller.signal;

        // Make the API request
        const response = await fetch(apiUrl, options);
        
        // Clear timeout
        clearTimeout(timeoutId);

        // Check if response is ok
        if (!response.ok) {
            // Handle rate limiting
            if (response.status === 429) {
                if (typeof trackEvent === 'function') {
                    trackEvent('cv_generation_rate_limited');
                }
                throw new Error('Daily generation limit reached. Please try again tomorrow.');
            }
            
            // Parse error response if possible
            try {
                const errorData = await response.json();
                throw new Error(errorData.detail || `API error: ${response.status}`);
            } catch (e) {
                throw new Error(`API error: ${response.status}`);
            }
        }

        // Parse response
        const data = await response.json();
        
        // Track successful generation
        if (typeof trackEvent === 'function') {
            trackEvent('cv_generation_success', {
                remaining_quota: data.quota?.remaining || 0
            });
        }

        return data;
    } catch (error) {
        // Handle abort/timeout
        if (error.name === 'AbortError') {
            if (typeof trackEvent === 'function') {
                trackEvent('cv_generation_timeout');
            }
            throw new Error('Request timed out. Please try again.');
        }

        // Track error
        if (typeof trackEvent === 'function') {
            trackEvent('cv_generation_error', {
                error_message: error.message
            });
        }

        // Re-throw error
        throw error;
    }
}

/**
 * Checks API availability and returns quota information
 * 
 * @returns {Promise<Object>} - Quota information
 */
async function checkApiStatus() {
    try {
        // First try the production URL
        const response = await fetch(`${CV_API_CONFIG.baseUrl}/health`, {
            method: 'GET'
        });
        
        if (response.ok) {
            return { available: true, url: CV_API_CONFIG.baseUrl };
        }
    } catch (e) {
        console.log('Production API not available, trying local...');
    }

    try {
        // Try the local URL as fallback
        const localResponse = await fetch(`${CV_API_CONFIG.localUrl}/health`, {
            method: 'GET'
        });
        
        if (localResponse.ok) {
            // Update the base URL to use local
            CV_API_CONFIG.baseUrl = CV_API_CONFIG.localUrl;
            return { available: true, url: CV_API_CONFIG.localUrl };
        }
    } catch (e) {
        console.log('Local API not available');
    }

    return { available: false };
}