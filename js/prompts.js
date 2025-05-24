// AI Prompt Generation for the Job Hunter Web App

let perplexityWindowOpen = false;

// Helper: Check if a feature is pro and user has access
function canAccessFeature(featureIdentifier) {
    // Revised featureDisplayNames as discussed
    const featureDisplayNames = {
        "gemini_cv_generation": "Gemini CV Generation",
        "gemini_cover_letter_generation": "Gemini Cover Letter Generation"
        // Add other feature display names here if they become Pro and require specific naming
    };
    // Default displayName if not in the map, converted to Title Case
    const displayName = featureDisplayNames[featureIdentifier] ||
        featureIdentifier.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

    if (!window.currentUser) {
        showModal("Sign In Required", `Please sign in to use the "${displayName}" feature.`, [
            { id: 'sign-in-feature-prompt', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
        ]);
        return false;
    }

    const subscription = window.currentUserSubscription;
    // These feature identifiers should match those in backend config.py PREMIUM_FEATURES
    const backendProFeatures = ["gemini_cv_generation", "gemini_cover_letter_generation"];

    if (backendProFeatures.includes(featureIdentifier)) {
        let userHasActivePro = false;
        if (subscription && subscription.tier && subscription.tier.toLowerCase() !== 'free' && subscription.status === 'active') {
            if (subscription.current_period_ends_at) {
                userHasActivePro = new Date(subscription.current_period_ends_at) > new Date();
            } else {
                userHasActivePro = true; // E.g., lifetime plan with no specific end date
            }
        }

        if (!userHasActivePro) {
            showModal(
                "Upgrade to Pro",
                `The "${displayName}" feature requires a Pro plan. Please upgrade your plan.`,
                [
                    {
                        id: 'upgrade-prompt-btn', text: 'Upgrade Plan', class: 'primary-button',
                        action: () => {
                            document.querySelector('.tab-button[data-tab="profile"]').click();
                            setTimeout(() => document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                        }
                    },
                    { id: 'cancel-prompt-btn', text: 'Maybe Later', class: 'default-button' }
                ]
            );
            return false;
        }
    }
    return true;
}

// Generate application with Claude
function generateApplication() {
    const selectedJob = document.querySelector('.job-item.selected');

    if (!selectedJob) {
        showModal('No Job Selected', 'Please select a job from your saved jobs first.');
        return;
    }

    const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
    const savedJobs = getSavedJobs();
    const job = savedJobs[jobIndex];

    const profileData = getProfileData();
    const cv = profileData.cv || '';

    if (!cv.trim()) {
        showModal('CV Missing', 'Please add your CV in the Profile tab first.', [
            {
                id: 'go-to-profile',
                text: 'Go to Profile',
                action: () => {
                    document.querySelector('[data-tab="profile"]').click();
                }
            }
        ]);
        return;
    }

    // Save the last generated job for later matching with Claude's response
    setStorageData('lastGeneratedJob', job);

    // Create prompt for Claude
    const prompt = createClaudePrompt(job, cv);

    // Function to handle successful clipboard copy
    function handleSuccessfulCopy() {
        // Show the JSON input field in profile
        const jsonInputSection = document.querySelector('.json-input-section');
        if (jsonInputSection) {
            jsonInputSection.classList.remove('hidden');
        }

        // Open Claude in a new tab
        window.open('https://claude.ai', '_blank');

        // Switch to profile tab
        document.querySelector('[data-tab="profile"]').click();

        // Show instructions
        showModal('Prompt Copied', 'Prompt copied to clipboard! Paste it into Claude, then copy the JSON response back to the extension.', [
            {
                id: 'ok-prompt',
                text: 'OK'
            }
        ]);

        // Track application generation
        if (typeof trackEvent === 'function') {
            trackEvent('application_generated', {
                job_title: job.title || '',
                company: job.company || '',
                has_cv: cv ? 'yes' : 'no'
            });
        }
    }

    // Try modern clipboard API first
    copyToClipboard(prompt).then(() => {
        handleSuccessfulCopy();
    }).catch(error => {
        console.error('Error copying to clipboard:', error);

        // Alternative method for clipboard
        const textArea = document.createElement('textarea');
        textArea.value = prompt;
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (success) {
                handleSuccessfulCopy();
            } else {
                showModal('Error', 'Could not copy the prompt. Please try again or copy it manually.');
            }
        } catch (err) {
            document.body.removeChild(textArea);
            showModal('Error', 'Could not copy the prompt. Please try again or copy it manually.');
        }
    });
}

function generateCoverLetterWithClaude() {
    const selectedJob = document.querySelector('.job-item.selected');

    if (!selectedJob) {
        showModal('No Job Selected', 'Please select a job from your saved jobs first.');
        return;
    }

    const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
    const savedJobs = getSavedJobs();
    const job = savedJobs[jobIndex];

    const profileData = getProfileData();
    const cv = profileData.cv || '';

    if (!cv.trim()) {
        showModal('CV Missing', 'Please add your CV in the Profile tab first.', [
            {
                id: 'go-to-profile',
                text: 'Go to Profile',
                action: () => {
                    document.querySelector('[data-tab="profile"]').click();
                }
            }
        ]);
        return;
    }

    // Save the last generated job for later reference
    setStorageData('lastGeneratedJob', job);

    // Create prompt for Claude
    const prompt = createClaudeCoverLetterPrompt(job, cv);

    // Function to handle successful clipboard copy
    function handleSuccessfulCopy() {
        // Open Claude in a new tab
        window.open('https://claude.ai', '_blank');

        // Show instructions
        showModal('Prompt Copied', 'Cover letter prompt copied to clipboard! Paste it into Claude, then copy the cover letter text to use.', [
            {
                id: 'ok-prompt',
                text: 'OK'
            }
        ]);

        // Track cover letter generation
        if (typeof trackEvent === 'function') {
            trackEvent('cover_letter_generated', {
                method: 'claude',
                job_title: job.title || '',
                company: job.company || '',
                has_cv: cv ? 'yes' : 'no'
            });
        }
    }

    // Try modern clipboard API first
    copyToClipboard(prompt).then(() => {
        handleSuccessfulCopy();
    }).catch(error => {
        console.error('Error copying to clipboard:', error);

        // Alternative method for clipboard
        const textArea = document.createElement('textarea');
        textArea.value = prompt;
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (success) {
                handleSuccessfulCopy();
            } else {
                showModal('Error', 'Could not copy the prompt. Please try again or copy it manually.');
            }
        } catch (err) {
            document.body.removeChild(textArea);
            showModal('Error', 'Could not copy the prompt. Please try again or copy it manually.');
        }
    });
}

// Helper function to copy to clipboard using Clipboard API
function copyToClipboard(text) {
    return navigator.clipboard.writeText(text);
}

/**
 * Creates and opens a preview of HTML content in a new tab/window
 * 
 * @param {string} htmlContent - The HTML content to preview
 * @returns {Window} - The opened window object
 */
function createAndOpenPreview(htmlContent) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    // Try to open the window
    const newWindow = window.open(blobUrl, '_blank');

    // Check if pop-up was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Pop-up was likely blocked
        showModal('Pop-up Blocked',
            'It looks like your browser blocked the CV preview. Please allow pop-ups for this site to view your CV, then try again.',
            [{
                id: 'try-again',
                text: 'Try Again',
                action: () => createAndOpenPreview(htmlContent)
            }]
        );

        // Clean up the blob URL
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        return null;
    }

    // Clean up blob URL when window closes
    if (newWindow) {
        newWindow.addEventListener('beforeunload', () => {
            URL.revokeObjectURL(blobUrl);
        });
    }

    return newWindow;
}

// Create prompt for Claude
function createClaudePrompt(job, cv) {
    return `I need help creating:
    1. A tailored CV in JSON format to use with my template 
    2. A cover letter I can use directly
    
    JOB DETAILS:
    Title: ${job.title}
    Company: ${job.company}
    Location: ${job.location || 'Not specified'}
    Description: ${job.description || 'Not provided'}
    
    MY CURRENT CV:
    ${cv}
    
    Please provide my CV information in JSON format in an artifact. The JSON must follow this exact structure:
    
    {
      "fullName": "Your full name from my CV",
      "jobTitle": "A title that matches the job I'm applying for",
      "summary": "A concise professional summary tailored to this role",
      "email": "My email from CV",
      "linkedin": "My LinkedIn URL from CV (or create one based on my name)",
      "phone": "My phone number from CV",
      "location": "My location from CV",
      
      "experience": [
        {
          "jobTitle": "Position title",
          "company": "Company name",
          "dates": "Start date - End date (or Present)",
          "description": "Brief description of role focused on relevant responsibilities",
          "achievements": [
            "Achievement 1 with quantifiable results",
            "Achievement 2 with quantifiable results",
            "Achievement 3 with quantifiable results"
          ],
          "relevanceScore": 95
        }
      ],
      
      "education": [
        {
          "degree": "Degree name",
          "institution": "Institution name",
          "dates": "Start year - End year",
          "relevanceScore": 80
        }
      ],
      
      "skills": [
        "Technical: JavaScript, React, Node.js, Python, etc.",
        "Soft Skills: Communication, Leadership, Problem-solving, etc."
      ],
      
      "certifications": [
        "Certification 1 with year if available",
        "Certification 2 with year if available"
      ],
      
      "skillGapAnalysis": {
        "matchingSkills": ["List skills from my CV that match this job"],
        "missingSkills": ["Important skills mentioned in job that I don't have"],
        "overallMatch": 85
      }
    }
    
    Make sure the JSON follows this exact structure as my app will parse it automatically. Prioritize skills and experience that are most relevant to the job description. For each experience and education item, add a relevanceScore from 0-100 indicating how relevant it is to this specific job. Also include the skillGapAnalysis section to help me understand my fit for the role.`;
}

