/**
 * Simple URL Router
 * Provides hash-based routing for the application
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.beforeRouteChange = null;
    this.afterRouteChange = null;
    
    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });
    
    // Listen for popstate (back/forward)
    window.addEventListener('popstate', () => {
      this.handleRouteChange();
    });
  }

  /**
   * Register a route
   * @param {string} path - Route path (e.g., '/dashboard', '/workflows/:id')
   * @param {Function} handler - Route handler function
   */
  route(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Navigate to a route
   * @param {string} path - Route path
   * @param {Object} params - Route parameters
   */
  navigate(path, params = {}) {
    const fullPath = this.buildPath(path, params);
    
    if (this.beforeRouteChange) {
      const result = this.beforeRouteChange(fullPath, params);
      if (result === false) {
        return; // Navigation cancelled
      }
    }
    
    // Update URL hash
    window.location.hash = fullPath;
    
    // Also update history for back button support
    if (history.pushState) {
      history.pushState({ path: fullPath }, '', `#${fullPath}`);
    }
    
    this.handleRouteChange();
  }

  /**
   * Build path with parameters
   * @param {string} path - Route path template
   * @param {Object} params - Parameters to substitute
   * @returns {string} Built path
   */
  buildPath(path, params) {
    let builtPath = path;
    
    // Replace :param with actual values
    Object.keys(params).forEach(key => {
      builtPath = builtPath.replace(`:${key}`, params[key]);
    });
    
    return builtPath;
  }

  /**
   * Parse route parameters
   * @param {string} routePattern - Route pattern (e.g., '/workflows/:id')
   * @param {string} path - Actual path
   * @returns {Object|null} Parameters object or null if no match
   */
  parseParams(routePattern, path) {
    const patternParts = routePattern.split('/');
    const pathParts = path.split('/');
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null; // Path doesn't match
      }
    }
    
    return params;
  }

  /**
   * Handle route change
   */
  handleRouteChange() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.split('?')[0]; // Remove query string
    const queryString = hash.split('?')[1] || '';
    
    // Parse query parameters
    const queryParams = {};
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        queryParams[decodeURIComponent(key)] = decodeURIComponent(value || '');
      });
    }
    
    // Find matching route
    let matchedRoute = null;
    let routeParams = {};
    
    for (const [routePattern, handler] of this.routes.entries()) {
      if (routePattern.includes(':')) {
        // Parameterized route
        const params = this.parseParams(routePattern, path);
        if (params !== null) {
          matchedRoute = routePattern;
          routeParams = params;
          break;
        }
      } else if (routePattern === path) {
        // Exact match
        matchedRoute = routePattern;
        break;
      }
    }
    
    if (matchedRoute) {
      const handler = this.routes.get(matchedRoute);
      this.currentRoute = {
        path,
        pattern: matchedRoute,
        params: routeParams,
        query: queryParams
      };
      
      // Call handler
      handler(routeParams, queryParams);
      
      if (this.afterRouteChange) {
        this.afterRouteChange(this.currentRoute);
      }
    } else {
      // Default route or 404
      console.warn(`Route not found: ${path}`);
      if (this.routes.has('/')) {
        this.routes.get('/')({}, queryParams);
      }
    }
  }

  /**
   * Get current route
   * @returns {Object} Current route information
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Set before route change hook
   * @param {Function} hook - Hook function (return false to cancel)
   */
  setBeforeRouteChange(hook) {
    this.beforeRouteChange = hook;
  }

  /**
   * Set after route change hook
   * @param {Function} hook - Hook function
   */
  setAfterRouteChange(hook) {
    this.afterRouteChange = hook;
  }

  /**
   * Start the router
   */
  start() {
    // Handle initial route
    if (!window.location.hash) {
      window.location.hash = '/';
    }
    this.handleRouteChange();
  }
}

// Create global router instance
const router = new Router();

// Expose globally
window.router = router;

// Route mapping for views
const routeToView = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/workflows': 'workflows',
  '/workflows/:id': 'workflow-detail',
  '/agents': 'agents',
  '/executions': 'executions',
  '/executions/:id': 'execution-detail',
  '/versions': 'versions',
  '/versions/:id': 'version-detail',
  '/dashboards': 'dashboards'
};

// Register routes
Object.keys(routeToView).forEach(route => {
  router.route(route, (params, query) => {
    const viewName = routeToView[route];
    
    // Handle special cases
    if (viewName === 'workflow-detail') {
      // Could show workflow details modal or navigate to execution
      if (window.switchView) {
        window.switchView('workflows');
        // Trigger workflow detail view
        setTimeout(() => {
          if (params.id && window.showWorkflowDetails) {
            window.showWorkflowDetails(params.id);
          }
        }, 100);
      }
    } else if (viewName === 'execution-detail') {
      if (window.switchView) {
        window.switchView('executions');
        // Could show execution details
      }
    } else if (viewName === 'version-detail') {
      if (window.switchView) {
        window.switchView('versions');
        // Could show version details
      }
    } else {
      // Standard view switch
      if (window.switchView) {
        window.switchView(viewName);
      }
    }
  });
});

// Helper function to navigate
function navigateTo(path, params = {}) {
  router.navigate(path, params);
}

// Expose helper
window.navigateTo = navigateTo;

// Start router when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    router.start();
  });
} else {
  router.start();
}

