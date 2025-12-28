/**
 * Error Handling Utilities
 * Provides standardized error display and handling
 */

/**
 * Error display component
 */
function createErrorDisplay(error, options = {}) {
  const {
    title = 'Error',
    showRetry = false,
    onRetry = null,
    showDetails = false,
    details = null
  } = options;
  
  const container = document.createElement('div');
  container.className = 'error-display';
  container.setAttribute('role', 'alert');
  
  const icon = document.createElement('div');
  icon.className = 'error-icon';
  icon.textContent = '⚠️';
  icon.setAttribute('aria-hidden', 'true');
  
  const content = document.createElement('div');
  content.className = 'error-content';
  
  const titleEl = document.createElement('h3');
  titleEl.className = 'error-title';
  titleEl.textContent = title;
  content.appendChild(titleEl);
  
  const message = document.createElement('p');
  message.className = 'error-message';
  message.textContent = error.message || String(error);
  content.appendChild(message);
  
  if (showDetails && details) {
    const detailsEl = document.createElement('details');
    detailsEl.className = 'error-details';
    
    const summary = document.createElement('summary');
    summary.textContent = 'Show details';
    detailsEl.appendChild(summary);
    
    const pre = document.createElement('pre');
    pre.textContent = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    detailsEl.appendChild(pre);
    
    content.appendChild(detailsEl);
  }
  
  const actions = document.createElement('div');
  actions.className = 'error-actions';
  
  if (showRetry && onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-primary';
    retryBtn.textContent = 'Retry';
    retryBtn.onclick = onRetry;
    actions.appendChild(retryBtn);
  }
  
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'btn btn-secondary';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.onclick = () => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };
  actions.appendChild(dismissBtn);
  
  content.appendChild(actions);
  container.appendChild(icon);
  container.appendChild(content);
  
  return container;
}

/**
 * Show error in a container
 * @param {HTMLElement|string} container - Container element or ID
 * @param {Error} error - Error object
 * @param {Object} options - Display options
 */
function showError(container, error, options = {}) {
  const containerEl = typeof container === 'string'
    ? document.getElementById(container)
    : container;
  
  if (!containerEl) {
    console.error('Error container not found');
    return;
  }
  
  // Clear container
  containerEl.innerHTML = '';
  
  // Create and append error display
  const errorDisplay = createErrorDisplay(error, options);
  containerEl.appendChild(errorDisplay);
  
  // Also show notification
  if (window.showNotification) {
    window.showNotification(error.message || 'An error occurred', 'error');
  }
}

/**
 * Handle API errors consistently
 * @param {Error} error - Error object
 * @param {HTMLElement|string} container - Optional container to show error
 * @param {Object} options - Error display options
 */
function handleApiError(error, container = null, options = {}) {
  console.error('API Error:', error);
  
  // Extract error message from API response if available
  let errorMessage = error.message || 'An unexpected error occurred';
  let errorDetails = null;
  
  if (error.response) {
    try {
      const data = error.response.json ? error.response.json() : error.response;
      if (data.error) {
        errorMessage = data.error.message || data.error;
        errorDetails = data.error.details || data.error;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  
  const apiError = new Error(errorMessage);
  apiError.details = errorDetails;
  apiError.originalError = error;
  
  if (container) {
    showError(container, apiError, {
      ...options,
      showDetails: !!errorDetails,
      details: errorDetails
    });
  } else {
    // Just show notification
    if (window.showNotification) {
      window.showNotification(errorMessage, 'error');
    }
  }
  
  return apiError;
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} Wrapped function
 */
function withErrorHandling(fn, options = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (options.container) {
        handleApiError(error, options.container, options);
      } else {
        handleApiError(error);
      }
      
      if (options.onError) {
        options.onError(error);
      }
      
      throw error;
    }
  };
}

// Expose globally
window.createErrorDisplay = createErrorDisplay;
window.showError = showError;
window.handleApiError = handleApiError;
window.withErrorHandling = withErrorHandling;

