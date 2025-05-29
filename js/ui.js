// UI utility functions for the Job Hunter Web App

// Initialize the UI when the page loads
function initUI() {
    setupTabs();
    setupCurrentYear();
    setupCareerGoalNavigation(); // Setup career goal feature navigation
    setupExportImport();
    // Initial call to update feature access in app.js will handle UI updates after auth
    if (window.updateFeatureAccessUI) window.updateFeatureAccessUI();
}

// Set up tab switching functionality
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const tabId = button.getAttribute('data-tab');
            
            // Uses window.checkTabAccess defined in app.js
            if (typeof window.checkTabAccess === 'function' && !window.checkTabAccess(tabId)) {
                e.preventDefault();
                return;
            }

            const currentActiveTab = document.querySelector('.tab-button.active');
            const currentTabId = currentActiveTab ? currentActiveTab.getAttribute('data-tab') : null;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            if (typeof trackTabSwitch === 'function') {
                trackTabSwitch(tabId, currentTabId);
            } else if (typeof trackEvent === 'function') {
                trackEvent('tab_switch', { tab_name: tabId, previous_tab: currentTabId });
            }
        });
    });
}

// Set current year in footer
function setupCurrentYear() {
    const currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
}

// Setup data export/import buttons (from original ui.js)
function setupExportImport() {
    const profileTab = document.getElementById('profile');
    if (profileTab) {
        const existingSection = profileTab.querySelector('.export-import-section');
        if (existingSection) return;

        const exportImportSection = document.createElement('div');
        exportImportSection.className = 'export-import-section hidden'; // Changed to hidden by default as per original file
        exportImportSection.innerHTML = `
            <h3>Export/Import Data</h3>
            <p class="info-text">Export your data to back it up or transfer it to another device.</p>
            <div class="export-import-buttons">
                <button id="export-data" class="secondary-button">Export Data</button>
                <input type="file" id="import-file" accept=".json" style="display:none;">
                <button id="import-data" class="secondary-button">Import Data</button>
            </div>
            <p class="warning-text">Note: Your data is stored in your browser. Clearing browser data will erase your Job Hunter data.</p>
        `;
        
        profileTab.appendChild(exportImportSection); // Append to profileTab

        document.getElementById('export-data').addEventListener('click', () => {
            if (typeof exportData === 'function') exportData();
        });

        document.getElementById('import-data').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && typeof importData === 'function') {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const importSuccess = importData(e.target.result);
                    if (importSuccess) {
                        alert('Data imported successfully. The page will now reload.');
                        window.location.reload();
                    }
                };
                reader.readAsText(file);
            }
        });
    }
}

// Check storage usage and show warning if close to limit (from original ui.js)
function checkStorageUsage() {
    if (typeof getStorageData !== 'function') return; 
    try {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalSize += (key?.length || 0) + (value?.length || 0);
        }
        const totalKB = Math.round(totalSize / 1024);
        if (totalKB > 4096) {
            showStorageWarning(totalKB);
        }
        return totalKB;
    } catch (e) {
        console.error('Error checking storage usage:', e);
        return 0;
    }
}

// Show storage warning banner (from original ui.js)
function showStorageWarning(usedKB) {
    if (typeof getStorageData !== 'function' || getStorageData('storageWarningDismissed', false)) {
        return;
    }
    const warningBanner = document.createElement('div');
    warningBanner.className = 'storage-warning';
    warningBanner.innerHTML = `
        <div class="storage-warning-content">
            <p><strong>Storage Warning:</strong> You're using ${usedKB}KB of browser storage (limit ~5000KB). 
            Consider exporting and backing up your data, then removing old jobs.</p>
            <div class="storage-warning-actions">
                <button id="export-storage-warning" class="secondary-button">Export Data</button>
                <button id="dismiss-storage-warning" class="default-button">Dismiss</button>
            </div>
        </div>`;
    document.body.insertBefore(warningBanner, document.body.firstChild);
    document.getElementById('export-storage-warning').addEventListener('click', () => {
        if (typeof exportData === 'function') exportData();
    });
    document.getElementById('dismiss-storage-warning').addEventListener('click', () => {
        warningBanner.remove();
        if (typeof setStorageData === 'function') setStorageData('storageWarningDismissed', true);
    });
}

// Show a modal with message - improved for mobile (from original ui.js)
function showModal(title, message, buttons = []) {
    const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && message.length < 150 && buttons.length <= 2 && !message.includes('<')) {
        if (buttons.length === 1) {
            alert(`${title}\n\n${message}`);
            if (buttons[0] && buttons[0].action) buttons[0].action();
            return null;
        } else if (buttons.length === 2) {
            const confirmed = confirm(`${title}\n\n${message}`);
            if (confirmed && buttons[1] && buttons[1].action) buttons[1].action();
            else if (!confirmed && buttons[0] && buttons[0].action) buttons[0].action();
            return null;
        }
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    let buttonHtml = buttons.map(b => `<button id="${b.id}" class="${b.class || 'primary-button'}">${b.text}</button>`).join('');
    if (buttons.length === 0) buttonHtml = '<button class="default-button modal-ok-button">OK</button>';
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span><h2>${title}</h2>
            <div class="modal-message">${message}</div>
            <div class="modal-buttons">${buttonHtml}</div>
        </div>`;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));

    const okBtn = modal.querySelector('.modal-ok-button');
    if (okBtn) okBtn.addEventListener('click', () => closeModal(modal));

    buttons.forEach(button => {
        const btnEl = modal.querySelector(`#${button.id}`);
        if (btnEl) btnEl.addEventListener('click', () => {
            if (button.action) button.action();
            closeModal(modal);
        });
    });
    
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    return modal;
}
window.showModal = showModal; // Make it globally accessible

// Close a modal (from original ui.js)
function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('closing');
    modal.classList.remove('active');
    setTimeout(() => {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    }, 300);
}

// Setup career goal navigation links
function setupCareerGoalNavigation() {
    const featureButtons = document.querySelectorAll('.feature-btn');
    
    featureButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = button.getAttribute('data-tab');
            
            if (targetTab) {
                const tabButton = document.querySelector(`.tab-button[data-tab="${targetTab}"]`);
                if (tabButton) {
                    tabButton.click();
                    
                    if (typeof trackEvent === 'function') {
                        trackEvent('career_goal_feature_navigation', {
                            target_tab: targetTab,
                            feature_name: button.textContent.trim()
                        });
                    }
                }
            }
        });
    });
}

// Update career goal visual feedback
function updateCareerGoalVisualFeedback() {
    const featureSections = document.querySelectorAll('.career-goal-features');
    const radioButtons = document.querySelectorAll('input[name="career-goal"]');
    
    // Hide all feature sections
    featureSections.forEach(section => {
        section.classList.remove('show');
    });
    
    // Show selected goal's features
    radioButtons.forEach(radio => {
        if (radio.checked) {
            const goalValue = radio.value;
            const featureSection = document.querySelector(`.career-goal-features[data-goal="${goalValue}"]`);
            
            if (featureSection) {
                featureSection.classList.add('show');
            }
        }
    });
}

// Initialize UI on page load
document.addEventListener('DOMContentLoaded', initUI);