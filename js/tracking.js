// Analytics and data collection for the Job Hunter Web App

// Configuration parameters
const DATA_COLLECTION = {
    // Google Apps Script endpoint - replace with your actual endpoint
    endpointUrl: 'https://script.google.com/macros/s/AKfycbyJSZQKHvaubK4UaXgQuMEBbH1eXFYedlKz6kwsKaLUuEY3xmx2xcJ82MmWXTU26VAD/exec',
    // Queue processing settings
    queue: {
        processingInterval: 1000,      // Process queue items every 1 second
        maxRetries: 5,                 // Maximum number of retries per item
        maxConcurrentRequests: 3,      // Max concurrent requests to avoid overwhelming the API
        retryDelayBase: 2000,          // Base delay before retry (will be multiplied by 2^retryCount)
        maxRetryDelay: 60000,          // Maximum retry delay (1 minute)
        persistenceInterval: 30000,    // Save queue to storage every 30 seconds
        maxQueueSize: 1000             // Maximum number of items in the queue
    },
    // Storage keys
    storage: {
        queueKey: 'dataCollectionQueue',
        activeRequestsKey: 'dataCollectionActiveRequests',
        userIdKey: 'userId'
    }
};

// Define priority levels for different types of events
const EVENT_PRIORITIES = {
    high: [
        'job_saved', 'application_generated', 'extension_install_click',
        'error', 'profile_saved', 'data_export', 'data_import', 'system_alert',
        'career_goal_selected', 'career_goal_cleared', 'career_goal_progress'
    ],
    medium: [
        'generate_application_click', 'tab_switch', 'view_job_details',
        'interview_prep_click'
    ],
    low: [
        'scroll_depth', 'time_on_site', 'page_view', 'mouse_movement',
        'feature_card_view', 'pricing_comparison_view'
    ]
};

// Function to get priority level of an event
function getEventPriority(eventType) {
    if (EVENT_PRIORITIES.high.some(e => eventType.includes(e))) return 'high';
    if (EVENT_PRIORITIES.medium.some(e => eventType.includes(e))) return 'medium';
    if (EVENT_PRIORITIES.low.some(e => eventType.includes(e))) return 'low';
    return 'medium'; // Default to medium for unknown events
}

// Queue state
let dataQueue = [];                // Main queue of items to be sent
let activeRequests = 0;            // Number of active requests
let queueProcessor = null;         // Interval ID for queue processor
let queueInitialized = false;      // Flag to prevent multiple initializations
let lastQueuePersistence = 0;      // Last time queue was persisted to storage

// Queue monitoring variables
let queueOverflowCount = 0;
let lastSystemAlertTime = 0;
const SYSTEM_ALERT_COOLDOWN = 3600000; // 1 hour in milliseconds
const HEALTH_REPORT_INTERVAL = 300000; // 5 minutes in milliseconds

// Function to send system alerts directly (bypassing queue)
function sendSystemAlert(alertName, details) {
    // Avoid sending too many system alerts
    const now = Date.now();
    if (now - lastSystemAlertTime < SYSTEM_ALERT_COOLDOWN) {
        return; // Still in cooldown period
    }
    
    // Create system alert data
    const systemAlertData = {
        type: 'system_alert',
        alert_name: alertName,
        details: {
            ...details,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            page_url: window.location.href
        }
    };
    
    // Send directly to the endpoint
    fetch(DATA_COLLECTION.endpointUrl, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(systemAlertData)
    });
    
    // Update the last alert time
    lastSystemAlertTime = now;
}

// Function to prune low-priority events when queue gets too full
function pruneQueueIfNeeded() {
    if (dataQueue.length > DATA_COLLECTION.queue.maxQueueSize * 0.8) {
        // First drop low priority events
        const originalLength = dataQueue.length;
        dataQueue = dataQueue.filter(item => 
            getEventPriority(item.data.type) !== 'low'
        );
        
        // If still too full, also drop medium priority events
        if (dataQueue.length > DATA_COLLECTION.queue.maxQueueSize * 0.9) {
            dataQueue = dataQueue.filter(item => 
                getEventPriority(item.data.type) === 'high'
            );
        }
        
        console.log(`Queue pruned: removed ${originalLength - dataQueue.length} events`);
        
        // If we had to prune, send a system alert
        if (originalLength !== dataQueue.length) {
            sendSystemAlert('queue_pruned', {
                removed_events: originalLength - dataQueue.length,
                remaining_events: dataQueue.length,
                percentage_full: (dataQueue.length / DATA_COLLECTION.queue.maxQueueSize) * 100
            });
        }
    }
}

