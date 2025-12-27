/**
 * Workflow discovery and loading
 * Handles discovery of workflows from library, active, and version-specific locations
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../../bin/utils");
const libraryOps = require("./file-operations");
const versionOps = require("../versions/file-operations");

/**
 * Discover workflows from all configured locations
 * @param {string} cwd - Current working directory
 * @param {object} options - Discovery options
 * @returns {Array} - Array of workflow objects with source information
 */
function discoverWorkflows(cwd = process.cwd(), options = {}) {
  const config = loadConfig(cwd);
  const workflows = [];
  
  // Discovery order: active, version-specific, library
  const discoveryOrder = config?.workflows?.discoveryOrder || ["active", "version-specific", "library"];
  
  for (const source of discoveryOrder) {
    switch (source) {
      case "active":
        workflows.push(...discoverActiveWorkflows(cwd, config));
        break;
      case "version-specific":
        workflows.push(...discoverVersionSpecificWorkflows(cwd, config, options.versionTag));
        break;
      case "library":
        workflows.push(...discoverLibraryWorkflows(cwd, config));
        break;
    }
  }

  return workflows;
}

/**
 * Discover workflows from active workflows directory
 * @param {string} cwd - Current working directory
 * @param {object} config - Project config
 * @returns {Array} - Array of workflow objects
 */
function discoverActiveWorkflows(cwd, config) {
  const workflows = [];
  const workflowsDir = config?.workflows?.activeDir || "workflows";
  const workflowsPath = path.join(cwd, workflowsDir);
  
  if (!fs.existsSync(workflowsPath)) {
    return workflows;
  }

  const files = fs.readdirSync(workflowsPath);
  for (const file of files) {
    if (file.endsWith(".yaml") || file.endsWith(".yml")) {
      const filePath = path.join(workflowsPath, file);
      try {
        const workflow = loadWorkflowFromFile(filePath);
        if (workflow) {
          workflows.push({
            ...workflow,
            id: workflow.id || path.basename(file, path.extname(file)),
            source: "active",
            sourcePath: filePath,
            file: file
          });
        }
      } catch (e) {
        // Skip invalid workflow files
        console.warn(`Failed to load workflow from ${filePath}:`, e.message);
      }
    }
  }

  return workflows;
}

/**
 * Discover workflows from version-specific library
 * @param {string} cwd - Current working directory
 * @param {object} config - Project config
 * @param {string} versionTag - Optional version tag to filter
 * @returns {Array} - Array of workflow objects
 */
function discoverVersionSpecificWorkflows(cwd, config, versionTag = null) {
  const workflows = [];
  const versionsDir = config?.docs?.versionsDir || "versions";
  const versionsPath = path.join(cwd, versionsDir);
  
  if (!fs.existsSync(versionsPath)) {
    return workflows;
  }

  // Find all version directories
  const majorDirs = fs.readdirSync(versionsPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith("v"));

  for (const majorDir of majorDirs) {
    const versionDirs = fs.readdirSync(path.join(versionsPath, majorDir.name), { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.match(/^\d+-\d+$/));

    for (const versionDir of versionDirs) {
      const versionTagFromPath = versionDir.name;
      
      // Filter by version tag if provided
      if (versionTag && versionTagFromPath !== versionTag.replace(/^version/, "")) {
        continue;
      }

      const libraryPath = path.join(versionsPath, majorDir.name, versionDir.name, "library", "workflows");
      if (fs.existsSync(libraryPath)) {
        const items = libraryOps.listLibraryItems("workflows", null, cwd, versionsDir);
        for (const item of items) {
          // Check if item is in this version's library
          const itemPath = path.join(versionsPath, majorDir.name, versionDir.name, "library", item.path);
          if (fs.existsSync(itemPath)) {
            const workflowFiles = libraryOps.getLibraryItemFiles(item.path, cwd, versionsDir);
            for (const file of workflowFiles) {
              if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
                try {
                  const workflow = loadWorkflowFromFile(file.path);
                  if (workflow) {
                    workflows.push({
                      ...workflow,
                      id: workflow.id || item.name,
                      source: "version-specific",
                      sourcePath: file.path,
                      versionTag: versionTagFromPath,
                      libraryItem: item.path
                    });
                  }
                } catch (e) {
                  // Skip invalid workflow files
                  console.warn(`Failed to load workflow from ${file.path}:`, e.message);
                }
              }
            }
          }
        }
      }
    }
  }

  return workflows;
}

