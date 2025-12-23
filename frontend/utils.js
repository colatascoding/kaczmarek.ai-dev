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
  `;
  notification.textContent = `${icons[type] || icons.info} ${message}`;
  document.body.appendChild(notification);
  
  // Auto-remove after appropriate duration
  const duration = type === "error" ? 5000 : 3000;
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, duration);
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

// Expose showNotification globally
window.showNotification = showNotification;

// Export for module use
if (typeof module !== "undefined" && module.exports) {
  module.exports = { formatDateForDisplay, showNotification, apiCall };
}

// Make available globally for browser use
window.formatDateForDisplay = formatDateForDisplay;
window.showNotification = showNotification;
window.apiCall = apiCall;

