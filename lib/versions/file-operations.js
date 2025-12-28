/**
 * Version folder file operations
 * Handles file operations for the new version folder structure
 */

const fs = require("fs");
const path = require("path");

/**
 * Find version folder path
 * @param {string} versionTag - Version tag (e.g., "0-2")
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory (default: "versions")
 * @returns {string|null} - Path to version folder or null if not found
 */
function findVersionFolder(versionTag, cwd = process.cwd(), versionsDir = "versions") {
  const match = versionTag.match(/^version?(\d+)-(\d+)$/);
  if (!match) {
    // Try without "version" prefix
    const match2 = versionTag.match(/^(\d+)-(\d+)$/);
    if (!match2) return null;
    const major = parseInt(match2[1], 10);
    const minor = parseInt(match2[2], 10);
    const versionPath = path.join(cwd, versionsDir, `v${major}`, `${major}-${minor}`);
    return fs.existsSync(versionPath) ? versionPath : null;
  }
  
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const versionPath = path.join(cwd, versionsDir, `v${major}`, `${major}-${minor}`);
  return fs.existsSync(versionPath) ? versionPath : null;
}

/**
 * Get stage folder path
 * @param {string} versionTag - Version tag
 * @param {string} stage - Stage name (e.g., "01_plan", "02_implement")
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 * @returns {string|null} - Path to stage folder or null if not found
 */
function getStagePath(versionTag, stage, cwd = process.cwd(), versionsDir = "versions") {
  const versionPath = findVersionFolder(versionTag, cwd, versionsDir);
  if (!versionPath) return null;
  
  const stagePath = path.join(versionPath, stage);
  return fs.existsSync(stagePath) ? stagePath : null;
}

/**
 * Get workstream folder path
 * @param {string} versionTag - Version tag
 * @param {string} workstreamId - Workstream ID
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 * @returns {string|null} - Path to workstream folder or null if not found
 */
function getWorkstreamPath(versionTag, workstreamId, cwd = process.cwd(), versionsDir = "versions") {
  const implementPath = getStagePath(versionTag, "02_implement", cwd, versionsDir);
  if (!implementPath) return null;
  
  const workstreamPath = path.join(implementPath, "workstreams", workstreamId);
  return fs.existsSync(workstreamPath) ? workstreamPath : null;
}

/**
 * Create version folder structure
 * @param {string} versionTag - Version tag
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 * @returns {string} - Path to created version folder
 */
function createVersionFolder(versionTag, cwd = process.cwd(), versionsDir = "versions") {
  const match = versionTag.match(/^version?(\d+)-(\d+)$/);
  let major, minor;
  
  if (match) {
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
  } else {
    // Try without "version" prefix
    const match2 = versionTag.match(/^(\d+)-(\d+)$/);
    if (!match2) {
      throw new Error(`Invalid version tag: ${versionTag}`);
    }
    major = parseInt(match2[1], 10);
    minor = parseInt(match2[2], 10);
  }
  
  const majorDir = path.join(cwd, versionsDir, `v${major}`);
  const versionPath = path.join(majorDir, `${major}-${minor}`);
  
  // Create directory structure
  const stages = ["01_plan", "02_implement", "03_test", "04_review"];
  const workstreamsPath = path.join(versionPath, "02_implement", "workstreams");
  
  fs.mkdirSync(majorDir, { recursive: true });
  fs.mkdirSync(versionPath, { recursive: true });
  
  for (const stage of stages) {
    fs.mkdirSync(path.join(versionPath, stage), { recursive: true });
  }
  
  fs.mkdirSync(workstreamsPath, { recursive: true });
  fs.mkdirSync(path.join(versionPath, "docs"), { recursive: true });
  fs.mkdirSync(path.join(versionPath, "library", "workflows"), { recursive: true });
  fs.mkdirSync(path.join(versionPath, "library", "dashboards"), { recursive: true });
  
  return versionPath;
}

/**
 * Get version metadata file path
 * @param {string} versionTag - Version tag
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 * @returns {string} - Path to version.json file
 */
function getVersionMetadataPath(versionTag, cwd = process.cwd(), versionsDir = "versions") {
  const versionPath = findVersionFolder(versionTag, cwd, versionsDir);
  if (!versionPath) return null;
  return path.join(versionPath, "version.json");
}

/**
 * Read version metadata
 * @param {string} versionTag - Version tag
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 * @returns {object|null} - Version metadata or null if not found
 */
function readVersionMetadata(versionTag, cwd = process.cwd(), versionsDir = "versions") {
  const metadataPath = getVersionMetadataPath(versionTag, cwd, versionsDir);
  if (!metadataPath || !fs.existsSync(metadataPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(metadataPath, "utf8");
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * Write version metadata
 * @param {string} versionTag - Version tag
 * @param {object} metadata - Version metadata
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 */
function writeVersionMetadata(versionTag, metadata, cwd = process.cwd(), versionsDir = "versions") {
  const versionPath = findVersionFolder(versionTag, cwd, versionsDir);
  if (!versionPath) {
    throw new Error(`Version folder not found: ${versionTag}`);
  }
  
  const metadataPath = path.join(versionPath, "version.json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
}

module.exports = {
  findVersionFolder,
  getStagePath,
  getWorkstreamPath,
  createVersionFolder,
  getVersionMetadataPath,
  readVersionMetadata,
  writeVersionMetadata
};


