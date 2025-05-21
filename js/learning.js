// Learning Dashboard Module for JobHunter Web App

// Initialize the Learning Dashboard module
const LearningDashboard = (function() {
    // Storage key for learning plan data
    const STORAGE_KEY = 'learningPlanData';
    
    // State variables
    let currentPlan = null;
    let currentView = 'skills';
    
    // Initialize the dashboard
    function init() {
        // Load plans from storage
        loadSavedPlan();
        
        // Set up event listeners
        setupEventListeners();
        
        // Track initialization
        if (typeof trackEvent === 'function') {
            trackEvent('learning_dashboard_view');
        }
    }
    
    // Set up all event listeners
    function setupEventListeners() {
        // Load plan button
        const loadPlanBtn = document.getElementById('load-learning-plan');
        if (loadPlanBtn) {
            loadPlanBtn.addEventListener('click', function() {
                loadPlanFromJson();
            });
        }
        
        // Go to insights button
        const goToInsightsBtn = document.getElementById('go-to-insights');
        if (goToInsightsBtn) {
            goToInsightsBtn.addEventListener('click', function() {
                // Switch to insights tab
                document.querySelector('[data-tab="insights"]').click();
                
                // Track navigation
                if (typeof trackEvent === 'function') {
                    trackEvent('learning_to_insights_navigation');
                }
            });
        }
        
        // View example plan button
        const viewExampleBtn = document.getElementById('view-example-plan');
        if (viewExampleBtn) {
            viewExampleBtn.addEventListener('click', function() {
                showExamplePlan();
            });
        }
        
        // Edit plan button
        const editPlanBtn = document.getElementById('edit-learning-plan');
        if (editPlanBtn) {
            editPlanBtn.addEventListener('click', function() {
                editCurrentPlan();
            });
        }
        
        // Reset progress button
        const resetProgressBtn = document.getElementById('reset-learning-plan');
        if (resetProgressBtn) {
            resetProgressBtn.addEventListener('click', function() {
                resetPlanProgress();
            });
        }
        
        // Section navigation buttons
        const navButtons = document.querySelectorAll('.learning-nav-item');
        navButtons.forEach(button => {
            button.addEventListener('click', function() {
                const section = this.getAttribute('data-section');
                switchSection(section);
            });
        });
        
        // Tab selection event
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.addEventListener('click', function() {
                if (this.getAttribute('data-tab') === 'learning') {
                    refreshDashboard();
                }
            });
        });
    }
    
    // Load saved learning plan from storage
    function loadSavedPlan() {
        const savedPlan = getStorageData(STORAGE_KEY);
        
        if (savedPlan) {
            currentPlan = savedPlan;
            renderDashboard();
        } else {
            showEmptyState();
        }
    }
    
    // Load plan from JSON textarea
    function loadPlanFromJson() {
        const jsonTextarea = document.getElementById('learning-plan-json');
        
        if (!jsonTextarea || !jsonTextarea.value.trim()) {
            showModal('No JSON Data', 'Please paste the learning plan JSON first.');
            return;
        }
        
        try {
            // Parse the JSON data
            const planData = JSON.parse(jsonTextarea.value);
            
            // Validate essential structure
            if (!planData.skills || !Array.isArray(planData.skills)) {
                throw new Error('Invalid plan format: missing skills array');
            }
            
            // Add created date if not present
            if (!planData.created_date) {
                planData.created_date = new Date().toISOString();
            }
            
            // Save plan
            currentPlan = planData;
            setStorageData(STORAGE_KEY, currentPlan);
            
            // Clear the textarea
            jsonTextarea.value = '';
            
            // Render the dashboard
            renderDashboard();
            
            // Track plan loaded
            if (typeof trackEvent === 'function') {
                trackEvent('learning_plan_loaded', {
                    skill_count: planData.skills.length,
                    plan_title: planData.plan_title || 'Untitled Plan'
                });
            }
            
        } catch (error) {
            showModal('Error', `Failed to parse learning plan JSON: ${error.message}`);
        }
    }
    
    // Show example plan 
    function showExamplePlan() {
        const jsonTextarea = document.getElementById('learning-plan-json');
        
        if (jsonTextarea) {
            // Create example plan JSON
            const examplePlan = {
                "plan_title": "Career Learning Plan for Web Development Skills",
                "created_date": new Date().toISOString(),
                "skills": [
                    {
                        "name": "React Advanced Concepts", 
                        "description": "Advanced patterns and performance optimization techniques for complex React applications",
                        "progress": 0,
                        "modules": [
                            {
                                "title": "React Performance", 
                                "description": "Techniques to optimize React component rendering",
                                "resources": [
                                    {
                                        "title": "React Official Docs - Performance",
                                        "type": "documentation",
                                        "url": "https://reactjs.org/docs/optimizing-performance.html",
                                        "completed": false
                                    },
                                    {
                                        "title": "Optimizing React Performance",
                                        "type": "video",
                                        "url": "https://www.youtube.com/watch?v=5fLW5Q5ODiE",
                                        "completed": false
                                    }
                                ],
                                "projects": [
                                    {
                                        "title": "Performance Audit",
                                        "description": "Audit an existing React application and implement performance improvements",
                                        "completed": false
                                    }
                                ]
                            },
                            {
                                "title": "Advanced Hooks", 
                                "description": "Using and creating custom React hooks",
                                "resources": [
                                    {
                                        "title": "Building Your Own Hooks",
                                        "type": "documentation",
                                        "url": "https://reactjs.org/docs/hooks-custom.html",
                                        "completed": false
                                    }
                                ],
                                "projects": [
                                    {
                                        "title": "Custom Hooks Library",
                                        "description": "Build a library of 5 useful custom hooks",
                                        "completed": false
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "name": "TypeScript", 
                        "description": "Strongly typed programming language that builds on JavaScript",
                        "progress": 0,
                        "modules": [
                            {
                                "title": "TypeScript Basics", 
                                "description": "Core concepts and syntax of TypeScript",
                                "resources": [
                                    {
                                        "title": "TypeScript Handbook",
                                        "type": "documentation",
                                        "url": "https://www.typescriptlang.org/docs/handbook/intro.html",
                                        "completed": false
                                    },
                                    {
                                        "title": "TypeScript for Beginners",
                                        "type": "course",
                                        "url": "https://www.youtube.com/watch?v=BwuLxPH8IDs",
                                        "completed": false
                                    }
                                ],
                                "projects": [
                                    {
                                        "title": "TypeScript Conversion",
                                        "description": "Convert a JavaScript project to TypeScript",
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
                            "focus": "React Performance Fundamentals",
                            "activities": ["Study React profiler", "Learn about memo and useMemo"],
                            "completed": false
                        },
                        {
                            "week": 2,
                            "focus": "Advanced React Hooks",
                            "activities": ["Practice custom hooks", "Build 2 custom hooks"],
                            "completed": false
                        },
                        {
                            "week": 3,
                            "focus": "TypeScript Fundamentals",
                            "activities": ["Learn basic types", "Practice TypeScript exercises"],
                            "completed": false
                        },
                        {
                            "week": 4,
                            "focus": "TypeScript with React",
                            "activities": ["Integrate TypeScript with React", "Convert React components to TypeScript"],
                            "completed": false
                        }
                    ]
                }
            };
            
            // Format and display the example
            jsonTextarea.value = JSON.stringify(examplePlan, null, 2);
            
            // Track example view
            if (typeof trackEvent === 'function') {
                trackEvent('learning_example_plan_viewed');
            }
        }
    }
    
    // Show empty state when no plan is loaded
    function showEmptyState() {
        const emptyState = document.getElementById('learning-empty-state');
        const dashboard = document.getElementById('learning-dashboard');
        
        if (emptyState && dashboard) {
            emptyState.style.display = 'block';
            dashboard.classList.remove('active');
        }
    }
    
    // Render dashboard with plan data
    function renderDashboard() {
        if (!currentPlan) {
            showEmptyState();
            return;
        }
        
        const emptyState = document.getElementById('learning-empty-state');
        const dashboard = document.getElementById('learning-dashboard');
        
        if (emptyState && dashboard) {
            emptyState.style.display = 'none';
            dashboard.classList.add('active');
        }
        
        // Update plan title and metadata
        updatePlanHeader();
        
        // Update stats
        updateDashboardStats();
        
        // Render current section
        renderCurrentSection();
    }
    
    // Update plan header information
    function updatePlanHeader() {
        const titleElement = document.getElementById('learning-plan-title');
        const metaElement = document.getElementById('learning-plan-meta');
        const dateElement = document.getElementById('plan-created-date');
        
        if (titleElement) {
            titleElement.textContent = currentPlan.plan_title || 'Career Learning Plan';
        }
        
        if (dateElement && currentPlan.created_date) {
            const date = new Date(currentPlan.created_date);
            dateElement.textContent = date.toLocaleDateString();
        }
    }
    
    // Update dashboard statistics
    function updateDashboardStats() {
        const skills = currentPlan.skills || [];
        let totalResources = 0;
        let completedResources = 0;
        let totalProjects = 0;
        let completedProjects = 0;
        
        // Count resources and projects
        skills.forEach(skill => {
            if (skill.modules) {
                skill.modules.forEach(module => {
                    if (module.resources) {
                        totalResources += module.resources.length;
                        completedResources += module.resources.filter(r => r.completed).length;
                    }
                    
                    if (module.projects) {
                        totalProjects += module.projects.length;
                        completedProjects += module.projects.filter(p => p.completed).length;
                    }
                });
            }
        });
        
        // Calculate overall progress
        const totalItems = totalResources + totalProjects;
        const completedItems = completedResources + completedProjects;
        const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        
        // Update UI
        document.getElementById('skills-count').textContent = skills.length;
        document.getElementById('resources-count').textContent = totalResources;
        document.getElementById('projects-count').textContent = totalProjects;
        document.getElementById('overall-progress').textContent = progressPercentage + '%';
        
        // Update progress bar
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = progressPercentage + '%';
        }
        
        // Update individual skill progress
        skills.forEach((skill, skillIndex) => {
            skill.progress = calculateSkillProgress(skill);
        });
    }
    
    // Calculate progress percentage for a skill
    function calculateSkillProgress(skill) {
        let totalItems = 0;
        let completedItems = 0;
        
        if (skill.modules) {
            skill.modules.forEach(module => {
                if (module.resources) {
                    totalItems += module.resources.length;
                    completedItems += module.resources.filter(r => r.completed).length;
                }
                
                if (module.projects) {
                    totalItems += module.projects.length;
                    completedItems += module.projects.filter(p => p.completed).length;
                }
            });
        }
        
        return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    }
    
    // Render the current section (skills, timeline, resources)
    function renderCurrentSection() {
        // Hide all sections first
        document.querySelectorAll('.learning-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show the current section
        const currentSection = document.getElementById(`${currentView}-section`);
        if (currentSection) {
            currentSection.classList.add('active');
        }
        
        // Render section content
        switch (currentView) {
            case 'skills':
                renderSkillsSection();
                break;
            case 'timeline':
                renderTimelineSection();
                break;
            case 'resources':
                renderResourcesSection();
                break;
        }
    }
    
    // Switch between dashboard sections
    function switchSection(section) {
        // Update active nav item
        document.querySelectorAll('.learning-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`.learning-nav-item[data-section="${section}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
        
        // Update current view and render
        currentView = section;
        renderCurrentSection();
        
        // Track section change
        if (typeof trackEvent === 'function') {
            trackEvent('learning_section_change', { section });
        }
    }
    
    // Render the skills section with improved handling of many skills
    function renderSkillsSection() {
        const skillsGrid = document.getElementById('skills-grid');
        if (!skillsGrid || !currentPlan.skills) return;
        
        // Clear existing content
        skillsGrid.innerHTML = '';
        
        // Determine if we have many skills (more than 3)
        const hasMany = currentPlan.skills.length > 3;
        
        // Update grid class based on number of skills
        if (hasMany) {
            skillsGrid.classList.add('many-skills');
        } else {
            skillsGrid.classList.remove('many-skills');
        }
        
        // Add skill cards
        currentPlan.skills.forEach((skill, skillIndex) => {
            const skillCard = createSkillCard(skill, skillIndex);
            skillsGrid.appendChild(skillCard);
        });
    }
    
    // Create a skill card element with improved toggle behavior
    function createSkillCard(skill, skillIndex) {
        const skillCard = document.createElement('div');
        skillCard.className = 'skill-card';
        skillCard.setAttribute('data-skill-index', skillIndex);
        
        // Create card content
        skillCard.innerHTML = `
            <div class="skill-header">
                <h4 class="skill-name">${skill.name}</h4>
                <div class="skill-progress" data-progress="${skill.progress || 0}">${skill.progress || 0}%</div>
            </div>
            <p class="skill-description">${skill.description || ''}</p>
            <button class="skill-details-toggle">
                <span class="toggle-icon">▶</span> Show Details
            </button>
            <div class="skill-details">
                ${skill.modules ? skill.modules.map((module, moduleIndex) => `
                    <div class="module-item" data-module-index="${moduleIndex}">
                        <h5 class="module-title">${module.title}</h5>
                        <p class="module-description">${module.description || ''}</p>
                        
                        ${module.resources && module.resources.length > 0 ? `
                            <h6>Resources</h6>
                            <div class="resources-list">
                                ${module.resources.map((resource, resourceIndex) => `
                                    <div class="resource-item ${resource.completed ? 'completed' : ''}" data-resource-index="${resourceIndex}">
                                        <input type="checkbox" class="resource-checkbox" ${resource.completed ? 'checked' : ''}>
                                        <span class="resource-title">
                                            ${resource.url ? `<a href="${resource.url}" target="_blank">${resource.title}</a>` : resource.title}
                                        </span>
                                        <span class="resource-type ${resource.type || 'documentation'}">${resource.type || 'Doc'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        ${module.projects && module.projects.length > 0 ? `
                            <h6>Projects</h6>
                            <div class="projects-list">
                                ${module.projects.map((project, projectIndex) => `
                                    <div class="project-item ${project.completed ? 'completed' : ''}" data-project-index="${projectIndex}">
                                        <input type="checkbox" class="project-checkbox" ${project.completed ? 'checked' : ''}>
                                        <span class="project-title">${project.title}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('') : ''}
            </div>
        `;
        
        // Add event listeners
        const detailsToggle = skillCard.querySelector('.skill-details-toggle');
        const details = skillCard.querySelector('.skill-details');
        
        if (detailsToggle && details) {
            detailsToggle.addEventListener('click', function() {
                const isActive = details.classList.contains('active');
                
                // Close all other skill details first
                document.querySelectorAll('.skill-details.active').forEach(activeDetails => {
                    if (activeDetails !== details) {
                        activeDetails.classList.remove('active');
                        const parentCard = activeDetails.closest('.skill-card');
                        if (parentCard) {
                            const toggleBtn = parentCard.querySelector('.skill-details-toggle');
                            if (toggleBtn) {
                                toggleBtn.innerHTML = '<span class="toggle-icon">▶</span> Show Details';
                            }
                        }
                    }
                });
                
                // Toggle the clicked skill details
                details.classList.toggle('active');
                
                // Update button text
                this.innerHTML = isActive ? 
                    '<span class="toggle-icon">▶</span> Show Details' : 
                    '<span class="toggle-icon">▼</span> Hide Details';
            });
        }
        
        // Add event listeners for resource checkboxes
        skillCard.querySelectorAll('.resource-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const resourceItem = this.closest('.resource-item');
                const moduleItem = this.closest('.module-item');
                
                if (resourceItem && moduleItem) {
                    const resourceIndex = parseInt(resourceItem.getAttribute('data-resource-index'));
                    const moduleIndex = parseInt(moduleItem.getAttribute('data-module-index'));
                    
                    // Update data
                    updateResourceCompletionStatus(skillIndex, moduleIndex, resourceIndex, this.checked);
                    
                    // Update UI
                    resourceItem.classList.toggle('completed', this.checked);
                }
            });
        });
        
        // Add event listeners for project checkboxes
        skillCard.querySelectorAll('.project-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const projectItem = this.closest('.project-item');
                const moduleItem = this.closest('.module-item');
                
                if (projectItem && moduleItem) {
                    const projectIndex = parseInt(projectItem.getAttribute('data-project-index'));
                    const moduleIndex = parseInt(moduleItem.getAttribute('data-module-index'));
                    
                    // Update data
                    updateProjectCompletionStatus(skillIndex, moduleIndex, projectIndex, this.checked);
                    
                    // Update UI
                    projectItem.classList.toggle('completed', this.checked);
                }
            });
        });
        
        return skillCard;
    }
    
    // Update resource completion status
    function updateResourceCompletionStatus(skillIndex, moduleIndex, resourceIndex, completed) {
        if (!currentPlan || !currentPlan.skills) return;
        
        const skill = currentPlan.skills[skillIndex];
        if (skill && skill.modules && skill.modules[moduleIndex] && 
            skill.modules[moduleIndex].resources && skill.modules[moduleIndex].resources[resourceIndex]) {
            
            // Update the resource
            skill.modules[moduleIndex].resources[resourceIndex].completed = completed;
            
            // Update skill progress
            skill.progress = calculateSkillProgress(skill);
            
            // Update progress display
            const skillCard = document.querySelector(`.skill-card[data-skill-index="${skillIndex}"]`);
            if (skillCard) {
                const progressElement = skillCard.querySelector('.skill-progress');
                if (progressElement) {
                    progressElement.setAttribute('data-progress', skill.progress);
                    progressElement.textContent = skill.progress + '%';
                }
            }
            
            // Update dashboard stats
            updateDashboardStats();
            
            // Save changes
            setStorageData(STORAGE_KEY, currentPlan);
            
            // Track completion status change
            if (typeof trackEvent === 'function') {
                trackEvent('learning_resource_status_change', { 
                    skill: skill.name,
                    resource: skill.modules[moduleIndex].resources[resourceIndex].title,
                    status: completed ? 'completed' : 'incomplete'
                });
            }
        }
    }
    
    // Update project completion status
    function updateProjectCompletionStatus(skillIndex, moduleIndex, projectIndex, completed) {
        if (!currentPlan || !currentPlan.skills) return;
        
        const skill = currentPlan.skills[skillIndex];
        if (skill && skill.modules && skill.modules[moduleIndex] && 
            skill.modules[moduleIndex].projects && skill.modules[moduleIndex].projects[projectIndex]) {
            
            // Update the project
            skill.modules[moduleIndex].projects[projectIndex].completed = completed;
            
            // Update skill progress
            skill.progress = calculateSkillProgress(skill);
            
            // Update progress display
            const skillCard = document.querySelector(`.skill-card[data-skill-index="${skillIndex}"]`);
            if (skillCard) {
                const progressElement = skillCard.querySelector('.skill-progress');
                if (progressElement) {
                    progressElement.setAttribute('data-progress', skill.progress);
                    progressElement.textContent = skill.progress + '%';
                }
            }
            
            // Update dashboard stats
            updateDashboardStats();
            
            // Save changes
            setStorageData(STORAGE_KEY, currentPlan);
            
            // Track completion status change
            if (typeof trackEvent === 'function') {
                trackEvent('learning_project_status_change', { 
                    skill: skill.name,
                    project: skill.modules[moduleIndex].projects[projectIndex].title,
                    status: completed ? 'completed' : 'incomplete'
                });
            }
        }
    }
    
    // Render the timeline section
    function renderTimelineSection() {
        const timelineContainer = document.getElementById('timeline-container');
        if (!timelineContainer || !currentPlan.timeline || !currentPlan.timeline.weeks) return;
        
        // Clear existing content
        timelineContainer.innerHTML = '';
        
        // Add timeline weeks
        currentPlan.timeline.weeks.forEach((week, weekIndex) => {
            const weekElement = createTimelineWeek(week, weekIndex);
            timelineContainer.appendChild(weekElement);
        });
    }
    
    // Create a timeline week element
    function createTimelineWeek(week, weekIndex) {
        const currentDate = new Date();
        const startDate = new Date(currentPlan.created_date);
        const weekDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        // Calculate if this is the current week
        const weekStart = new Date(startDate.getTime() + (weekIndex * weekDuration));
        const weekEnd = new Date(weekStart.getTime() + weekDuration);
        const isCurrent = currentDate >= weekStart && currentDate < weekEnd;
        
        // Create week element
        const weekElement = document.createElement('div');
        weekElement.className = `timeline-week ${isCurrent ? 'current' : ''} ${week.completed ? 'completed' : ''}`;
        weekElement.setAttribute('data-week-index', weekIndex);
        
        weekElement.innerHTML = `
            <div class="timeline-week-number">
                <div class="timeline-week-circle">${week.week}</div>
                <div class="timeline-week-label">Week</div>
            </div>
            <div class="timeline-week-content">
                <h4 class="timeline-week-focus">${week.focus}</h4>
                <div class="timeline-week-activities">
                    ${week.activities ? week.activities.map((activity, activityIndex) => `
                        <div class="timeline-activity" data-activity-index="${activityIndex}">
                            <input type="checkbox" class="timeline-activity-checkbox" 
                                   ${week.activity_status && week.activity_status[activityIndex] ? 'checked' : ''}>
                            <span class="timeline-activity-text">${activity}</span>
                        </div>
                    `).join('') : ''}
                </div>
                <div class="timeline-progress">
                    <div class="timeline-progress-bar" style="width: ${calculateWeekProgress(week)}%"></div>
                </div>
            </div>
        `;
        
        // Add event listeners for activity checkboxes
        weekElement.querySelectorAll('.timeline-activity-checkbox').forEach((checkbox, activityIndex) => {
            checkbox.addEventListener('change', function() {
                updateWeekActivityStatus(weekIndex, activityIndex, this.checked);
            });
        });
        
        return weekElement;
    }
    
    // Calculate progress percentage for a week
    function calculateWeekProgress(week) {
        if (!week.activities || week.activities.length === 0) return 0;
        
        if (!week.activity_status) {
            week.activity_status = new Array(week.activities.length).fill(false);
        }
        
        const completedActivities = week.activity_status.filter(status => status).length;
        return Math.round((completedActivities / week.activities.length) * 100);
    }
    
    // Update week activity status
    function updateWeekActivityStatus(weekIndex, activityIndex, completed) {
        if (!currentPlan || !currentPlan.timeline || !currentPlan.timeline.weeks) return;
        
        const week = currentPlan.timeline.weeks[weekIndex];
        if (week) {
            // Initialize activity_status array if it doesn't exist
            if (!week.activity_status) {
                week.activity_status = new Array(week.activities.length).fill(false);
            }
            
            // Update the activity status
            week.activity_status[activityIndex] = completed;
            
            // Check if all activities are completed
            const allCompleted = week.activity_status.every(status => status);
            week.completed = allCompleted;
            
            // Update UI
            const weekElement = document.querySelector(`.timeline-week[data-week-index="${weekIndex}"]`);
            if (weekElement) {
                // Update week completion class
                weekElement.classList.toggle('completed', week.completed);
                
                // Update progress bar
                const progressBar = weekElement.querySelector('.timeline-progress-bar');
                if (progressBar) {
                    progressBar.style.width = calculateWeekProgress(week) + '%';
                }
            }
            
            // Save changes
            setStorageData(STORAGE_KEY, currentPlan);
            
            // Track activity completion
            if (typeof trackEvent === 'function') {
                trackEvent('learning_week_activity_change', {
                    week: week.week,
                    activity: week.activities[activityIndex],
                    completed: completed
                });
            }
        }
    }
    
    // Render the resources library section
    function renderResourcesSection() {
        const resourcesLibrary = document.getElementById('resources-library');
        if (!resourcesLibrary || !currentPlan.skills) return;
        
        // Clear existing content
        resourcesLibrary.innerHTML = '';
        
        // Group resources by type
        const resourcesByType = {};
        
        // Collect all resources
        currentPlan.skills.forEach(skill => {
            if (skill.modules) {
                skill.modules.forEach(module => {
                    if (module.resources) {
                        module.resources.forEach(resource => {
                            const type = resource.type || 'documentation';
                            
                            if (!resourcesByType[type]) {
                                resourcesByType[type] = [];
                            }
                            
                            resourcesByType[type].push({
                                ...resource,
                                skill: skill.name,
                                module: module.title
                            });
                        });
                    }
                });
            }
        });
        
        // Create section for each resource type
        Object.keys(resourcesByType).forEach(type => {
            const resources = resourcesByType[type];
            
            const typeSection = document.createElement('div');
            typeSection.className = 'resource-type-section';
            
            typeSection.innerHTML = `
                <h3 class="resource-type-title">${capitalizeFirstLetter(type)} Resources (${resources.length})</h3>
                <div class="resources-list">
                    ${resources.map(resource => `
                        <div class="resource-item ${resource.completed ? 'completed' : ''}">
                            <input type="checkbox" class="resource-checkbox" ${resource.completed ? 'checked' : ''}>
                            <span class="resource-title">
                                ${resource.url ? `<a href="${resource.url}" target="_blank">${resource.title}</a>` : resource.title}
                            </span>
                            <span class="resource-skill">${resource.skill} &bull; ${resource.module}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            
            resourcesLibrary.appendChild(typeSection);
        });
        
        // Display message if no resources
        if (Object.keys(resourcesByType).length === 0) {
            resourcesLibrary.innerHTML = '<p class="empty-resources">No learning resources found in this plan.</p>';
        }
        
        // Note: We don't add checkbox event listeners here because this is a view-only section.
        // Changes are made in the Skills section and reflected here.
    }
    
    // Helper function to capitalize the first letter of a string
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Edit current plan
    function editCurrentPlan() {
        if (!currentPlan) return;
        
        // Show modal to confirm
        showModal('Edit Learning Plan', 'Would you like to edit this learning plan? The JSON will be loaded into the editor.', [
            {
                id: 'cancel-edit',
                text: 'Cancel',
                class: 'secondary-button'
            },
            {
                id: 'confirm-edit',
                text: 'Edit Plan',
                class: 'primary-button',
                action: function() {
                    // Load JSON into the textarea
                    const jsonTextarea = document.getElementById('learning-plan-json');
                    if (jsonTextarea) {
                        jsonTextarea.value = JSON.stringify(currentPlan, null, 2);
                    }
                    
                    // Show empty state with textarea
                    showEmptyState();
                    
                    // Track edit action
                    if (typeof trackEvent === 'function') {
                        trackEvent('learning_plan_edit');
                    }
                }
            }
        ]);
    }
    
    // Reset plan progress
    function resetPlanProgress() {
        if (!currentPlan) return;
        
        // Show confirmation modal
        showModal('Reset Progress', 'Are you sure you want to reset all progress for this learning plan? This cannot be undone.', [
            {
                id: 'cancel-reset',
                text: 'Cancel',
                class: 'secondary-button'
            },
            {
                id: 'confirm-reset',
                text: 'Reset Progress',
                class: 'danger-button',
                action: function() {
                    // Reset all completion statuses
                    currentPlan.skills.forEach(skill => {
                        if (skill.modules) {
                            skill.modules.forEach(module => {
                                if (module.resources) {
                                    module.resources.forEach(resource => {
                                        resource.completed = false;
                                    });
                                }
                                
                                if (module.projects) {
                                    module.projects.forEach(project => {
                                        project.completed = false;
                                    });
                                }
                            });
                        }
                        
                        // Reset skill progress
                        skill.progress = 0;
                    });
                    
                    // Reset timeline progress
                    if (currentPlan.timeline && currentPlan.timeline.weeks) {
                        currentPlan.timeline.weeks.forEach(week => {
                            week.completed = false;
                            
                            if (week.activities) {
                                week.activity_status = new Array(week.activities.length).fill(false);
                            }
                        });
                    }
                    
                    // Save changes
                    setStorageData(STORAGE_KEY, currentPlan);
                    
                    // Re-render dashboard
                    renderDashboard();
                    
                    // Track reset action
                    if (typeof trackEvent === 'function') {
                        trackEvent('learning_plan_reset');
                    }
                }
            }
        ]);
    }
    
    // Helper function to copy to clipboard
    function copyToClipboard(text) {
        return navigator.clipboard.writeText(text);
    }
    
    // Refresh the dashboard
    function refreshDashboard() {
        loadSavedPlan();
    }
    
    // Public methods
    return {
        init: init,
        refreshDashboard: refreshDashboard
    };
})();

// Initialize Learning Dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    LearningDashboard.init();
});