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
    clearNotificationLog
  };
}

// Make available globally for browser use
window.formatDateForDisplay = formatDateForDisplay;
window.showNotification = showNotification;
window.apiCall = apiCall;
window.getNotificationLog = getNotificationLog;
window.clearNotificationLog = clearNotificationLog;