function processCVJson(jsonData) {
    try {
        // First, try to clean the input by removing common issues
        let cleanedJson = jsonData.trim();

        // Remove markdown code block syntax if present
        if (cleanedJson.startsWith('```json')) {
            cleanedJson = cleanedJson.substring(7);
        } else if (cleanedJson.startsWith('```')) {
            cleanedJson = cleanedJson.substring(3);
        }

        if (cleanedJson.endsWith('```')) {
            cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
        }

        // Find JSON object boundaries - look for the first { and last }
        const firstBrace = cleanedJson.indexOf('{');
        const lastBrace = cleanedJson.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            // Extract just the JSON object
            cleanedJson = cleanedJson.substring(firstBrace, lastBrace + 1);
        }

        // Parse the cleaned JSON
        const cvData = JSON.parse(cleanedJson);

        // Save analysis to the currently selected job
        const selectedJob = document.querySelector('.job-item.selected');
        if (selectedJob) {
            const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
            if (typeof CareerInsights !== 'undefined' && CareerInsights.saveCVAnalysis) {
                CareerInsights.saveCVAnalysis(jobIndex, cvData);

                // Update the insights view if we're on the insights tab
                const insightsTab = document.querySelector('.tab-button[data-tab="insights"]');
                if (insightsTab && insightsTab.classList.contains('active')) {
                    // Update the UI with the new data
                    CareerInsights.refreshInsights();
                }
            }
        }

        return cvData;
    } catch (error) {
        console.error('Error parsing CV JSON:', error);

        // Create a more helpful error message
        let errorMessage = 'There was an error parsing the JSON. ';

        if (jsonData.includes('```')) {
            errorMessage += 'The JSON contains code block markers (```). Please remove these backticks. ';
        }

        if (!/^\s*{/.test(jsonData)) {
            errorMessage += 'The JSON should start with an opening brace {. ';
        }

        if (!/}\s*$/.test(jsonData)) {
            errorMessage += 'The JSON should end with a closing brace }. ';
        }

        errorMessage += '\n\nA valid JSON should look like:\n{\n  "fullName": "Your Name",\n  ...\n}';

        // Show the error message to the user
        showModal('JSON Parsing Error', errorMessage);

        return null;
    }
}

// Preview CV after getting response from Claude
function previewCV() {
    const jsonInput = document.getElementById('cv-json');

    if (!jsonInput || !jsonInput.value.trim()) {
        showModal('JSON Missing', 'Please paste the JSON output from Claude first.');
        return;
    }

    try {
        // Parse the JSON data using the new processCVJson function
        const data = processCVJson(jsonInput.value);

        if (!data) {
            showModal('Error', 'Error processing JSON data. Please make sure you pasted the correct format from Claude.');
            return;
        }

        // Extract data for ML models from Claude's response
        if (typeof trackEvent === 'function') {
            extractDataFromClaudeResponse(jsonInput.value);
        }

        // Create HTML content
        const htmlContent = generateCVHtml(data);

        // Track this preview creation
        if (typeof trackEvent === 'function') {
            trackEvent('preview_cv', { method: 'claude_json' });
        }

        // Use the helper function to create and open the preview
        createAndOpenPreview(htmlContent);

    } catch (e) {
        showModal('Error', 'Error parsing JSON. Please make sure you pasted the correct format from Claude: ' + e.message);
    }
}

// Extract data from Claude's response for tracking
function extractDataFromClaudeResponse(jsonData) {
    try {
        // Parse the JSON data from Claude
        const data = JSON.parse(jsonData);

        // Get stored job data to associate with this response
        const job = getStorageData('lastGeneratedJob') || {};
        const cv = getProfileData().cv || '';

        // Extract skills from Claude's JSON
        const cvSkills = [];
        if (data.skills && Array.isArray(data.skills)) {
            // Extract all skills that Claude identified
            data.skills.forEach(skillSet => {
                const skills = skillSet.split(':');
                if (skills.length > 1) {
                    // Get the skills after the category
                    const skillList = skills[1].split(',').map(s => s.trim());
                    cvSkills.push(...skillList);
                } else {
                    cvSkills.push(skillSet);
                }
            });
        }

        // Track the enriched data
        trackEvent('cv_job_match', {
            job_title: job.title || '',
            company: job.company || '',
            job_location: job.location || '',
            cv_skills: Array.isArray(cvSkills) ? cvSkills.join(', ') : '',
            matched_job_title: data.jobTitle || '',
            tailored_summary: data.summary || '',
            education: Array.isArray(data.education) ?
                data.education.map(e => `${e.degree}: ${e.institution}`).join('; ') : '',
            highlighted_experience: Array.isArray(data.experience) ?
                data.experience.map(e => e.jobTitle).join('; ') : ''
        });

    } catch (error) {
    }
}

// Function to parse skill categories from skill strings
function parseSkillCategories(skills) {
    if (!Array.isArray(skills)) return [];

    const parsedSkills = [];

    // Process each skill string
    skills.forEach(skillString => {
        // Check if the skill string contains a category (indicated by ":")
        const colonIndex = skillString.indexOf(':');

        if (colonIndex > 0) {
            // Split into category and skills
            const category = skillString.substring(0, colonIndex).trim();
            const skillsList = skillString.substring(colonIndex + 1).split(',').map(s => s.trim());

            parsedSkills.push({
                category: category,
                skills: skillsList
            });
        } else {
            // If no category found, add as "Other" category
            parsedSkills.push({
                category: "Other",
                skills: [skillString.trim()]
            });
        }
    });

    return parsedSkills;
}

