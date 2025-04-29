// UI utility functions for the Job Hunter Web App

// Initialize the UI when the page loads
function initUI() {
    setupTabs();
    setupCurrentYear();
    setupExportImport();
}

// Set up tab switching functionality
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Get the current active tab
            const currentActiveTab = document.querySelector('.tab-button.active');
            const currentTabId = currentActiveTab ? currentActiveTab.getAttribute('data-tab') : null;
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Track tab view - with enhanced parameters
            trackEvent('tab_switch', { 
                tab_name: tabId,
                previous_tab: currentTabId,
                is_first_switch: !currentTabId
            });
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

// Setup data export/import buttons
function setupExportImport() {
    // Add export button to profile tab
    const profileTab = document.getElementById('profile');
    
    if (profileTab) {
        const exportImportSection = document.createElement('div');
        exportImportSection.className = 'export-import-section hidden';
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
        
        profileTab.appendChild(exportImportSection);
        
        // Set up export button
        document.getElementById('export-data').addEventListener('click', () => {
            exportData();
        });
        
        // Set up import button
        document.getElementById('import-data').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        
        document.getElementById('import-file').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
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

// Check storage usage and show warning if close to limit
function checkStorageUsage() {
    try {
        let totalSize = 0;
        
        // Estimate size of all localStorage items
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalSize += key.length + value.length;
        }
        
        // Convert to KB
        const totalKB = Math.round(totalSize / 1024);
        
        // localStorage limit varies by browser but is typically 5-10MB
        // We'll warn at 4MB (4096KB)
        if (totalKB > 4096) {
            showStorageWarning(totalKB);
        }
        
        return totalKB;
    } catch (e) {
        console.error('Error checking storage usage:', e);
        return 0;
    }
}

// Show storage warning banner
function showStorageWarning(usedKB) {
    // Don't show if already dismissed
    if (getStorageData('storageWarningDismissed', false)) {
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
        </div>
    `;
    
    document.body.insertBefore(warningBanner, document.body.firstChild);
    
    // Handle buttons
    document.getElementById('export-storage-warning').addEventListener('click', () => {
        exportData();
    });
    
    document.getElementById('dismiss-storage-warning').addEventListener('click', () => {
        warningBanner.remove();
        setStorageData('storageWarningDismissed', true);
    });
}

// Show a modal with message - improved for mobile
function showModal(title, message, buttons = []) {
    // Check if we're on mobile and should use browser-native prompts
    const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile && message.length < 150 && buttons.length <= 2 && !message.includes('<')) {
        // Use browser-native confirm for simple cases on mobile
        if (buttons.length === 1) {
            // Simple alert with OK button
            alert(`${title}\n\n${message}`);
            if (buttons[0] && buttons[0].action) {
                buttons[0].action();
            }
            return null;
        } else if (buttons.length === 2) {
            // Confirm dialog with two options
            const confirmed = confirm(`${title}\n\n${message}`);
            if (confirmed && buttons[1] && buttons[1].action) {
                buttons[1].action(); // Usually the "confirm" action is second
            } else if (!confirmed && buttons[0] && buttons[0].action) {
                buttons[0].action(); // First button is usually "cancel"
            }
            return null;
        }
    }
    
    // For complex cases or desktop, use custom modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    let buttonHtml = '';
    buttons.forEach(button => {
        buttonHtml += `<button id="${button.id}" class="${button.class || 'primary-button'}">${button.text}</button>`;
    });
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2>${title}</h2>
            <div class="modal-message">${message}</div>
            <div class="modal-buttons">
                ${buttonHtml}
                ${buttons.length === 0 ? '<button class="default-button modal-ok-button">OK</button>' : ''}
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.appendChild(modal);
    
    // Show modal
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // Set up close button
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeModal(modal);
        });
    }
    
    // Set up default OK button if no buttons were provided
    const okBtn = modal.querySelector('.modal-ok-button');
    if (okBtn) {
        okBtn.addEventListener('click', () => {
            closeModal(modal);
        });
    }
    
    // Set up action buttons
    buttons.forEach(button => {
        const buttonElement = modal.querySelector(`#${button.id}`);
        if (buttonElement) {
            buttonElement.addEventListener('click', () => {
                if (button.action) {
                    button.action();
                }
                closeModal(modal);
            });
        }
    });
    
    // Close when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
    
    return modal;
}