/**
 * Discover workflows from global library
 * @param {string} cwd - Current working directory
 * @param {object} config - Project config
 * @returns {Array} - Array of workflow objects
 */
function discoverLibraryWorkflows(cwd, config) {
  const workflows = [];
  const libraryDir = config?.library?.libraryDir || "library";
  const workflowsPath = path.join(cwd, libraryDir, "workflows");
  
  if (!fs.existsSync(workflowsPath)) {
    return workflows;
  }
  
  // First, discover workflows in subdirectories (structured items)
  const libraryItems = libraryOps.listLibraryItems("workflows", null, cwd, libraryDir);
  
  for (const item of libraryItems) {
    const files = libraryOps.getLibraryItemFiles(item.path, cwd, libraryDir);
    for (const file of files) {
      if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
        try {
          const workflow = loadWorkflowFromFile(file.path);
          if (workflow) {
            workflows.push({
              ...workflow,
              id: workflow.id || item.name,
              source: "library",
              sourcePath: file.path,
              libraryItem: item.path,
              metadata: item.metadata,
              category: item.subcategory
            });
          }
        } catch (e) {
          // Skip invalid workflow files
          console.warn(`Failed to load workflow from ${file.path}:`, e.message);
        }
      }
    }
  }
  
  // Also discover workflows directly in subcategory directories (flat structure)
  const subcategories = fs.readdirSync(workflowsPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory());
  
  for (const subcat of subcategories) {
    const subcategoryPath = path.join(workflowsPath, subcat.name);
    const entries = fs.readdirSync(subcategoryPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip directories (already handled above)
      if (entry.isDirectory()) continue;
      
      // Check for YAML files directly in subcategory
      if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
        const filePath = path.join(subcategoryPath, entry.name);
        try {
          const workflow = loadWorkflowFromFile(filePath);
          if (workflow) {
            // Check if we already have this workflow (from structured discovery)
            const existing = workflows.find(w => 
              w.sourcePath === filePath || 
              (w.id === (workflow.id || path.basename(entry.name, path.extname(entry.name))) && w.source === "library")
            );
            
            if (!existing) {
              const workflowId = workflow.id || path.basename(entry.name, path.extname(entry.name));
              workflows.push({
                ...workflow,
                id: workflowId,
                source: "library",
                sourcePath: filePath,
                libraryItem: `workflows/${subcat.name}/${entry.name}`,
                category: subcat.name
              });
            }
          }
        } catch (e) {
          // Skip invalid workflow files
          console.warn(`Failed to load workflow from ${filePath}:`, e.message);
        }
      }
    }
  }

  return workflows;
}

/**
 * Load workflow from YAML file
 * @param {string} filePath - Path to workflow YAML file
 * @returns {object|null} - Workflow object or null
 */
function loadWorkflowFromFile(filePath) {
  try {
    const WorkflowYAMLParser = require("../workflow/yaml-parser");
    return WorkflowYAMLParser.loadFromFile(filePath);
  } catch (e) {
    return null;
  }
}

/**
 * Get workflow by ID from all sources
 * @param {string} workflowId - Workflow ID
 * @param {string} cwd - Current working directory
 * @param {object} options - Options (versionTag, preferSource)
 * @returns {object|null} - Workflow object or null
 */
function getWorkflowById(workflowId, cwd = process.cwd(), options = {}) {
  const workflows = discoverWorkflows(cwd, options);
  
  // Filter by ID
  let matches = workflows.filter(w => w.id === workflowId || w.name === workflowId);
  
  // Filter by version tag if provided
  if (options.versionTag) {
    matches = matches.filter(w => !w.versionTag || w.versionTag === options.versionTag.replace(/^version/, ""));
  }
  
  // Prefer specific source if provided
  if (options.preferSource) {
    const preferred = matches.find(w => w.source === options.preferSource);
    if (preferred) return preferred;
  }
  
  // Return first match (prefer active, then version-specific, then library)
  const sourcePriority = { active: 0, "version-specific": 1, library: 2 };
  matches.sort((a, b) => {
    const aPriority = sourcePriority[a.source] || 99;
    const bPriority = sourcePriority[b.source] || 99;
    return aPriority - bPriority;
  });
  
  return matches.length > 0 ? matches[0] : null;
}

module.exports = {
  discoverWorkflows,
  discoverActiveWorkflows,
  discoverVersionSpecificWorkflows,
  discoverLibraryWorkflows,
  getWorkflowById,
  loadWorkflowFromFile
};