// Setup queue health reporting
function setupQueueHealthMonitoring() {
    setInterval(() => {
        if (!queueInitialized) return;
        
        // Calculate queue health metrics
        const queueHealthData = {
            type: 'queue_health',
            queue_size: dataQueue.length,
            queue_capacity_percentage: (dataQueue.length / DATA_COLLECTION.queue.maxQueueSize) * 100,
            active_requests: activeRequests,
            oldest_item_age_seconds: dataQueue.length > 0 ? (Date.now() - dataQueue[0].timestamp) / 1000 : 0,
            pending_items: dataQueue.filter(item => item.status === 'pending').length,
            processing_items: dataQueue.filter(item => item.status === 'processing').length,
            waiting_items: dataQueue.filter(item => item.status === 'waiting').length,
            failed_items: dataQueue.filter(item => item.status === 'failed').length,
            timestamp: new Date().toISOString()
        };
        
        // Only send if queue isn't empty (to avoid unnecessary reports)
        if (dataQueue.length > 0 || activeRequests > 0) {
            // Send directly, bypassing the queue
            fetch(DATA_COLLECTION.endpointUrl, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(queueHealthData)
            });
        }
    }, HEALTH_REPORT_INTERVAL);
}

// Initialize the data collection system
function initializeDataCollection() {
    if (queueInitialized) return;
    
    // Load queue from storage
    dataQueue = getStorageData(DATA_COLLECTION.storage.queueKey, []);
    activeRequests = getStorageData(DATA_COLLECTION.storage.activeRequestsKey, 0);
    
    // Reset active requests if it's an unreasonable value
    if (activeRequests > DATA_COLLECTION.queue.maxConcurrentRequests) {
        console.warn(`Resetting unreasonable active requests count: ${activeRequests}`);
        activeRequests = 0;
    }
    
    // Start queue processor
    startQueueProcessor();
    
    // Set up queue health monitoring
    setupQueueHealthMonitoring();
    
    // Mark as initialized
    queueInitialized = true;
    lastQueuePersistence = Date.now();
    
    // Set up unload handler to persist queue
    window.addEventListener('beforeunload', persistQueue);
}

// Start the queue processor
function startQueueProcessor() {
    if (queueProcessor) {
        clearInterval(queueProcessor);
    }
    
    queueProcessor = setInterval(() => {
        processQueue();
        
        // Periodically persist queue to storage
        if (Date.now() - lastQueuePersistence > DATA_COLLECTION.queue.persistenceInterval) {
            persistQueue();
        }
    }, DATA_COLLECTION.queue.processingInterval);
}

// Persist queue to storage
function persistQueue() {
    if (dataQueue.length > 0) {
        setStorageData(DATA_COLLECTION.storage.queueKey, dataQueue);
        setStorageData(DATA_COLLECTION.storage.activeRequestsKey, activeRequests);
        
        lastQueuePersistence = Date.now();
    }
}

// Add an item to the queue
function queueDataItem(dataItem) {
    // Initialize if needed
    if (!queueInitialized) {
        initializeDataCollection();
    }
    
    // Run queue pruning if needed
    pruneQueueIfNeeded();
    
    // Check queue size
    if (dataQueue.length >= DATA_COLLECTION.queue.maxQueueSize) {
        console.warn(`Queue size limit reached (${DATA_COLLECTION.queue.maxQueueSize}). Dropping oldest item.`);
        queueOverflowCount++;
        
        // Send system alert if we're repeatedly hitting the limit
        if (queueOverflowCount >= 5) {
            sendSystemAlert('queue_overflow', {
                overflow_count: queueOverflowCount,
                queue_size: DATA_COLLECTION.queue.maxQueueSize
            });
            queueOverflowCount = 0; // Reset after alerting
        }
        
        dataQueue.shift(); // Remove oldest item
    }
    
    // Add item to queue with metadata
    dataQueue.push({
        data: dataItem,
        status: 'pending',
        retryCount: 0,
        timestamp: Date.now(),
        priority: getEventPriority(dataItem.type),
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10)
    });
    
    // If queue is getting large, persist it immediately
    if (dataQueue.length > 10) {
        persistQueue();
    }
}

