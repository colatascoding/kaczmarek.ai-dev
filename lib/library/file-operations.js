/**
 * Library file operations
 * Handles file operations for the workflow library system
 */

const fs = require("fs");
const path = require("path");

/**
 * Find library item by path
 * @param {string} itemPath - Library item path (e.g., "workflows/implementation/execute-features")
 * @param {string} cwd - Current working directory
 * @param {string} libraryDir - Library directory (default: "library")
 * @returns {string|null} - Path to library item or null if not found
 */
function findLibraryItem(itemPath, cwd = process.cwd(), libraryDir = "library") {
  const fullPath = path.join(cwd, libraryDir, itemPath);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/**
 * Get library metadata file path
 * @param {string} itemPath - Library item path
 * @param {string} cwd - Current working directory
 * @param {string} libraryDir - Library directory
 * @returns {string|null} - Path to metadata.json file
 */
function getLibraryMetadataPath(itemPath, cwd = process.cwd(), libraryDir = "library") {
  const itemFullPath = findLibraryItem(itemPath, cwd, libraryDir);
  if (!itemFullPath) return null;
  
  const metadataPath = path.join(itemFullPath, "metadata.json");
  return fs.existsSync(metadataPath) ? metadataPath : null;
}

/**
 * Read library item metadata
 * @param {string} itemPath - Library item path
 * @param {string} cwd - Current working directory
 * @param {string} libraryDir - Library directory
 * @returns {object|null} - Metadata object or null if not found
 */
function readLibraryMetadata(itemPath, cwd = process.cwd(), libraryDir = "library") {
  const metadataPath = getLibraryMetadataPath(itemPath, cwd, libraryDir);
  if (!metadataPath) return null;
  
  try {
    const content = fs.readFileSync(metadataPath, "utf8");
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * Write library item metadata
 * @param {string} itemPath - Library item path
 * @param {object} metadata - Metadata object
 * @param {string} cwd - Current working directory
 * @param {string} libraryDir - Library directory
 */
function writeLibraryMetadata(itemPath, metadata, cwd = process.cwd(), libraryDir = "library") {
  const itemFullPath = findLibraryItem(itemPath, cwd, libraryDir);
  if (!itemFullPath) {
    throw new Error(`Library item not found: ${itemPath}`);
  }
  
  const metadataPath = path.join(itemFullPath, "metadata.json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
}

/**
 * List library items by category
 * @param {string} category - Category (e.g., "workflows", "dashboards", "templates")
 * @param {string} subcategory - Optional subcategory (e.g., "implementation", "review")
 * @param {string} cwd - Current working directory
 * @param {string} libraryDir - Library directory
 * @returns {Array} - Array of library item objects
 */
function listLibraryItems(category, subcategory = null, cwd = process.cwd(), libraryDir = "library") {
  const categoryPath = path.join(cwd, libraryDir, category);
  if (!fs.existsSync(categoryPath)) {
    return [];
  }

  const items = [];
  
  if (subcategory) {
    // List items in specific subcategory
    const subcategoryPath = path.join(categoryPath, subcategory);
    if (!fs.existsSync(subcategoryPath)) {
      return [];
    }
    
    const entries = fs.readdirSync(subcategoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const itemPath = `${category}/${subcategory}/${entry.name}`;
        const metadata = readLibraryMetadata(itemPath, cwd, libraryDir);
        items.push({
          path: itemPath,
          name: entry.name,
          category,
          subcategory,
          metadata: metadata || {}
        });
      }
    }
  } else {
    // List all subcategories and their items
    const subcategories = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory());
    
    for (const subcat of subcategories) {
      const subcategoryPath = path.join(categoryPath, subcat.name);
      const entries = fs.readdirSync(subcategoryPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const itemPath = `${category}/${subcat.name}/${entry.name}`;
          const metadata = readLibraryMetadata(itemPath, cwd, libraryDir);
          items.push({
            path: itemPath,
            name: entry.name,
            category,
            subcategory: subcat.name,
            metadata: metadata || {}
          });
        }
      }
    }
  }

  return items;
}

/**
 * Get library item files
 * @param {string} itemPath - Library item path
 * @param {string} cwd - Current working directory
 * @param {string} libraryDir - Library directory
 * @returns {Array} - Array of file objects
 */
function getLibraryItemFiles(itemPath, cwd = process.cwd(), libraryDir = "library") {
  const itemFullPath = findLibraryItem(itemPath, cwd, libraryDir);
  if (!itemFullPath) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(itemFullPath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isFile()) {
      files.push({
        name: entry.name,
        path: path.join(itemFullPath, entry.name),
        size: fs.statSync(path.join(itemFullPath, entry.name)).size
      });
    }
  }

  return files;
}

/**
 * Copy library item to active location
 * @param {string} itemPath - Library item path
 * @param {string} targetPath - Target path (relative to cwd)
 * @param {string} cwd - Current working directory
 * @param {string} libraryDir - Library directory
 * @returns {string|null} - Path to copied item or null on error
 */
function copyLibraryItem(itemPath, targetPath, cwd = process.cwd(), libraryDir = "library") {
  const sourcePath = findLibraryItem(itemPath, cwd, libraryDir);
  if (!sourcePath) {
    throw new Error(`Library item not found: ${itemPath}`);
  }

  const targetFullPath = path.join(cwd, targetPath);
  const targetDir = path.dirname(targetFullPath);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy directory recursively
  copyDirectoryRecursive(sourcePath, targetFullPath);

  return targetFullPath;
}

/**
 * Copy directory recursively
 * @param {string} source - Source directory
 * @param {string} target - Target directory
 */
function copyDirectoryRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * Create library item structure
 * @param {string} itemPath - Library item path
 * @param {object} metadata - Initial metadata
 * @param {string} cwd - Current working directory
 * @param {string} libraryDir - Library directory
 * @returns {string} - Path to created item
 */
function createLibraryItem(itemPath, metadata, cwd = process.cwd(), libraryDir = "library") {
  const fullPath = path.join(cwd, libraryDir, itemPath);
  
  if (fs.existsSync(fullPath)) {
    throw new Error(`Library item already exists: ${itemPath}`);
  }

  fs.mkdirSync(fullPath, { recursive: true });
  
  // Write metadata
  const metadataPath = path.join(fullPath, "metadata.json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

  return fullPath;
}

module.exports = {
  findLibraryItem,
  getLibraryMetadataPath,
  readLibraryMetadata,
  writeLibraryMetadata,
  listLibraryItems,
  getLibraryItemFiles,
  copyLibraryItem,
  createLibraryItem
};

