/**
 * Formatting utilities for common operations
 */

/**
 * Format date to ISO date string (YYYY-MM-DD)
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string
 */
function formatISODate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

/**
 * Format date to ISO string
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} ISO string
 */
function formatISOString(date) {
  if (!date) return new Date().toISOString();
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * Truncate string to specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength = 200) {
  if (!str || typeof str !== "string") return "";
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

/**
 * Shorten ID to first N characters
 * @param {string} id - ID to shorten
 * @param {number} length - Length to shorten to (default: 8)
 * @returns {string} Shortened ID
 */
function shortenId(id, length = 8) {
  if (!id || typeof id !== "string") return "";
  return id.substring(0, length);
}

/**
 * Parse version tag into major and minor components
 * @param {string} versionTag - Version tag (e.g., "0-14")
 * @returns {{major: number, minor: number}|null} Parsed version or null if invalid
 */
function parseVersionTag(versionTag) {
  if (!versionTag || typeof versionTag !== "string") return null;
  const parts = versionTag.split("-");
  if (parts.length !== 2) return null;
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  if (isNaN(major) || isNaN(minor)) return null;
  return { major, minor };
}

/**
 * Extract version tag from URL path
 * @param {string[]} urlParts - Array of URL path parts
 * @param {string} searchTerm - Term to search for (e.g., "versions")
 * @returns {string|null} Version tag or null if not found
 */
function extractVersionTagFromUrl(urlParts, searchTerm = "versions") {
  if (!Array.isArray(urlParts) || urlParts.length === 0) return null;
  const index = urlParts.indexOf(searchTerm);
  if (index === -1 || index + 1 >= urlParts.length) return null;
  const versionTag = urlParts[index + 1];
  // Validate format
  if (!/^\d+-\d+$/.test(versionTag)) return null;
  return versionTag;
}

module.exports = {
  formatISODate,
  formatISOString,
  truncateString,
  shortenId,
  parseVersionTag,
  extractVersionTagFromUrl
};

