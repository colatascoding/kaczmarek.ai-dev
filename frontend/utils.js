/**
 * Frontend utility functions
 */

const API_BASE = ""; // Same origin

/**
 * Safely format a date value for display
 */
function formatDateForDisplay(dateValue) {
  if (!dateValue) return "N/A";
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      // Return the original value if it's not a valid date
      return String(dateValue);
    }
    return date.toLocaleString();
  } catch (e) {
    return String(dateValue);
  }
}

/**
 * Notification log storage
 */
let notificationLog = [];

/**
 * Initialize notification log from localStorage
 */
function initNotificationLog() {
  try {
    const stored = localStorage.getItem("notificationLog");
    if (stored) {
      notificationLog = JSON.parse(stored);
      // Keep only last 1000 notifications
      if (notificationLog.length > 1000) {
        notificationLog = notificationLog.slice(-1000);
        saveNotificationLog();
      }
    }
  } catch (e) {
    console.warn("Failed to load notification log:", e);
    notificationLog = [];
  }
}

/**
 * Save notification log to localStorage
 */
function saveNotificationLog() {
  try {
    localStorage.setItem("notificationLog", JSON.stringify(notificationLog));
  } catch (e) {
    console.warn("Failed to save notification log:", e);
  }
}

/**
 * Add notification to log
 */
function addToNotificationLog(message, type) {
  const notification = {
    id: Date.now() + Math.random(),
    message,
    type,
    timestamp: new Date().toISOString()
  };
  
  notificationLog.push(notification);
  
  // Keep only last 1000 notifications
  if (notificationLog.length > 1000) {
    notificationLog = notificationLog.slice(-1000);
  }
  
  saveNotificationLog();
  
  // Trigger custom event for UI updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("notificationAdded", { detail: notification }));
  }
}

/**
 * Clear notification log
 */
function clearNotificationLog() {
  notificationLog = [];
  saveNotificationLog();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("notificationLogCleared"));
  }
}

/**
 * Get notification log
 */
function getNotificationLog() {
  return [...notificationLog].reverse(); // Return newest first
}

/**
 * Show a notification message
 */
function showNotification(message, type = "info") {
  const colors = {
    info: "#3b82f6",
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b"
  };
  
  const icons = {
    info: "ℹ️",
    success: "✓",
    error: "✗",
    warning: "⚠️"
  };
  
  // Add to log
  addToNotificationLog(message, type);
  
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    max-width: 400px;
    animation: slideInRight 0.3s ease-out;
  `;
  notification.textContent = `${icons[type] || icons.info} ${message}`;
  document.body.appendChild(notification);
  
  // Auto-remove after appropriate duration
  const duration = type === "error" ? 5000 : 3000;
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.style.animation = "slideOutRight 0.3s ease-out";
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }
  }, duration);
}

// Initialize notification log on load
if (typeof window !== "undefined" && window.document) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNotificationLog);
  } else {
    initNotificationLog();
  }
}

/**
 * API Helper
 */
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

// Expose functions globally
window.showNotification = showNotification;
window.getNotificationLog = getNotificationLog;
window.clearNotificationLog = clearNotificationLog;

// Export for module use
if (typeof module !== "undefined" && module.exports) {
  module.exports = { 
    formatDateForDisplay, 
    showNotification, 
    apiCall,
    getNotificationLog,
    clearNotificationLog,
    escapeHtml,
    cleanVersionTag,
    getStatusClass,
    getOrCreateModal,
    closeModalV2,
    groupBy
  };
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string|number|null|undefined} text - Text to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Clean version tag by removing "version" prefix
 * @param {string} versionTag - Version tag to clean
 * @returns {string} Cleaned version tag
 */
function cleanVersionTag(versionTag) {
  if (!versionTag) return "";
  return String(versionTag).replace(/^version/, "");
}

/**
 * Generate CSS class name from status string
 * Converts status to lowercase and replaces spaces with hyphens
 * @param {string} status - Status string
 * @param {string} defaultStatus - Default status if status is empty
 * @returns {string} CSS class name
 */
function getStatusClass(status, defaultStatus = "unknown") {
  const statusStr = (status || defaultStatus).toLowerCase().replace(/\s+/g, "-");
  return `status-badge ${statusStr}`;
}

// Make available globally for browser use
window.formatDateForDisplay = formatDateForDisplay;
window.showNotification = showNotification;
window.apiCall = apiCall;
window.getNotificationLog = getNotificationLog;
window.clearNotificationLog = clearNotificationLog;
/**
 * Create or get modal element
 * @returns {HTMLElement} Modal element
 */
function getOrCreateModal() {
  let modal = document.getElementById("modal-v2");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-v2";
    modal.className = "modal-v2";
    modal.innerHTML = `
      <div class="modal-content-v2" style="max-width: 800px;">
        <div class="modal-header-v2">
          <h3 id="modal-title-v2"></h3>
          <button class="modal-close" onclick="closeModalV2()">&times;</button>
        </div>
        <div class="modal-body-v2" id="modal-body-v2"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  return modal;
}

/**
 * Close modal
 */
function closeModalV2() {
  const modal = document.getElementById("modal-v2");
  if (modal) {
    modal.style.display = "none";
  }
}

/**
 * Group array items by a key
 * @param {Array} items - Array of items to group
 * @param {string|Function} keyFn - Key to group by (string property name or function)
 * @returns {Object} Object with keys as group names and values as arrays
 */
function groupBy(items, keyFn) {
  const groups = {};
  const getKey = typeof keyFn === "function" ? keyFn : (item) => item[keyFn];
  
  items.forEach(item => {
    const key = getKey(item);
    if (key != null) {
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
  });
  
  return groups;
}

window.escapeHtml = escapeHtml;
window.cleanVersionTag = cleanVersionTag;
window.getStatusClass = getStatusClass;
window.getOrCreateModal = getOrCreateModal;
window.closeModalV2 = closeModalV2;
window.groupBy = groupBy;

