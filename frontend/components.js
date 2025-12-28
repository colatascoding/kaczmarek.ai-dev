/**
 * Reusable UI Components
 * Provides common UI components to reduce code duplication
 */

/**
 * Create a status badge element
 * @param {string} status - Status text
 * @param {string} variant - Badge variant (default, small, large)
 * @returns {HTMLElement} Status badge element
 */
function createStatusBadge(status, variant = 'default') {
  if (!status) return document.createTextNode('');
  
  const badge = document.createElement('span');
  const statusClass = status.toLowerCase().replace(/\s+/g, '-');
  badge.className = `status-badge ${statusClass} status-badge--${variant}`;
  badge.textContent = status;
  badge.setAttribute('aria-label', `Status: ${status}`);
  badge.setAttribute('role', 'status');
  return badge;
}

/**
 * Create an empty state component
 * @param {string} message - Empty state message
 * @param {string} actionLabel - Optional action button label
 * @param {Function} onAction - Optional action button callback
 * @returns {HTMLElement} Empty state element
 */
function createEmptyState(message, actionLabel = null, onAction = null) {
  const container = document.createElement('div');
  container.className = 'empty-state';
  
  const icon = document.createElement('div');
  icon.className = 'empty-state-icon';
  icon.textContent = '📭';
  icon.setAttribute('aria-hidden', 'true');
  
  const text = document.createElement('p');
  text.className = 'empty-state-message';
  text.textContent = message;
  
  container.appendChild(icon);
  container.appendChild(text);
  
  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.textContent = actionLabel;
    button.onclick = onAction;
    container.appendChild(button);
  }
  
  return container;
}

/**
 * Create a loading spinner
 * @param {string} size - Spinner size (small, medium, large)
 * @param {string} message - Optional loading message
 * @returns {HTMLElement} Loading spinner element
 */
function createLoadingSpinner(size = 'medium', message = null) {
  const container = document.createElement('div');
  container.className = `loading-spinner loading-spinner--${size}`;
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  container.appendChild(spinner);
  
  if (message) {
    const text = document.createElement('span');
    text.className = 'loading-message';
    text.textContent = message;
    container.appendChild(text);
  }
  
  return container;
}

/**
 * Create a skeleton loader
 * @param {string} type - Skeleton type (text, card, list)
 * @param {number} count - Number of skeleton items
 * @returns {HTMLElement} Skeleton loader element
 */
