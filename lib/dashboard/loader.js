/**
 * Dashboard loader and parser
 * Handles loading and parsing dashboard definitions
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../../bin/utils");
const libraryOps = require("../library/file-operations");

/**
 * Load dashboard from library or file path
 * @param {string} dashboardIdOrPath - Dashboard ID or file path
 * @param {string} cwd - Current working directory
 * @returns {object|null} - Dashboard definition or null
 */
function loadDashboard(dashboardIdOrPath, cwd = process.cwd()) {
  const config = loadConfig(cwd);
  const libraryDir = config?.library?.libraryDir || "library";
  
  // If it's a file path, load directly
  if (dashboardIdOrPath.includes("/") || dashboardIdOrPath.endsWith(".json")) {
    const dashboardPath = path.isAbsolute(dashboardIdOrPath) 
      ? dashboardIdOrPath 
      : path.join(cwd, dashboardIdOrPath);
    
    if (!fs.existsSync(dashboardPath)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(dashboardPath, "utf8");
      return JSON.parse(content);
    } catch (e) {
      console.error(`Failed to load dashboard from ${dashboardPath}:`, e.message);
      return null;
    }
  }
  
  // Otherwise, try to find in library
  const items = libraryOps.listLibraryItems("dashboards", null, cwd, libraryDir);
  const item = items.find(i => i.name === dashboardIdOrPath || i.path.includes(dashboardIdOrPath));
  
  if (!item) {
    return null;
  }
  
  // Find dashboard.json file
  const files = libraryOps.getLibraryItemFiles(item.path, cwd, libraryDir);
  const dashboardFile = files.find(f => f.name === "dashboard.json" || f.name.endsWith(".json"));
  
  if (!dashboardFile) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(dashboardFile.path, "utf8");
    const dashboard = JSON.parse(content);
    
    // Merge with metadata
    const metadata = libraryOps.readLibraryMetadata(item.path, cwd, libraryDir);
    return {
      ...dashboard,
      id: item.name,
      path: item.path,
      metadata: metadata || {}
    };
  } catch (e) {
    console.error(`Failed to load dashboard from ${dashboardFile.path}:`, e.message);
    return null;
  }
}

/**
 * List all available dashboards
 * @param {string} cwd - Current working directory
 * @returns {Array} - Array of dashboard objects
 */
function listDashboards(cwd = process.cwd()) {
  const config = loadConfig(cwd);
  const libraryDir = config?.library?.libraryDir || "library";
  
  const items = libraryOps.listLibraryItems("dashboards", null, cwd, libraryDir);
  const dashboards = [];
  
  for (const item of items) {
    const files = libraryOps.getLibraryItemFiles(item.path, cwd, libraryDir);
    const dashboardFile = files.find(f => f.name === "dashboard.json" || f.name.endsWith(".json"));
    
    if (dashboardFile) {
      try {
        const content = fs.readFileSync(dashboardFile.path, "utf8");
        const dashboard = JSON.parse(content);
        const metadata = libraryOps.readLibraryMetadata(item.path, cwd, libraryDir);
        
        dashboards.push({
          id: item.name,
          name: dashboard.name || item.name,
          description: dashboard.description || metadata?.description || "",
          path: item.path,
          category: item.subcategory || "other",
          metadata: metadata || {},
          dashboard: dashboard
        });
      } catch (e) {
        // Skip invalid dashboards
        console.warn(`Failed to load dashboard ${item.name}:`, e.message);
      }
    }
  }
  
  return dashboards;
}

/**
 * Validate dashboard definition
 * @param {object} dashboard - Dashboard definition
 * @returns {object} - Validation result
 */
function validateDashboard(dashboard) {
  const errors = [];
  
  if (!dashboard.name) {
    errors.push("Dashboard must have a 'name' field");
  }
  
  if (!dashboard.widgets || !Array.isArray(dashboard.widgets)) {
    errors.push("Dashboard must have a 'widgets' array");
  } else {
    dashboard.widgets.forEach((widget, index) => {
      if (!widget.type) {
        errors.push(`Widget ${index} must have a 'type' field`);
      }
      if (!widget.id) {
        errors.push(`Widget ${index} must have an 'id' field`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  loadDashboard,
  listDashboards,
  validateDashboard
};

