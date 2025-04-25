// AI Prompt Generation for the Job Hunter Web App

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
    
    // Copy prompt to clipboard
    copyToClipboard(prompt).then(() => {
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
    }).catch(error => {
        console.error('Error copying to clipboard:', error);
        
        // Alternative method for clipboard
        const textArea = document.createElement('textarea');
        textArea.value = prompt;
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            
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
            showModal('Prompt Copied', 'Prompt copied to clipboard! Paste it into Claude, then copy the JSON response back to the extension.');
        } catch (err) {
            showModal('Error', 'Could not copy the prompt. Please try again or copy it manually.');
        }
        
        document.body.removeChild(textArea);
    });
}

// Helper function to copy to clipboard using Clipboard API
function copyToClipboard(text) {
    return navigator.clipboard.writeText(text);
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
    
    First, please write me a great cover letter for this job that highlights my relevant experience and why I'm a good fit. Make it professional but engaging. Format the cover letter so it's ready to copy and paste directly into Google Docs or another word processor, with proper paragraphing, spacing, and a professional layout. Include my contact information at the top, the date, recipient details (if available from the job), and proper salutation and closing.
    
    Then, please provide my CV information in this exact JSON format that I'll copy back to my extension. It's critical that the JSON is well-formed and follows this exact structure:
    
    \`\`\`json
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
    \`\`\`
    
    Make sure the JSON follows this exact structure as my extension will parse it automatically. Prioritize skills and experience that are most relevant to the job description. For each experience and education item, add a relevanceScore from 0-100 indicating how relevant it is to this specific job. Also include the skillGapAnalysis section to help me understand my fit for the role.`;
}

// Preview CV after getting response from Claude
function previewCV() {
    const jsonInput = document.getElementById('cv-json');
    
    if (!jsonInput || !jsonInput.value.trim()) {
        showModal('JSON Missing', 'Please paste the JSON output from Claude first.');
        return;
    }
    
    try {
        // Parse the JSON data
        const data = JSON.parse(jsonInput.value);
        
        // Extract data for ML models from Claude's response
        if (typeof trackEvent === 'function') {
            extractDataFromClaudeResponse(jsonInput.value);
        }
        
        // Create HTML content
        const htmlContent = generateCVHtml(data);
        
        // Create a Blob and open it in a new tab
        const blob = new Blob([htmlContent], {type: 'text/html'});
        const blobUrl = URL.createObjectURL(blob);
        
        window.open(blobUrl, '_blank');
        
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
            
            .print-controls {
                display: none;
            }
            
            h1 {
                font-size: 22px;
            }
            
            h2 {
                font-size: 16px;
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
                <div class="skills-list">
                    ${data.skills ? data.skills.map(skill => `
                        <p>${skill}</p>
                    `).join('') : ''}
                </div>
        
                ${data.certifications && data.certifications.length > 0 ? `
                    <h3 class="section-title">Certifications</h3>
                    <div class="skills-list">
                        ${data.certifications.map(cert => `<p>${cert}</p>`).join('')}
                    </div>
                ` : ''}
                
                ${data.skillGapAnalysis ? `
                    <h3 class="section-title">Skill Match Analysis</h3>
                    <div class="skills-list">
                        <p><strong>Overall Match:</strong> ${data.skillGapAnalysis.overallMatch || ''}%</p>
                        <p><strong>Matching Skills:</strong> ${data.skillGapAnalysis.matchingSkills ? data.skillGapAnalysis.matchingSkills.join(', ') : ''}</p>
                        <p><strong>Skills to Develop:</strong> ${data.skillGapAnalysis.missingSkills ? data.skillGapAnalysis.missingSkills.join(', ') : ''}</p>
                    </div>
                ` : ''}
            </div>
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
    
    // Copy prompt to clipboard
    copyToClipboard(prompt).then(() => {
        // Open Claude in a new tab
        window.open('https://claude.ai', '_blank');
        
        // Show instructions
        showModal('Interview Prep Prompt Copied', 'Interview prep prompt copied to clipboard! Paste it into Claude to start your interview preparation session.', [
            {
                id: 'ok-prompt',
                text: 'OK'
            }
        ]);
    }).catch(error => {
        console.error('Error copying to clipboard:', error);
        
        // Alternative method for clipboard
        const textArea = document.createElement('textarea');
        textArea.value = prompt;
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            
            // Open Claude in a new tab
            window.open('https://claude.ai', '_blank');
            
            // Show instructions
            showModal('Interview Prep Prompt Copied', 'Interview prep prompt copied to clipboard! Paste it into Claude to start your interview preparation session.');
        } catch (err) {
            showModal('Error', 'Could not copy the prompt. Please try again or copy it manually.');
        }
        
        document.body.removeChild(textArea);
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

// Initialize prompts functionality
document.addEventListener('DOMContentLoaded', function() {
    // Set up Generate Application button
    const generateApplicationButton = document.getElementById('generate-application');
    if (generateApplicationButton) {
        generateApplicationButton.addEventListener('click', generateApplication);
    }
    
    // Set up Interview Prep button
    const interviewPrepButton = document.getElementById('interview-prep');
    if (interviewPrepButton) {
        interviewPrepButton.addEventListener('click', generateInterviewPrep);
    }
    
    // Set up Preview CV button
    const previewCvButton = document.getElementById('preview-cv');
    if (previewCvButton) {
        previewCvButton.addEventListener('click', previewCV);
    }
});