// Close a modal
function closeModal(modal) {
    // Add a closing class for transition
    modal.classList.add('closing');
    modal.classList.remove('active');
    
    // Wait for transition to complete before removing
    setTimeout(() => {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }, 300);
}

// Show extension promotion banner at strategic locations
function showExtensionPromo(location) {
    // Don't show if the user has dismissed all promos
    if (getStorageData('allPromoDismissed', false)) {
        return;
    }
    
    // Check if this specific promo has been dismissed
    const dismissedPromos = getStorageData('dismissedPromos', []);
    if (dismissedPromos.includes(location)) {
        return;
    }
    
    // Check if any promo is already visible on the page
    const existingPromos = document.querySelectorAll('.extension-promo');
    if (existingPromos.length > 0) {
        return; // Don't add another promo if one already exists
    }
    
    let message = '';
    let id = `extension-promo-${location}`;
    
    // Different messages for different locations
    switch(location) {
        case 'job-save':
            message = 'Want to save jobs with one click? Get our browser extension!';
            break;
        case 'job-view':
            message = 'The browser extension can automatically extract job details!';
            break;
        case 'profile':
            message = 'The browser extension keeps your data synced across sessions!';
            break;
        case 'after-search':
            message = 'The browser extension makes job searching even faster!';
            break;
        default:
            message = 'Get more features with our free browser extension!';
    }
    
    const promoDiv = document.createElement('div');
    promoDiv.className = 'extension-promo';
    promoDiv.id = id;
    
    promoDiv.innerHTML = `
        <div class="promo-content">
            <p>${message}</p>
            <div class="promo-actions">
                <a href="https://addons.mozilla.org/en-US/firefox/addon/job-hunter-assistant/" target="_blank" class="install-button">Install Extension</a>
                <button class="dismiss-promo" data-location="${location}">&times;</button>
            </div>
        </div>
    `;
    
    // Add the promo to a suitable location based on its type
    let targetElement = null;
    
    switch(location) {
        case 'job-save':
            targetElement = document.querySelector('.job-entry-section');
            break;
        case 'job-view':
            targetElement = document.querySelector('.saved-jobs-section');
            break;
        case 'profile':
            targetElement = document.querySelector('#profile .form-group');
            break;
        case 'after-search':
            targetElement = document.querySelector('#find .search-buttons');
            break;
        default:
            targetElement = document.querySelector('#apply');
    }
    
    if (targetElement) {
        targetElement.insertAdjacentElement('afterbegin', promoDiv);
        
        // Add dismiss handler
        promoDiv.querySelector('.dismiss-promo').addEventListener('click', (e) => {
            const location = e.target.getAttribute('data-location');
            dismissPromo(location);
            promoDiv.remove();
            
            // Track dismiss action
            if (typeof trackEvent === 'function') {
                trackEvent('dismiss_promo', { location: location });
            }
        });
        
        // Track promo shown
        if (typeof trackEvent === 'function') {
            trackEvent('show_extension_promo', { location: location });
        }
    }
    
    return promoDiv;
}

// Dismiss a specific promo
function dismissPromo(location) {
    const dismissedPromos = getStorageData('dismissedPromos', []);
    if (!dismissedPromos.includes(location)) {
        dismissedPromos.push(location);
        setStorageData('dismissedPromos', dismissedPromos);
    }
}

// Dismiss all promos
function dismissAllPromos() {
    setStorageData('allPromoDismissed', true);
    
    // Remove any existing promos
    document.querySelectorAll('.extension-promo').forEach(promo => {
        promo.remove();
    });
}

// Initialize UI on page load
document.addEventListener('DOMContentLoaded', initUI);