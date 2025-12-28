/**
 * Path utilities for security and validation
 */

const path = require("path");
const { PathTraversalError } = require("./errors");

/**
 * Sanitize a file path to prevent directory traversal
 * @param {string} filePath - The path to sanitize
 * @param {string} baseDir - The base directory to restrict to
 * @returns {string} - The sanitized absolute path
 * @throws {PathTraversalError} - If path traversal is detected
 */
function sanitizePath(filePath, baseDir) {
  if (!filePath) {
    throw new PathTraversalError("Empty path", baseDir);
  }

  // Normalize the path (resolve .. and .)
  const normalized = path.normalize(filePath);
  
  // Resolve to absolute path
  const baseDirResolved = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDirResolved, normalized);

  // Check if resolved path is within base directory
  if (!resolvedPath.startsWith(baseDirResolved + path.sep) && 
      resolvedPath !== baseDirResolved) {
    throw new PathTraversalError(filePath, baseDir);
  }

  return resolvedPath;
}

/**
 * Check if a path is safe (within base directory)
 * @param {string} filePath - The path to check
 * @param {string} baseDir - The base directory
 * @returns {boolean} - True if path is safe
 */
function isPathSafe(filePath, baseDir) {
  try {
    sanitizePath(filePath, baseDir);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get relative path from base directory
 * @param {string} filePath - The file path
 * @param {string} baseDir - The base directory
 * @returns {string} - Relative path
 */
function getRelativePath(filePath, baseDir) {
  const sanitized = sanitizePath(filePath, baseDir);
  return path.relative(baseDir, sanitized);
}

/**
 * Join paths safely within a base directory
 * @param {string} baseDir - The base directory
 * @param {...string} segments - Path segments to join
 * @returns {string} - The joined and sanitized path
 */
function safeJoin(baseDir, ...segments) {
  const joined = path.join(...segments);
  return sanitizePath(joined, baseDir);
}

module.exports = {
  sanitizePath,
  isPathSafe,
  getRelativePath,
  safeJoin
};