// Process the queue
function processQueue() {
    // Skip if there's nothing to process
    if (dataQueue.length === 0) return;
    
    // Process as many items as we can based on concurrency limit
    while (dataQueue.length > 0 && activeRequests < DATA_COLLECTION.queue.maxConcurrentRequests) {
        // Find the next pending item, prioritizing high priority events
        let itemIndex = -1;
        
        // First try to find high priority pending items
        itemIndex = dataQueue.findIndex(item => item.status === 'pending' && item.priority === 'high');
        
        // If no high priority items, look for medium priority
        if (itemIndex === -1) {
            itemIndex = dataQueue.findIndex(item => item.status === 'pending' && item.priority === 'medium');
        }
        
        // If still no item found, take any pending item
        if (itemIndex === -1) {
            itemIndex = dataQueue.findIndex(item => item.status === 'pending');
        }
        
        if (itemIndex === -1) break; // No pending items
        
        const queueItem = dataQueue[itemIndex];
        
        // Mark as processing and increment active requests
        queueItem.status = 'processing';
        activeRequests++;
        
        // Send the request
        sendDataRequest(queueItem, itemIndex);
    }
}

// Calculate retry delay with exponential backoff
function calculateRetryDelay(retryCount) {
    const delay = Math.min(
        DATA_COLLECTION.queue.retryDelayBase * Math.pow(2, retryCount),
        DATA_COLLECTION.queue.maxRetryDelay
    );
    
    // Add jitter to prevent all retries happening at once
    return delay + (Math.random() * 1000);
}

// Send a data request to the Google Apps Script
function sendDataRequest(queueItem, queueIndex) {
    fetch(DATA_COLLECTION.endpointUrl, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(queueItem.data),
    })
    .then(() => {
        // Request completed successfully
        
        // Remove from queue
        dataQueue.splice(queueIndex, 1);
        activeRequests--;
    })
    .catch(error => {
        // Request failed
        console.error(`Request failed: ${queueItem.id}`, error);
        
        // Decrement active requests
        activeRequests--;
        
        // Handle retry logic
        if (queueItem.retryCount < DATA_COLLECTION.queue.maxRetries) {
            // Schedule retry with exponential backoff
            queueItem.retryCount++;
            queueItem.status = 'waiting';
            queueItem.nextRetry = Date.now() + calculateRetryDelay(queueItem.retryCount);
            
            // Set a timeout to mark the item as pending again after the delay
            setTimeout(() => {
                if (dataQueue.includes(queueItem)) {
                    queueItem.status = 'pending';
                }
            }, queueItem.nextRetry - Date.now());
        } else {
            // Max retries reached, mark as failed
            queueItem.status = 'failed';
        }
    });
}

// Specialized function for tracking career goal events
function trackCareerGoalEvent(eventType, goalData = {}) {
    const currentGoal = getCurrentCareerGoal();
    
    // Enhanced goal event data
    const enhancedData = {
        current_goal: currentGoal,
        has_active_goal: !!currentGoal,
        ...goalData
    };
    
    // If we have a current goal, add goal context
    if (currentGoal && window.CAREER_GOALS && window.CAREER_GOALS[currentGoal]) {
        enhancedData.goal_title = window.CAREER_GOALS[currentGoal].title;
        enhancedData.goal_description = window.CAREER_GOALS[currentGoal].description;
        
        // Calculate how long user has had this goal
        const goalData = getCareerGoalData();
        if (goalData && goalData.selectedAt) {
            const daysSinceSelection = Math.floor(
                (Date.now() - new Date(goalData.selectedAt)) / (1000 * 60 * 60 * 24)
            );
            enhancedData.goal_age_days = daysSinceSelection;
            enhancedData.completed_actions_count = goalData.progress?.completedActions?.length || 0;
        }
    }
    
    return trackAppEvent(eventType, enhancedData);
}

// Export for use by other modules
window.trackCareerGoalEvent = trackCareerGoalEvent;

// Main function to track events - use this for all data tracking
function trackAppEvent(eventType, eventData = {}) {
    const userId = getOrCreateUserId();
    
    // Create data object with common fields
    const data = {
        type: eventType,
        timestamp: new Date().toISOString(),
        user_id: userId,
        ...eventData
    };
    
    // Add to queue
    queueDataItem(data);
    
    return true;
}

// Create or get anonymous user ID
function getOrCreateUserId() {
    let userId = getStorageData(DATA_COLLECTION.storage.userIdKey);
    
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        setStorageData(DATA_COLLECTION.storage.userIdKey, userId);
    }
    
    return userId;
}

// Initialize tracking on page load
document.addEventListener('DOMContentLoaded', initializeDataCollection);