function createSkeletonLoader(type = 'card', count = 1) {
  const container = document.createElement('div');
  container.className = 'skeleton-loader';
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', 'Loading content');
  
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton--${type}`;
    container.appendChild(skeleton);
  }
  
  return container;
}

/**
 * Create a list item component
 * @param {Object} data - Item data
 * @param {Function} onClick - Click handler
 * @param {Function} renderContent - Function to render item content
 * @returns {HTMLElement} List item element
 */
function createListItem(data, onClick = null, renderContent = null) {
  const item = document.createElement('div');
  item.className = 'list-item';
  
  if (onClick) {
    item.style.cursor = 'pointer';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.addEventListener('click', onClick);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e);
      }
    });
  }
  
  if (renderContent) {
    const content = renderContent(data);
    if (typeof content === 'string') {
      item.innerHTML = content;
    } else {
      item.appendChild(content);
    }
  } else {
    // Default rendering
    item.textContent = JSON.stringify(data);
  }
  
  return item;
}

/**
 * Create a modal component
 * @param {string} title - Modal title
 * @param {HTMLElement|string} content - Modal content
 * @param {Function} onClose - Close handler
 * @param {Object} options - Additional options (size, closable)
 * @returns {HTMLElement} Modal element
 */
function createModal(title, content, onClose, options = {}) {
  const {
    size = 'medium',
    closable = true,
    id = `modal-${Date.now()}`
  } = options;
  
  const modal = document.createElement('div');
  modal.id = id;
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', `${id}-title`);
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  if (closable) {
    overlay.onclick = onClose;
  }
  
  const modalContent = document.createElement('div');
  modalContent.className = `modal-content modal-content--${size}`;
  
  const header = document.createElement('div');
  header.className = 'modal-header';
  
  const titleEl = document.createElement('h2');
  titleEl.id = `${id}-title`;
  titleEl.textContent = title;
  header.appendChild(titleEl);
  
  if (closable) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close modal');
    closeBtn.onclick = onClose;
    header.appendChild(closeBtn);
  }
  
  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else {
    body.appendChild(content);
  }
  
  modalContent.appendChild(header);
  modalContent.appendChild(body);
  modal.appendChild(overlay);
  modal.appendChild(modalContent);
  
  // Focus management
  const focusableElements = modalContent.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // Trap focus
  const trapFocus = (e) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  
  modal.addEventListener('keydown', trapFocus);
  
  // Close on Escape
  if (closable) {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    modal.addEventListener('keydown', handleEscape);
  }
  
  // Show modal
  document.body.appendChild(modal);
  requestAnimationFrame(() => {
    modal.classList.add('active');
    firstElement?.focus();
  });
  
  return modal;
}

/**
 * Close a modal
 * @param {string|HTMLElement} modalIdOrElement - Modal ID or element
 */
function closeModal(modalIdOrElement) {
  const modal = typeof modalIdOrElement === 'string'
    ? document.getElementById(modalIdOrElement)
    : modalIdOrElement;
  
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300); // Wait for animation
  }
}

/**
 * Create a filter bar component
 * @param {Array} filters - Filter configuration
 * @param {Function} onFilterChange - Filter change handler
 * @returns {HTMLElement} Filter bar element
 */
function createFilterBar(filters, onFilterChange) {
  const container = document.createElement('div');
  container.className = 'filter-bar';
  container.setAttribute('role', 'search');
  
  filters.forEach(filter => {
    const { id, label, type, options, placeholder } = filter;
    
    const group = document.createElement('div');
    group.className = 'filter-group';
    
    if (label) {
      const labelEl = document.createElement('label');
      labelEl.setAttribute('for', id);
      labelEl.textContent = label;
      labelEl.className = 'filter-label';
      group.appendChild(labelEl);
    }
    
    let input;
    if (type === 'select') {
      input = document.createElement('select');
      input.id = id;
      input.className = 'filter-input';
      
      if (placeholder) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = placeholder;
        input.appendChild(option);
      }
      
      options?.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label || opt.value;
        input.appendChild(option);
      });
    } else if (type === 'text' || type === 'search') {
      input = document.createElement('input');
      input.type = type;
      input.id = id;
      input.className = 'filter-input';
      if (placeholder) {
        input.placeholder = placeholder;
      }
    }
    
    if (input) {
      input.addEventListener('change', () => {
        onFilterChange(getFilterValues(container));
      });
      
      if (type === 'text' || type === 'search') {
        // Debounce search input
        let timeout;
        input.addEventListener('input', () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            onFilterChange(getFilterValues(container));
          }, 300);
        });
      }
      
      group.appendChild(input);
    }
    
    container.appendChild(group);
  });
  
  return container;
}

/**
 * Get filter values from filter bar
 * @param {HTMLElement} filterBar - Filter bar element
 * @returns {Object} Filter values
 */
function getFilterValues(filterBar) {
  const values = {};
  filterBar.querySelectorAll('.filter-input').forEach(input => {
    values[input.id] = input.value;
  });
  return values;
}

// Expose globally
window.createStatusBadge = createStatusBadge;
window.createEmptyState = createEmptyState;
window.createLoadingSpinner = createLoadingSpinner;
window.createSkeletonLoader = createSkeletonLoader;
window.createListItem = createListItem;
window.createModal = createModal;
window.closeModal = closeModal;
window.createFilterBar = createFilterBar;
window.getFilterValues = getFilterValues;

