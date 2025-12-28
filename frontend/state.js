/**
 * Simple State Management System
 * Provides centralized state management with event-based updates
 */

class StateManager {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Map();
    this.history = [];
    this.maxHistorySize = 50;
  }

  /**
   * Get current state
   * @param {string} key - Optional key to get specific state property
   * @returns {*} State value or entire state
   */
  getState(key = null) {
    if (key) {
      return this.state[key];
    }
    return { ...this.state }; // Return copy to prevent direct mutation
  }

  /**
   * Set state
   * @param {Object|Function} updates - State updates or updater function
   * @param {boolean} silent - If true, don't notify listeners
   */
  setState(updates, silent = false) {
    const prevState = { ...this.state };
    
    if (typeof updates === 'function') {
      this.state = { ...this.state, ...updates(this.state) };
    } else {
      this.state = { ...this.state, ...updates };
    }
    
    // Save to history
    this.history.push({
      timestamp: Date.now(),
      prevState,
      newState: { ...this.state }
    });
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
    
    if (!silent) {
      this.notifyListeners(prevState, this.state);
    }
  }

  /**
   * Subscribe to state changes
   * @param {string|Function} keyOrCallback - State key to watch or callback function
   * @param {Function} callback - Callback function (if first param is key)
   * @returns {Function} Unsubscribe function
   */
  subscribe(keyOrCallback, callback = null) {
    let key = null;
    let cb = null;
    
    if (typeof keyOrCallback === 'function') {
      cb = keyOrCallback;
    } else {
      key = keyOrCallback;
      cb = callback;
    }
    
    if (!cb) {
      throw new Error('Callback function required');
    }
    
    const listener = {
      key,
      callback: cb,
      id: Date.now() + Math.random()
    };
    
    if (!this.listeners.has(key || 'all')) {
      this.listeners.set(key || 'all', []);
    }
    this.listeners.get(key || 'all').push(listener);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key || 'all');
      if (listeners) {
        const index = listeners.findIndex(l => l.id === listener.id);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Notify listeners of state changes
   * @param {Object} prevState - Previous state
   * @param {Object} newState - New state
   */
  notifyListeners(prevState, newState) {
    // Notify listeners for specific keys
    Object.keys(newState).forEach(key => {
      if (prevState[key] !== newState[key]) {
        const listeners = this.listeners.get(key);
        if (listeners) {
          listeners.forEach(listener => {
            try {
              listener.callback(newState[key], prevState[key], key);
            } catch (error) {
              console.error('State listener error:', error);
            }
          });
        }
      }
    });
    
    // Notify global listeners
    const globalListeners = this.listeners.get('all');
    if (globalListeners) {
      globalListeners.forEach(listener => {
        try {
          listener.callback(newState, prevState);
        } catch (error) {
          console.error('State listener error:', error);
        }
      });
    }
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('statechange', {
      detail: { state: newState, prevState }
    }));
  }

  /**
   * Reset state to initial values
   */
  reset() {
    const prevState = { ...this.state };
    this.state = { ...this.initialState };
    this.notifyListeners(prevState, this.state);
  }

  /**
   * Get state history
   * @param {number} limit - Limit number of history entries
   * @returns {Array} State history
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }
}

// Create global state manager instance
const appState = new StateManager({
  currentView: 'dashboard',
  workflows: [],
  agents: [],
  executions: [],
  versions: [],
  loading: {},
  errors: {},
  filters: {}
});

// Expose globally
window.appState = appState;

// Helper functions
function getState(key) {
  return appState.getState(key);
}

function setState(updates) {
  appState.setState(updates);
}

function subscribe(keyOrCallback, callback) {
  return appState.subscribe(keyOrCallback, callback);
}

// Expose helpers
window.getState = getState;
window.setState = setState;
window.subscribe = subscribe;