// Generate HTML for CV preview
function generateCVHtml(data) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Professional CV</title>
    <style>
        :root {
            --primary-color: #20BF55;
            --secondary-color: #104738;
            --text-color: #333;
            --light-text: #666;
            --accent-color: #0077B5;
            --background-color: #f5f5f5;
            --card-background: white;
            --heading-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            --body-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: var(--body-font);
        }
        
        body {
            background-color: var(--background-color);
            color: var(--text-color);
            line-height: 1.4;
            font-size: 14px;
            padding: 25px;
        }
        
        .cv-container {
            max-width: 800px;
            margin: 0 auto;
            background-color: var(--card-background);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
            padding: 30px;
        }
        
        /* Print button */
        .print-controls {
            max-width: 800px;
            margin: 20px auto;
            text-align: center;
        }
        
        .print-controls button {
            background-color: #0077B5;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
            border-radius: 4px;
            margin: 5px;
        }
        
        /* Save instructions */
        .save-instructions {
            max-width: 800px;
            margin: 0 auto 20px auto;
            background: #f0f7ff;
            border: 1px solid #d0e3ff;
            padding: 15px;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .save-instructions summary {
            cursor: pointer;
            font-weight: bold;
            color: #0077B5;
        }
        
        .save-instructions div {
            margin-top: 10px;
        }
        
        /* Header section */
        .header {
            display: table;
            width: 100%;
            margin-bottom: 25px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
        }

        .name-title {
            display: table-cell;
            width: 65%;
            vertical-align: top;
        }

        .contact-info {
            display: table-cell;
            width: 35%;
            vertical-align: top;
            text-align: right;
        }
        
        h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 2px;
        }
        
        h2 {
            font-size: 18px;
            font-weight: 500;
            color: var(--accent-color);
            margin-bottom: 10px;
        }
        
        .summary {
            font-size: 14px;
            margin-top: 8px;
            max-width: 95%;
            line-height: 1.4;
        }
        
        .contact-info-label {
            font-size: 13px;
            color: var(--light-text);
            margin-bottom: 2px;
            margin-top: 8px;
            font-weight: 500;
        }
        
        .contact-info-value {
            font-size: 13px;
            margin-bottom: 5px;
        }
        
        .contact-info a {
            color: var(--accent-color);
            text-decoration: none;
        }
        
        /* Main content layout */
        .content {
            display: table;
            width: 100%;
        }

        .left-column {
            display: table-cell;
            width: 65%;
            vertical-align: top;
            padding-right: 20px;
        }

        .right-column {
            display: table-cell;
            width: 35%;
            vertical-align: top;
        }
        
        /* Section styling */
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--secondary-color);
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
        }
        
        /* Experience items */
        .job {
            margin-bottom: 15px;
        }
        
        .job-title {
            font-weight: 600;
            font-size: 15px;
            margin-bottom: 1px;
        }
        
        .job-company-date {
            display: table;
            width: 100%;
        }
        
        .job-company-date span:first-child {
            display: table-cell;
            text-align: left;
            font-size: 13px;
            color: var(--light-text);
            margin-bottom: 5px;
            font-style: italic;
        }
        
        .job-company-date span:last-child {
            display: table-cell;
            text-align: right;
            font-size: 13px;
            color: var(--light-text);
            margin-bottom: 5px;
            font-style: italic;
        }
        
        .job-description {
            font-size: 13px;
            margin-bottom: 3px;
            margin-top: 5px;
        }
        
        .job-achievements {
            padding-left: 18px;
            margin-top: 5px;
            font-size: 13px;
        }
        
        .job-achievements li {
            margin-bottom: 3px;
        }
        
        /* Education items */
        .education-item {
            margin-bottom: 12px;
        }
        
        .education-title {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 1px;
        }
        
        .education-inst-date {
            display: table;
            width: 100%;
        }
        
        .education-inst-date span:first-child {
            display: table-cell;
            text-align: left;
            font-size: 13px;
            color: var(--light-text);
            font-style: italic;
            margin-bottom: 3px;
        }
        
        .education-inst-date span:last-child {
            display: table-cell;
            text-align: right;
            font-size: 13px;
            color: var(--light-text);
            font-style: italic;
            margin-bottom: 3px;
        }
        
        /* Skills and other sections */
        .skills-list {
            margin-bottom: 15px;
        }
        
        .skill-category {
            font-weight: 600;
            display: inline;
        }
        
        /* Feedback section */
        .feedback-section {
            max-width: 800px;
            margin: 20px auto;
            background-color: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
            padding: 20px;
            text-align: center;
        }
        
        .feedback-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--secondary-color);
        }
        
        .feedback-buttons {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 10px;
        }
        
        .feedback-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            background: none;
            border: 1px solid #ddd;
            padding: 8px 15px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .feedback-btn:hover {
            background-color: #f5f5f5;
        }
        
        .feedback-btn svg {
            width: 20px;
            height: 20px;
        }
        
        #thumbs-up {
            color: #2ecc71;
        }
        
        #thumbs-up:hover {
            background-color: rgba(46, 204, 113, 0.1);
            border-color: #2ecc71;
        }
        
        #thumbs-down {
            color: #e74c3c;
        }
        
        #thumbs-down:hover {
            background-color: rgba(231, 76, 60, 0.1);
            border-color: #e74c3c;
        }
        
        .feedback-thankyou {
            color: #2ecc71;
            font-weight: bold;
        }
        
        /* Feedback form */
        #feedback-form {
            display: none;
            margin-top: 15px;
            text-align: left;
        }
        
        #feedback-form textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            min-height: 100px;
            margin-bottom: 10px;
            font-family: inherit;
            font-size: 14px;
        }
        
        #regenerate-btn {
            background-color: #0077B5;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 4px;
            margin-top: 10px;
        }

        /* Space-Efficient Skills Section */
        .skills-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px; /* Reduced gap between categories */
            margin-bottom: 15px;
        }

        .skill-category-container {
            margin-bottom: 6px; /* Reduced bottom margin */
            padding-bottom: 6px; /* Reduced padding */
            border-bottom: none; /* Remove bottom border to save space */
        }

        .skill-category-title {
            font-weight: 600; /* Slightly less bold */
            color: var(--secondary-color);
            margin-bottom: 4px; /* Less space after title */
            font-size: 12px; /* Slightly smaller font */
            display: inline-block; /* Allow items to flow beside if space permits */
            margin-right: 8px; /* Space to the right of title */
            border-left: 2px solid var(--accent-color); /* Thinner accent border */
            padding-left: 4px; /* Less padding */
        }

        .skill-items {
            display: inline-flex; /* Allow items to flow in line with category if space permits */
            flex-wrap: wrap;
            gap: 4px; /* Tighter spacing between items */
        }

        .skill-item {
            background-color: #f5f5f5;
            padding: 2px 8px; /* Less vertical padding */
            border-radius: 3px; /* Slightly less rounded */
            font-size: 11px; /* Smaller font size */
            display: inline-block;
            margin-bottom: 2px; /* Less bottom margin */
            box-shadow: none; /* Remove shadow to reduce visual weight */
            line-height: 1.3; /* Tighter line height */
        }
        
        /* Print styles */
        @media print {
            body {
                padding: 0;
                background-color: white;
                font-size: 12px;
            }
            
            .cv-container {
                box-shadow: none;
                padding: 20px;
                max-width: 100%;
            }
            
            .print-controls, .feedback-section, .save-instructions {
                display: none;
            }
            
            h1 {
                font-size: 22px;
            }
            
            h2 {
                font-size: 16px;
            }

            .skill-item {
                background-color: #f5f5f5 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .skill-category-title {
                border-left-color: var(--accent-color) !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            
            .summary, .job-description, .job-achievements, .education-item, .skills-list {
                font-size: 11px;
            }
            
            .section-title {
                font-size: 14px;
            }
            
            .job, .education-item {
                page-break-inside: avoid;
            }
            
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    <div class="save-instructions">
        <details>
            <summary>How to save this document</summary>
            <div>
                <p><strong>On iPhone/iPad:</strong> Tap the share icon, select "Options" and change to "PDF", then tap "Done". Now select "Save to Files" in the share menu.</p>
                <p><strong>On Android:</strong> Tap the print button below or use the browser's print option, then select "Save as PDF".</p>
                <p><strong>On Computer:</strong> Use the Print button and select "Save as PDF" or print to a physical printer.</p>
            </div>
        </details>
    </div>

    <div class="print-controls">
        <button onclick="window.print()">Print CV</button>
        <button onclick="window.close()">Close</button>
    </div>

    <div class="cv-container">
        <div class="header">
            <div class="name-title">
                <h1>${data.fullName || ''}</h1>
                <h2>${data.jobTitle || ''}</h2>
                <p class="summary">${data.summary || ''}</p>
            </div>
            <div class="contact-info">
                <div class="contact-info-label">Email</div>
                <div class="contact-info-value"><a href="mailto:${data.email || ''}">${data.email || ''}</a></div>
        
                <div class="contact-info-label">LinkedIn</div>
                <div class="contact-info-value"><a href="${data.linkedin || ''}">${data.linkedin || ''}</a></div>
        
                <div class="contact-info-label">Phone</div>
                <div class="contact-info-value">${data.phone || ''}</div>
        
                <div class="contact-info-label">Location</div>
                <div class="contact-info-value">${data.location || ''}</div>
            </div>
        </div>
        
        <div class="content">
            <div class="left-column">
                <h3 class="section-title">Work Experience</h3>
                ${data.experience ? data.experience.map(exp => `
                    <div class="job">
                        <div class="job-title">${exp.jobTitle || ''}</div>
                        <div class="job-company-date">
                            <span>${exp.company || ''}</span>
                            <span>${exp.dates || ''}</span>
                        </div>
                        <div class="job-description">${exp.description || ''}</div>
                        ${exp.achievements ? `
                            <ul class="job-achievements">
                                ${exp.achievements.map(achievement => `
                                    <li>${achievement}</li>
                                `).join('')}
                            </ul>
                        ` : ''}
                    </div>
                `).join('') : ''}
            </div>
        
            <div class="right-column">
                <h3 class="section-title">Education</h3>
                ${data.education ? data.education.map(edu => `
                    <div class="education-item">
                        <div class="education-title">${edu.degree || ''}</div>
                        <div class="education-inst-date">
                            <span>${edu.institution || ''}</span>
                            <span>${edu.dates || ''}</span>
                        </div>
                    </div>
                `).join('') : ''}
        
                <h3 class="section-title">Skills</h3>
                <div class="skills-grid">
                    ${data.skills ? parseSkillCategories(data.skills).map(skillCategory => `
                        <div class="skill-category-container">
                            <div class="skill-category-title">${skillCategory.category}</div>
                            <div class="skill-items">
                                ${skillCategory.skills.map(skill => `
                                    <span class="skill-item">${skill}</span>
                                `).join('')}
                            </div>
                        </div>
                    `).join('') : ''}
                </div>
        
                ${data.certifications && data.certifications.length > 0 ? `
                    <h3 class="section-title">Certifications</h3>
                    <div class="skills-list">
                        ${data.certifications.map(cert => `<p>${cert}</p>`).join('')}
                    </div>
                ` : ''}
                
                <!-- Skill gap analysis data is tracked but not displayed -->
            </div>
        </div>
    </div>
    
    <div class="feedback-section">
        <div class="feedback-title">How is this CV?</div>
        <div id="feedback-buttons" class="feedback-buttons">
            <button id="thumbs-up" class="feedback-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
                Looks Good
            </button>
            <button id="thumbs-down" class="feedback-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
                </svg>
                Needs Improvement
            </button>
        </div>
        <div id="feedback-form">
            <p>Please tell us how we can improve this CV:</p>
            <textarea id="feedback-text" placeholder="E.g., 'Include more technical skills', 'Focus more on my management experience', etc."></textarea>
            <button id="regenerate-btn">Regenerate with Feedback</button>
        </div>
    </div>
</body>
</html>`;
}

// Generate interview preparation prompts
function generateInterviewPrep() {
    const selectedJob = document.querySelector('.job-item.selected');

    if (!selectedJob) {
        showModal('No Job Selected', 'Please select a job from your saved jobs first.');
        return;
    }

    const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
    const savedJobs = getSavedJobs();
    const job = savedJobs[jobIndex];

    const profileData = getProfileData();
    const cv = profileData.cv || '';

    if (!cv.trim()) {
        showModal('CV Missing', 'Please add your CV in the Profile tab first.', [
            {
                id: 'go-to-profile',
                text: 'Go to Profile',
                action: () => {
                    document.querySelector('[data-tab="profile"]').click();
                }
            }
        ]);
        return;
    }

    // Track interview prep generation
    if (typeof trackEvent === 'function') {
        trackEvent('generate_interview_prep', {
            job_title: job.title || '',
            company: job.company || ''
        });
    }

    // Create prompt for Claude
    const prompt = createInterviewPrepPrompt(job, cv);

    // Function to handle successful clipboard copy
    function handleSuccessfulCopy() {
        // Open Claude in a new tab
        window.open('https://claude.ai', '_blank');

        // Show instructions
        showModal('Interview Prep Prompt Copied',
            'Interview prep prompt copied to clipboard! Paste it into Claude to start your interview preparation session.',
            [
                {
                    id: 'ok-prompt',
                    text: 'OK'
                }
            ]);
    }

    // Try modern clipboard API first
    copyToClipboard(prompt).then(() => {
        handleSuccessfulCopy();
    }).catch(error => {
        console.error('Error copying to clipboard:', error);

        // Alternative method for clipboard
        const textArea = document.createElement('textarea');
        textArea.value = prompt;
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (success) {
                handleSuccessfulCopy();
            } else {
                showModal('Error', 'Could not copy the prompt. Please try again or copy it manually.');
            }
        } catch (err) {
            document.body.removeChild(textArea);
            showModal('Error', 'Could not copy the prompt. Please try again or copy it manually.');
        }
    });
}

// Create interview preparation prompt
function createInterviewPrepPrompt(job, cv) {
    return `I want you to help me prepare for a job interview. Here are the details:
  
JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Description: ${job.description || 'Not provided'}

MY CURRENT CV:
${cv}

Please act as an interactive interview coach and simulate a realistic job interview for this position. 

First, analyze my CV and the job description to identify:
1. Key skills and experience they're looking for
2. Potential skill gaps I might have
3. Likely interview questions for this role
4. Parts of my background I should emphasize

Then, start the interactive interview session where you:
1. Ask me a relevant interview question
2. Wait for my response
3. Provide constructive feedback on my answer
4. Move to the next question

Include a mix of:
- Technical questions related to the job
- Behavioral questions
- Questions about my experience and background
- Questions about the company and industry
- Challenging questions that might trip me up

If I'm using a mobile device, remind me I can record my voice response instead of typing.

At the end, provide overall feedback and tips to improve. Let's start the interview preparation now.`;
}

/**
 * Previews a cover letter from JSON input in the profile tab
 */
function previewCoverLetterFromJson() {
    const jsonInput = document.getElementById('cv-json');

    if (!jsonInput || !jsonInput.value.trim()) {
        showModal('JSON Missing', 'Please paste the JSON output from Claude first.');
        return;
    }

    try {
        // Parse the JSON data
        const data = processCVJson(jsonInput.value);

        if (!data) {
            showModal('Error', 'Error processing JSON data. Please make sure you pasted the correct format from Claude.');
            return;
        }

        // Check if there's a coverLetter field in the JSON
        if (!data.coverLetter && !data.cover_letter) {
            showModal('Missing Cover Letter', 'The JSON does not contain a cover letter. Make sure you used the cover letter generation prompt.');
            return;
        }

        // Use the coverLetter field or cover_letter field
        const coverLetterText = data.coverLetter || data.cover_letter;

        // Get job information if available
        const job = getStorageData('lastGeneratedJob') || {
            title: data.jobTitle || "Position",
            company: data.company || "Company"
        };

        // Track this preview creation
        if (typeof trackEvent === 'function') {
            trackEvent('preview_cover_letter', { method: 'claude_json' });
        }

        // Generate and show the cover letter preview
        const htmlContent = generateCoverLetterHtml(coverLetterText, job);
        createAndOpenPreview(htmlContent, 'Cover Letter');

    } catch (e) {
        showModal('Error', 'Error parsing JSON. Please make sure you pasted the correct format from Claude: ' + e.message);
    }
}

// Create cover letter prompt for Claude
function createClaudeCoverLetterPrompt(job, cv) {
    return `I need you to create a professional cover letter based on my CV and the job details, and return it in a JSON format that my app can parse.

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Description: ${job.description || 'Not provided'}

MY CURRENT CV:
${cv}

Please create a response with TWO parts:

1. First, write the cover letter directly, formatted and ready to use

2. Then, in an artifact, provide the same content in JSON format, like this:
{
  "jobTitle": "${job.title}",
  "company": "${job.company}",
  "fullName": "My name from the CV",
  "coverLetter": "Full text of the cover letter you wrote above"
}

The cover letter should:
1. Be addressed properly to the hiring manager or company
2. Include today's date and my contact information from the CV
3. Highlight my most relevant experiences and skills for this position
4. Demonstrate clear understanding of the company and role
5. Express genuine interest in the position
6. Conclude with a professional closing and call to action
7. Be no longer than one page in length

Write the cover letter in a professional, confident but not arrogant tone. Make it specific to this job and company - avoid generic language that could apply to any position.`;
}

// Add this to the document.addEventListener('DOMContentLoaded') function at the bottom of prompts.js
// Cover Letter generation button for Claude
const coverLetterClaudeButton = document.getElementById('generate-cover-letter-claude');
if (coverLetterClaudeButton) {
    // Remove any existing event listeners
    const newCoverLetterClaudeButton = coverLetterClaudeButton.cloneNode(true);
    if (coverLetterClaudeButton.parentNode) {
        coverLetterClaudeButton.parentNode.replaceChild(newCoverLetterClaudeButton, coverLetterClaudeButton);
    }

    // Add our event listener with tracking
    newCoverLetterClaudeButton.addEventListener('click', function () {
        // Get selected job data for tracking
        const selectedJob = document.querySelector('.job-item.selected');
        let additionalParams = {
            method: 'claude',
            generation_type: 'cover_letter'
        };

        if (selectedJob) {
            const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
            const savedJobs = getSavedJobs();
            if (savedJobs[jobIndex]) {
                additionalParams.job_title = savedJobs[jobIndex].title || 'Unknown';
                additionalParams.company = savedJobs[jobIndex].company || 'Unknown';
            }
        }

        // Track feature usage
        if (typeof trackFeatureUsage === 'function') {
            trackFeatureUsage('cover_letter_generation', additionalParams);
        } else if (typeof trackEvent === 'function') {
            trackEvent('claude_cover_letter_generation_click', additionalParams);
        }

        generateCoverLetterWithClaude();
    });
}

// Add one-click CV generation with Gemini
async function generateCVWithGemini(feedback = "") {
    console.log('generateCVWithGemini function called');

    const featureIdentifier = "gemini_cv_generation";
    if (!canAccessFeature(featureIdentifier)) return;

    const selectedJob = document.querySelector('.job-item.selected');
    if (!selectedJob) {
        showModal('No Job Selected', 'Please select a job from your saved jobs first.');
        return;
    }
    const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
    const savedJobs = getSavedJobs();
    const job = savedJobs[jobIndex];
    const profileData = getProfileData();
    const cv = profileData.cv || '';

    if (!cv.trim()) {
        showModal('CV Missing', 'Please add your CV in the Profile tab first.', [
            { id: 'go-to-profile', text: 'Go to Profile', action: () => document.querySelector('[data-tab="profile"]').click() }
        ]);
        return;
    }
    setStorageData('lastGeneratedJob', job);

    const loadingModal = showModal('Generating CV',
        `<div class="loading-message">
            <p>Please wait while we generate your tailored CV...</p>
            <div class="loading-spinner"></div>
            <div class="loading-steps">
                <div class="loading-step current">Analyzing job description</div>
                <div class="loading-step">Matching with your CV</div>
                <div class="loading-step">Creating tailored document</div>
            </div>
        </div>`, []);

    let currentStep = 0;
    const loadingStepsNodeList = loadingModal ? loadingModal.querySelectorAll('.loading-step') : null;
    const loadingSteps = loadingStepsNodeList ? Array.from(loadingStepsNodeList) : []; // Convert NodeList to Array

    const progressInterval = loadingSteps.length > 0 ? setInterval(() => {
        if (currentStep < loadingSteps.length - 1) {
            loadingSteps[currentStep].classList.remove('current');
            currentStep++;
            loadingSteps[currentStep].classList.add('current');
        }
    }, 3000) : null; // Adjusted interval time for simulation

    try {
        const result = await window.generateCV(job.description, cv, feedback); // Uses cv-api.js

        if (progressInterval) clearInterval(progressInterval);
        if (loadingModal) closeModal(loadingModal);

        if (typeof trackEvent === 'function' && result.cv_data) {
            extractDataFromGeminiResponse(result.cv_data, job, cv);
        }

        if (typeof CareerInsights !== 'undefined' && CareerInsights.saveCVAnalysis && result.cv_data) {
            CareerInsights.saveCVAnalysis(jobIndex, result.cv_data);
        }

        const htmlContent = generateCVHtml(result.cv_data);
        const previewWindow = createAndOpenPreview(htmlContent);

        if (previewWindow) {
            previewWindow.addEventListener('load', () => {
                const thumbsUpBtn = previewWindow.document.getElementById('thumbs-up');
                const thumbsDownBtn = previewWindow.document.getElementById('thumbs-down');
                const feedbackForm = previewWindow.document.getElementById('feedback-form');
                const feedbackButtons = previewWindow.document.getElementById('feedback-buttons');
                const regenerateBtn = previewWindow.document.getElementById('regenerate-btn');
                const feedbackTextarea = previewWindow.document.getElementById('feedback-text');

                if (thumbsUpBtn) {
                    thumbsUpBtn.addEventListener('click', () => {
                        if (typeof trackEvent === 'function') {
                            trackEvent('cv_feedback_positive', { job_title: job.title || '', company: job.company || '' });
                        }
                        if (feedbackButtons) feedbackButtons.innerHTML = '<p class="feedback-thankyou">Thank you for your feedback!</p>';
                    });
                }

                if (thumbsDownBtn) {
                    thumbsDownBtn.addEventListener('click', () => {
                        if (feedbackForm) feedbackForm.style.display = 'block';
                        if (feedbackButtons) feedbackButtons.style.display = 'none';
                    });
                }

                if (regenerateBtn) {
                    regenerateBtn.addEventListener('click', () => {
                        const userFeedback = feedbackTextarea ? feedbackTextarea.value : "";
                        if (typeof trackEvent === 'function') {
                            trackEvent('cv_feedback_negative', { job_title: job.title || '', company: job.company || '', feedback: userFeedback });
                        }
                        previewWindow.close();
                        generateCVWithGemini(userFeedback); // Recursive call for regeneration
                    });
                }
            });
        }
        showModal('CV Generated', `Your CV has been generated! You have ${result.quota.remaining} generations remaining for your current plan.`);

    } catch (error) {
        if (progressInterval) clearInterval(progressInterval);
        if (loadingModal) closeModal(loadingModal);
        console.error("Error in generateCVWithGemini:", error);

        if (error.message && error.message.startsWith("UPGRADE_REQUIRED:")) {
            showModal("Upgrade to Pro", error.message.replace("UPGRADE_REQUIRED:", "").trim() || "This is a Pro feature. Please upgrade.", [
                {
                    id: 'upgrade-error-btn', text: 'Upgrade Plan', class: 'primary-button', action: () => {
                        document.querySelector('.tab-button[data-tab="profile"]').click();
                        setTimeout(() => document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                    }
                },
                { id: 'cancel-error-btn', text: 'Close', class: 'default-button' }
            ]);
        } else if (error.message && error.message.startsWith("AUTH_FAILED:")) {
            showModal('Authentication Failed', error.message.replace("AUTH_FAILED:", "").trim() || 'Please sign in again.', [
                { id: 'sign-in-cv-error', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
            ]);
        } else if (error.message && (error.message.includes("Daily API quota") || error.message.includes("Daily generation limit"))) {
            showModal('Rate Limit Reached', error.message, [{ id: 'ok-rl', text: 'OK' }]);
        } else {
            showModal('Error Generating CV', `Failed: ${error.message}. You could also try the manual Claude generation.`, [
                { id: 'try-claude-cv', text: 'Try Claude Instead', action: generateApplication },
                { id: 'close-cv-error', text: 'Close' }
            ]);
        }
    }
}

// Generate cover letter with Gemini
async function generateCoverLetterWithGemini(feedback = "") {
    console.log('generateCoverLetterWithGemini function called');

    const featureIdentifier = "gemini_cover_letter_generation";
    if (!canAccessFeature(featureIdentifier)) return;

    const selectedJob = document.querySelector('.job-item.selected');
    if (!selectedJob) {
        showModal('No Job Selected', 'Please select a job from your saved jobs first.');
        return;
    }
    const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
    const savedJobs = getSavedJobs();
    const job = savedJobs[jobIndex];
    const profileData = getProfileData();
    const cv = profileData.cv || '';

    if (!cv.trim()) {
        showModal('CV Missing', 'Please add your CV in the Profile tab first.', [
            { id: 'go-to-profile-cl', text: 'Go to Profile', action: () => document.querySelector('[data-tab="profile"]').click() }
        ]);
        return;
    }
    setStorageData('lastGeneratedJob', job);

    const loadingModal = showModal('Generating Cover Letter',
        `<div class="loading-message">
            <p>Please wait while we generate your cover letter...</p>
            <div class="loading-spinner"></div>
            <div class="loading-steps">
                <div class="loading-step current">Analyzing job description</div>
                <div class="loading-step">Matching with your CV</div>
                <div class="loading-step">Creating professional cover letter</div>
            </div>
        </div>`, []);

    let currentStep = 0;
    const loadingStepsNodeList = loadingModal ? loadingModal.querySelectorAll('.loading-step') : null;
    const loadingSteps = loadingStepsNodeList ? Array.from(loadingStepsNodeList) : [];

    const progressInterval = loadingSteps.length > 0 ? setInterval(() => {
        if (currentStep < loadingSteps.length - 1) {
            loadingSteps[currentStep].classList.remove('current');
            currentStep++;
            loadingSteps[currentStep].classList.add('current');
        }
    }, 2000) : null;

    try {
        const result = await window.generateCoverLetter(job.description, cv, feedback); // Uses cv-api.js

        if (progressInterval) clearInterval(progressInterval);
        if (loadingModal) closeModal(loadingModal);

        if (typeof trackEvent === 'function') {
            trackEvent('cover_letter_generated', {
                method: 'gemini', // Added for consistency
                job_title: job.title || '',
                company: job.company || '',
                has_feedback: feedback ? 'yes' : 'no'
            });
        }

        previewCoverLetter(result.cover_letter, job); // This function was already in your provided prompts.js
        showModal('Cover Letter Generated', `Your cover letter has been generated! You have ${result.quota.remaining} generations remaining for your current plan.`);

    } catch (error) {
        if (progressInterval) clearInterval(progressInterval);
        if (loadingModal) closeModal(loadingModal);
        console.error("Error in generateCoverLetterWithGemini:", error);

        if (error.message && error.message.startsWith("UPGRADE_REQUIRED:")) {
            showModal("Upgrade to Pro", error.message.replace("UPGRADE_REQUIRED:", "").trim() || "This is a Pro feature. Please upgrade.", [
                {
                    id: 'upgrade-cl-error-btn', text: 'Upgrade Plan', class: 'primary-button', action: () => {
                        document.querySelector('.tab-button[data-tab="profile"]').click();
                        setTimeout(() => document.querySelector('.subscription-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                    }
                },
                { id: 'cancel-cl-error-btn', text: 'Close', class: 'default-button' }
            ]);
        } else if (error.message && error.message.startsWith("AUTH_FAILED:")) {
            showModal('Authentication Failed', error.message.replace("AUTH_FAILED:", "").trim() || 'Please sign in again.', [
                { id: 'sign-in-cl-error', text: 'Sign In', class: 'primary-button', action: () => window.signInWithGoogle() }
            ]);
        } else if (error.message && (error.message.includes("Daily API quota") || error.message.includes("Daily generation limit"))) {
            showModal('Rate Limit Reached', error.message, [{ id: 'ok-cl-rl', text: 'OK' }]);
        } else {
            showModal('Error Generating Cover Letter', `Failed: ${error.message}. You could also try the manual Claude generation.`, [
                { id: 'try-claude-cl', text: 'Try Claude Instead', action: generateCoverLetterWithClaude },
                { id: 'close-cl-error', text: 'Close' }
            ]);
        }
    }
}

// Preview generated cover letter
function previewCoverLetter(coverLetterText, job) {
    // Create the HTML content for preview
    const htmlContent = generateCoverLetterHtml(coverLetterText, job);

    // Use the helper function to create and open the preview
    const previewWindow = createAndOpenPreview(htmlContent);

    // Attach feedback functionality to the preview window
    if (previewWindow) {
        previewWindow.addEventListener('load', () => {
            const thumbsUpBtn = previewWindow.document.getElementById('thumbs-up');
            const thumbsDownBtn = previewWindow.document.getElementById('thumbs-down');

            if (thumbsUpBtn) {
                thumbsUpBtn.addEventListener('click', () => {
                    // Track positive feedback
                    if (typeof trackEvent === 'function') {
                        trackEvent('cover_letter_feedback_positive', {
                            job_title: job.title || '',
                            company: job.company || ''
                        });
                    }

                    // Show thank you message in the preview window
                    previewWindow.document.getElementById('feedback-buttons').innerHTML =
                        '<p class="feedback-thankyou">Thank you for your feedback!</p>';
                });
            }

            if (thumbsDownBtn) {
                thumbsDownBtn.addEventListener('click', () => {
                    // Show feedback form in the preview
                    previewWindow.document.getElementById('feedback-form').style.display = 'block';
                    previewWindow.document.getElementById('feedback-buttons').style.display = 'none';

                    // Set up the regenerate button
                    const regenerateBtn = previewWindow.document.getElementById('regenerate-btn');
                    if (regenerateBtn) {
                        regenerateBtn.addEventListener('click', () => {
                            const feedbackText = previewWindow.document.getElementById('feedback-text').value;

                            // Track negative feedback
                            if (typeof trackEvent === 'function') {
                                trackEvent('cover_letter_feedback_negative', {
                                    job_title: job.title || '',
                                    company: job.company || '',
                                    feedback: feedbackText
                                });
                            }

                            // Close the preview window
                            previewWindow.close();

                            // Regenerate with feedback
                            generateCoverLetterWithGemini(feedbackText);
                        });
                    }
                });
            }
        });
    }
}

// Generate HTML for cover letter preview
function generateCoverLetterHtml(coverLetterText, job) {
    // Format the cover letter text - maintaining its structure while ensuring it's HTML-safe
    const formattedCoverLetter = coverLetterText
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cover Letter Preview</title>
    <style>
        :root {
            --primary-color: #3498db;
            --secondary-color: #2c3e50;
            --text-color: #333;
            --light-text: #666;
            --accent-color: #1abc9c;
            --background-color: #f5f5f5;
            --card-background: white;
            --heading-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            --body-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: var(--body-font);
        }
        
        body {
            background-color: var(--background-color);
            color: var(--text-color);
            line-height: 1.6;
            font-size: 14px;
            padding: 25px;
        }
        
        .cover-letter-container {
            max-width: 800px;
            margin: 0 auto;
            background-color: var(--card-background);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
            padding: 40px;
        }
        
        /* Controls */
        .controls {
            max-width: 800px;
            margin: 20px auto;
            text-align: center;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .print-controls {
            display: flex;
            gap: 10px;
        }
        
        .print-controls button {
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 4px;
        }
        
        .cover-letter-content {
            line-height: 1.5;
        }
        
        /* Feedback section */
        .feedback-section {
            max-width: 800px;
            margin: 20px auto;
            background-color: var(--card-background);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
            padding: 20px;
            text-align: center;
        }
        
        .feedback-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--secondary-color);
        }
        
        .feedback-buttons {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 10px;
        }
        
        .feedback-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            background: none;
            border: 1px solid #ddd;
            padding: 8px 15px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .feedback-btn:hover {
            background-color: #f5f5f5;
        }
        
        .feedback-btn svg {
            width: 20px;
            height: 20px;
        }
        
        #thumbs-up {
            color: #2ecc71;
        }
        
        #thumbs-up:hover {
            background-color: rgba(46, 204, 113, 0.1);
            border-color: #2ecc71;
        }
        
        #thumbs-down {
            color: #e74c3c;
        }
        
        #thumbs-down:hover {
            background-color: rgba(231, 76, 60, 0.1);
            border-color: #e74c3c;
        }
        
        .feedback-thankyou {
            color: #2ecc71;
            font-weight: bold;
        }
        
        /* Feedback form */
        #feedback-form {
            display: none;
            margin-top: 15px;
            text-align: left;
        }
        
        #feedback-form textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            min-height: 100px;
            margin-bottom: 10px;
            font-family: inherit;
            font-size: 14px;
        }
        
        #regenerate-btn {
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 4px;
            margin-top: 10px;
        }
        
        /* Print styles */
        @media print {
            body {
                padding: 0;
                background-color: white;
                font-size: 12px;
            }
            
            .cover-letter-container {
                box-shadow: none;
                padding: 0;
                max-width: 100%;
            }
            
            .controls, .feedback-section {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="controls">
        <h2>Cover Letter for ${job.title || 'Position'} at ${job.company || 'Company'}</h2>
        <div class="print-controls">
            <button onclick="window.print()">Print</button>
            <button onclick="window.close()">Close</button>
        </div>
    </div>

    <div class="cover-letter-container">
        <div class="cover-letter-content">
            ${formattedCoverLetter}
        </div>
    </div>
    
    <div class="feedback-section">
        <div class="feedback-title">How is this cover letter?</div>
        <div id="feedback-buttons" class="feedback-buttons">
            <button id="thumbs-up" class="feedback-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
                Looks Good
            </button>
            <button id="thumbs-down" class="feedback-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
                </svg>
                Needs Improvement
            </button>
        </div>
        <div id="feedback-form">
            <p>Please tell us how we can improve this cover letter:</p>
            <textarea id="feedback-text" placeholder="E.g., 'Make it more specific to the job role', 'Highlight more technical skills', etc."></textarea>
            <button id="regenerate-btn">Regenerate with Feedback</button>
        </div>
    </div>
</body>
</html>`;
}

// Helper function to track data from Gemini response
function extractDataFromGeminiResponse(cvData, job, cv) {
    try {
        // Extract skills from Gemini's response
        const cvSkills = [];
        if (cvData.skills && Array.isArray(cvData.skills)) {
            // Extract all skills that Gemini identified
            cvData.skills.forEach(skillSet => {
                const skills = skillSet.split(':');
                if (skills.length > 1) {
                    // Get the skills after the category
                    const skillList = skills[1].split(',').map(s => s.trim());
                    cvSkills.push(...skillList);
                } else {
                    cvSkills.push(skillSet);
                }
            });
        }

        // Track the enriched data
        trackEvent('gemini_cv_job_match', {
            job_title: job.title || '',
            company: job.company || '',
            job_location: job.location || '',
            cv_skills: Array.isArray(cvSkills) ? cvSkills.join(', ') : '',
            matched_job_title: cvData.jobTitle || '',
            tailored_summary: cvData.summary || '',
            education: Array.isArray(cvData.education) ?
                cvData.education.map(e => `${e.degree}: ${e.institution}`).join('; ') : '',
            highlighted_experience: Array.isArray(cvData.experience) ?
                cvData.experience.map(e => e.jobTitle).join('; ') : '',
            overall_match: cvData.skillGapAnalysis?.overallMatch || ''
        });

    } catch (error) {
        console.error('Error tracking Gemini CV data:', error);
    }
}

// Learning Plan Generation functionality

// Generate a learning plan prompt for Perplexity
function generateLearningPlanPrompt() {
    // Prevent multiple windows
    if (perplexityWindowOpen) {
        showModal('Window Already Open', 'A Perplexity window is already open. Please complete that process first.');
        return;
    }

    const selectedJob = document.querySelector('.job-item.selected');

    if (!selectedJob) {
        showModal('No Job Selected', 'Please select a job from your saved jobs first to identify skill gaps.');
        return;
    }

    const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
    const savedJobs = getSavedJobs();
    const job = savedJobs[jobIndex];

    // Check if job has CV analysis with skill gaps
    if (!job.cvAnalysis || !job.cvAnalysis.skillGapAnalysis || !job.cvAnalysis.skillGapAnalysis.missingSkills) {
        showModal('No Skill Gaps Identified', 'Please generate a CV for this job first to identify skill gaps.');
        return;
    }

    const missingSkills = job.cvAnalysis.skillGapAnalysis.missingSkills;

    if (missingSkills.length === 0) {
        showModal('No Skill Gaps Found', 'No skill gaps were identified for this job. Your skills match well with the requirements!');
        return;
    }

    // Create a well-structured prompt for Perplexity
    let prompt = `Create a detailed, structured learning plan for these skills that I need to develop for a ${job.title} role: ${missingSkills.join(', ')}. 

Please structure your response as a JSON object with exactly this structure:

\`\`\`json
{
  "plan_title": "Career Learning Plan for [Skills]",
  "skills": [
    {
      "name": "Skill Name", 
      "description": "Brief description of why this skill matters for this role",
      "progress": 0,
      "modules": [
        {
          "title": "Module Name", 
          "description": "What this module covers",
          "resources": [
            {
              "title": "Resource Title",
              "type": "documentation/video/course/article",
              "url": "URL to resource",
              "completed": false
            }
          ],
          "projects": [
            {
              "title": "Project Title",
              "description": "Brief description of what to build or do",
              "completed": false
            }
          ]
        }
      ]
    }
  ],
  "timeline": {
    "weeks": [
      {
        "week": 1,
        "focus": "What to focus on this week",
        "activities": ["Specific activity 1", "Specific activity 2"],
        "completed": false
      }
    ]
  }
}
\`\`\`

For each skill:
1. Include 2-3 learning modules that build on each other
2. For each module, include 2-4 specific learning resources with direct links
3. Include at least one practical hands-on project per module
4. Ensure resources are a mix of documentation, videos, articles, and interactive courses
5. Focus on foundational mental models and practical applications
6. Include only high-quality, current resources from reputable sources
7. Break learning into 4-6 week timeline with specific weekly activities
8. Emphasize both theoretical knowledge and practical application

Only respond with the JSON structure - no additional text before or after. Make sure the JSON is valid and properly formatted.`;

    // Track this action
    if (typeof trackEvent === 'function') {
        trackEvent('generate_learning_plan_prompt', {
            job_title: job.title || '',
            company: job.company || '',
            missing_skills: missingSkills.join(', '),
            skill_count: missingSkills.length
        });
    }

    // Encode the prompt for URL
    const encodedPrompt = encodeURIComponent(prompt);

    // Set flag and open window
    perplexityWindowOpen = true;
    window.open(`https://www.perplexity.ai/?q=${encodedPrompt}`, '_blank');

    // Reset flag after delay
    setTimeout(() => {
        perplexityWindowOpen = false;
    }, 5000);

    // Show instructions
    showModal('Learning Plan Generation',
        'Perplexity will open with your prompt. Once you receive the JSON response, copy it and paste it in the Learning Dashboard tab.',
        [
            {
                id: 'go-to-learning',
                text: 'Go to Learning Dashboard',
                action: () => {
                    document.querySelector('[data-tab="learning"]').click();
                }
            },
            {
                id: 'ok-prompt',
                text: 'OK'
            }
        ]
    );
}

// Generate a cumulative learning plan across multiple jobs
function generateCumulativeLearningPlan() {
    // Prevent multiple windows
    if (perplexityWindowOpen) {
        showModal('Window Already Open', 'A Perplexity window is already open. Please complete that process first.');
        return;
    }

    const savedJobs = getSavedJobs();
    const jobsWithAnalysis = savedJobs.filter(job => job.cvAnalysis);

    if (jobsWithAnalysis.length === 0) {
        showModal('No Job Analysis', 'Please generate CVs for jobs first to identify skill gaps.');
        return;
    }

    // Collect all skill gaps across jobs
    const allMissingSkills = {};

    jobsWithAnalysis.forEach(job => {
        const missingSkills = job.cvAnalysis.skillGapAnalysis?.missingSkills || [];
        missingSkills.forEach(skill => {
            allMissingSkills[skill] = (allMissingSkills[skill] || 0) + 1;
        });
    });

    // Convert to array and sort by frequency
    const sortedSkills = Object.entries(allMissingSkills)
        .sort((a, b) => b[1] - a[1])
        .map(item => item[0]);

    if (sortedSkills.length === 0) {
        showModal('No Skill Gaps', 'No skill gaps identified across your jobs. Your skills match well!');
        return;
    }

    // Get top skills (limit to 5)
    const topSkills = sortedSkills.slice(0, 5);

    // Create prompt for Perplexity with structured JSON format
    let prompt = `Create a comprehensive career development plan focusing on these key skills that appear most frequently in my job search: ${topSkills.join(', ')}. 

Please structure your response as a JSON object with exactly this structure:

\`\`\`json
{
  "plan_title": "Career Development Plan for ${topSkills.length} Key Skills",
  "skills": [
    {
      "name": "Skill Name", 
      "description": "Brief description of this skill's importance in the job market",
      "progress": 0,
      "modules": [
        {
          "title": "Module Name", 
          "description": "What this module covers",
          "resources": [
            {
              "title": "Resource Title",
              "type": "documentation/video/course/article",
              "url": "URL to resource",
              "completed": false
            }
          ],
          "projects": [
            {
              "title": "Project Title",
              "description": "Brief description of what to build or do",
              "completed": false
            }
          ]
        }
      ]
    }
  ],
  "timeline": {
    "weeks": [
      {
        "week": 1,
        "focus": "What to focus on this week",
        "activities": ["Specific activity 1", "Specific activity 2"],
        "completed": false
      }
    ]
  }
}
\`\`\`

For each skill:
1. Explain why this skill is increasingly valuable in today's job market
2. Include 2-3 learning modules that build progressively
3. For each module, include 2-4 high-quality learning resources with direct links
4. Include at least one practical project per module that would demonstrate this skill to employers
5. Focus on both theoretical understanding and practical application
6. Target the plan for someone advancing their career, not a complete beginner
7. Create an 8-12 week learning schedule that balances all skills
8. Emphasize projects that could be added to a portfolio

Only respond with the JSON structure - no additional text before or after. Make sure the JSON is valid and properly formatted.`;

    // Track this action
    if (typeof trackEvent === 'function') {
        trackEvent('generate_cumulative_learning_plan', {
            top_skills: topSkills.join(', '),
            skill_count: topSkills.length,
            job_count: jobsWithAnalysis.length
        });
    }

    // Encode the prompt for URL
    const encodedPrompt = encodeURIComponent(prompt);

    // Set flag and open window
    perplexityWindowOpen = true;
    window.open(`https://www.perplexity.ai/?q=${encodedPrompt}`, '_blank');

    // Reset flag after delay
    setTimeout(() => {
        perplexityWindowOpen = false;
    }, 5000);

    // Show instructions
    showModal('Career Development Plan',
        'Perplexity will open with your prompt. Once you receive the JSON response, copy it and paste it in the Learning Dashboard tab.',
        [
            {
                id: 'go-to-learning',
                text: 'Go to Learning Dashboard',
                action: () => {
                    document.querySelector('[data-tab="learning"]').click();
                }
            },
            {
                id: 'ok-prompt',
                text: 'OK'
            }
        ]
    );
}

document.addEventListener('DOMContentLoaded', function () {
    // CV generation button (Gemini)
    const cvButtonGemini = document.getElementById('generate-cv-gemini'); //
    if (cvButtonGemini) { //
        const newCvButton = cvButtonGemini.cloneNode(true); //
        cvButtonGemini.parentNode.replaceChild(newCvButton, cvButtonGemini); //
        newCvButton.setAttribute('data-pro-feature', 'gemini_cv_generation'); // Changed to data-pro-feature
        newCvButton.setAttribute('data-feature-display-name', 'Gemini CV Generation'); //

        newCvButton.addEventListener('click', function () { //
            if (typeof trackFeatureUsage === 'function') { //
                trackFeatureUsage('cv_generation', { method: 'gemini', generation_type: 'cv', page: 'apply_tab' }); //
            }
            generateCVWithGemini();
        });
    }

    // Cover Letter generation button (Gemini)
    const coverLetterButtonGemini = document.getElementById('generate-cover-letter-gemini'); //
    if (coverLetterButtonGemini) { //
        const newCoverLetterButton = coverLetterButtonGemini.cloneNode(true); //
        coverLetterButtonGemini.parentNode.replaceChild(newCoverLetterButton, coverLetterButtonGemini); //
        newCoverLetterButton.setAttribute('data-pro-feature', 'gemini_cover_letter_generation'); // Changed to data-pro-feature
        newCoverLetterButton.setAttribute('data-feature-display-name', 'Gemini Cover Letter Generation'); //

        newCoverLetterButton.addEventListener('click', function () { //
            if (typeof trackFeatureUsage === 'function') { //
                trackFeatureUsage('cover_letter_generation', { method: 'gemini', generation_type: 'cover_letter', page: 'apply_tab' }); //
            }
            generateCoverLetterWithGemini();
        });
    }

    // Set up Generate Application button (Claude)
    const generateApplicationButton = document.getElementById('generate-application');
    if (generateApplicationButton) {
        // Remove any existing event listeners
        const newGenerateAppButton = generateApplicationButton.cloneNode(true);
        generateApplicationButton.parentNode.replaceChild(newGenerateAppButton, generateApplicationButton);

        // Add our event listener with tracking
        newGenerateAppButton.addEventListener('click', function () {
            // Get selected job data for tracking
            const selectedJob = document.querySelector('.job-item.selected');
            let additionalParams = {
                method: 'claude',
                generation_type: 'cv'
            };

            if (selectedJob) {
                const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
                const savedJobs = getSavedJobs();
                if (savedJobs[jobIndex]) {
                    additionalParams.job_title = savedJobs[jobIndex].title || 'Unknown';
                    additionalParams.company = savedJobs[jobIndex].company || 'Unknown';
                }
            }

            // Track feature usage
            if (typeof trackFeatureUsage === 'function') {
                trackFeatureUsage('cv_generation', additionalParams);
            } else if (typeof trackEvent === 'function') {
                trackEvent('claude_generation_click', additionalParams);
            }

            generateApplication();
        });
    }

    // Set up Interview Prep button
    const interviewPrepButton = document.getElementById('interview-prep');
    if (interviewPrepButton) {
        // Remove any existing event listeners
        const newInterviewPrepButton = interviewPrepButton.cloneNode(true);
        interviewPrepButton.parentNode.replaceChild(newInterviewPrepButton, interviewPrepButton);
        newInterviewPrepButton.setAttribute('data-pro-feature', 'interview_prep');  // "Pro"
        newInterviewPrepButton.setAttribute('data-feature-display-name', 'Interview Prep'); //

        // Add our event listener with tracking
        newInterviewPrepButton.addEventListener('click', function () {
            // Uncomment and adapt if 'interview_prep' becomes a backend-gated Pro feature
            // if (!canAccessFeature('interview_prep')) return;

            // Get selected job data for tracking
            const selectedJob = document.querySelector('.job-item.selected');
            let additionalParams = {
                method: 'claude',
                preparation_type: 'interview'
            };

            if (selectedJob) {
                const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
                const savedJobs = getSavedJobs();
                if (savedJobs[jobIndex]) {
                    additionalParams.job_title = savedJobs[jobIndex].title || 'Unknown';
                    additionalParams.company = savedJobs[jobIndex].company || 'Unknown';
                }
            }

            // Track feature usage
            if (typeof trackFeatureUsage === 'function') {
                trackFeatureUsage('interview_prep', additionalParams);
            } else if (typeof trackEvent === 'function') {
                trackEvent('interview_prep_click', additionalParams);
            }

            generateInterviewPrep();
        });
    }

    // Set up Preview CV button
    const previewCvButton = document.getElementById('preview-cv');
    if (previewCvButton) {
        // Remove any existing event listeners
        const newPreviewCvButton = previewCvButton.cloneNode(true);
        previewCvButton.parentNode.replaceChild(newPreviewCvButton, previewCvButton);

        // Add our event listener with tracking
        newPreviewCvButton.addEventListener('click', function () {
            // Track event before previewing
            if (typeof trackEvent === 'function') {
                trackEvent('preview_cv_click', {
                    method: 'manual_json',
                    page: 'profile_tab'
                });
            }

            previewCV();
        });
    }

    // Set up Preview Cover Letter button
    const previewCoverLetterButton = document.getElementById('preview-cover-letter');
    if (previewCoverLetterButton) {
        // Remove any existing event listeners
        const newPreviewCoverLetterButton = previewCoverLetterButton.cloneNode(true);
        previewCoverLetterButton.parentNode.replaceChild(newPreviewCoverLetterButton, previewCoverLetterButton);

        // Add our event listener with tracking
        newPreviewCoverLetterButton.addEventListener('click', function () {
            // Track event before previewing
            if (typeof trackEvent === 'function') {
                trackEvent('preview_cover_letter_click', {
                    method: 'manual_json',
                    page: 'profile_tab'
                });
            }

            previewCoverLetterFromJson();
        });
    }

    // Learning plan buttons
    const insightsLearningPlanBtn = document.getElementById('create-learning-plan');
    if (insightsLearningPlanBtn) {
        // Remove any existing event listeners
        const newLearningPlanBtn = insightsLearningPlanBtn.cloneNode(true);
        insightsLearningPlanBtn.parentNode.replaceChild(newLearningPlanBtn, insightsLearningPlanBtn);
        newLearningPlanBtn.setAttribute('data-pro-feature', 'learning_plan_single_job');  // "Pro"
        newLearningPlanBtn.setAttribute('data-feature-display-name', 'Learning Plan Generation'); //

        // Add our event listener with tracking
        newLearningPlanBtn.addEventListener('click', function () {
            // if (!canAccessFeature('learning_plan_single_job')) return;

            // Get selected job data for tracking
            const selectedJob = document.querySelector('.job-item.selected');
            let additionalParams = {
                plan_type: 'single_job',
                tool: 'perplexity'
            };

            if (selectedJob) {
                const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
                const savedJobs = getSavedJobs();
                if (savedJobs[jobIndex]) {
                    additionalParams.job_title = savedJobs[jobIndex].title || 'Unknown';
                    additionalParams.company = savedJobs[jobIndex].company || 'Unknown';

                    // Add skill gap info if available
                    if (savedJobs[jobIndex].cvAnalysis &&
                        savedJobs[jobIndex].cvAnalysis.skillGapAnalysis &&
                        savedJobs[jobIndex].cvAnalysis.skillGapAnalysis.missingSkills) {
                        additionalParams.missing_skills = savedJobs[jobIndex].cvAnalysis.skillGapAnalysis.missingSkills.join(', ');
                        additionalParams.skill_count = savedJobs[jobIndex].cvAnalysis.skillGapAnalysis.missingSkills.length;
                    }
                }
            }

            // Track feature usage
            if (typeof trackFeatureUsage === 'function') {
                trackFeatureUsage('learning_plan_generation', additionalParams);
            } else if (typeof trackEvent === 'function') {
                trackEvent('learning_plan_generation_click', additionalParams);
            }

            generateLearningPlanPrompt();
        });
    }

    const cumulativeLearningPlanBtn = document.getElementById('create-cumulative-learning-plan');
    if (cumulativeLearningPlanBtn) {
        // Remove any existing event listeners
        const newCumulativePlanBtn = cumulativeLearningPlanBtn.cloneNode(true);
        cumulativeLearningPlanBtn.parentNode.replaceChild(newCumulativePlanBtn, cumulativeLearningPlanBtn);
        newCumulativePlanBtn.setAttribute('data-pro-feature', 'learning_plan_cumulative');  // "Pro"
        newCumulativePlanBtn.setAttribute('data-feature-display-name', 'Career Learning Plan Generation'); //

        // Add our event listener with tracking
        newCumulativePlanBtn.addEventListener('click', function () {
            // if (!canAccessFeature('learning_plan_cumulative')) return;

            // Get jobs with analysis data for tracking
            const savedJobs = getSavedJobs();
            const jobsWithAnalysis = savedJobs.filter(job => job.cvAnalysis);

            let additionalParams = {
                plan_type: 'cumulative',
                tool: 'perplexity',
                job_count: jobsWithAnalysis.length
            };

            // Collect all skill gaps for tracking
            const allMissingSkills = {};
            jobsWithAnalysis.forEach(job => {
                const missingSkills = job.cvAnalysis.skillGapAnalysis?.missingSkills || [];
                missingSkills.forEach(skill => {
                    allMissingSkills[skill] = (allMissingSkills[skill] || 0) + 1;
                });
            });

            // Get top skills
            const sortedSkills = Object.entries(allMissingSkills)
                .sort((a, b) => b[1] - a[1])
                .map(item => item[0]);

            const topSkills = sortedSkills.slice(0, 5);

            if (topSkills.length > 0) {
                additionalParams.top_skills = topSkills.join(', ');
                additionalParams.skill_count = topSkills.length;
            }

            // Track feature usage
            if (typeof trackFeatureUsage === 'function') {
                trackFeatureUsage('learning_plan_generation', additionalParams);
            } else if (typeof trackEvent === 'function') {
                trackEvent('cumulative_learning_plan_click', additionalParams);
            }

            generateCumulativeLearningPlan();
        });
    }
});