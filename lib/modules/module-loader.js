/**
 * Module loader for workflow modules
 */

const path = require("path");
const fs = require("fs");

class ModuleLoader {
  constructor(modulesDir = null) {
    // Resolve to absolute path
    this.modulesDir = modulesDir 
      ? path.resolve(modulesDir)
      : path.resolve(__dirname, "..", "modules");
    this.modules = new Map();
    this.loadModules();
  }

  /**
   * Load all modules from modules directory
   */
  loadModules() {
    if (!fs.existsSync(this.modulesDir)) {
      return;
    }

    const entries = fs.readdirSync(this.modulesDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        this.loadModule(entry.name);
      }
    }
  }

  /**
   * Load a single module
   */
  loadModule(moduleName) {
    const modulePath = path.join(this.modulesDir, moduleName);
    const indexPath = path.join(modulePath, "index.js");
    
    // Resolve to absolute path for require()
    const absoluteIndexPath = path.resolve(indexPath);
    
    if (!fs.existsSync(absoluteIndexPath)) {
      console.warn(`Module ${moduleName} not found at ${absoluteIndexPath}`);
      return null;
    }

    try {
      // Clear require cache to allow reloading
      delete require.cache[absoluteIndexPath];
      const module = require(absoluteIndexPath);
      
      if (!module.name || !module.actions) {
        console.warn(`Module ${moduleName} is missing name or actions`);
        return null;
      }

      this.modules.set(module.name, module);
      return module;
    } catch (error) {
      console.error(`Failed to load module ${moduleName} from ${absoluteIndexPath}:`, error.message);
      console.error(error.stack);
      return null;
    }
  }

  /**
   * Get a module by name
   */
  getModule(moduleName) {
    return this.modules.get(moduleName);
  }

  /**
   * Get an action from a module
   */
  getAction(moduleName, actionName) {
    const module = this.getModule(moduleName);
    if (!module) {
      throw new Error(`Module not found: ${moduleName}`);
    }

    const action = module.actions[actionName];
    if (!action) {
      throw new Error(`Action ${actionName} not found in module ${moduleName}`);
    }

    return action;
  }

  /**
   * List all loaded modules
   */
  listModules() {
    return Array.from(this.modules.values()).map(m => ({
      name: m.name,
      version: m.version || "1.0.0",
      description: m.description || "",
      actions: Object.keys(m.actions || {})
    }));
  }

  /**
   * Check if a module has an action
   */
  hasAction(moduleName, actionName) {
    try {
      this.getAction(moduleName, actionName);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = ModuleLoader;

