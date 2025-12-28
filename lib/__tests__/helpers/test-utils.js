/**
 * Common test utilities and helpers
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

/**
 * Create a temporary directory for testing
 * @returns {string} Path to temporary directory
 */
function createTempDir(prefix = "kaczmarek-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Clean up a temporary directory
 * @param {string} tempDir - Path to temporary directory
 */
function cleanupTempDir(tempDir) {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Create a mock server object for API route tests
 * @param {string} cwd - Working directory
 * @param {object} options - Additional options
 * @returns {object} Mock server object
 */
function createMockServer(cwd, options = {}) {
  return {
    cwd,
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    },
    ...options
  };
}

/**
 * Create a mock request object
 * @param {object|string} dataOrUrl - Request body data (object) or URL (string) for GET requests
 * @returns {object} Mock request object
 */
function createMockRequest(dataOrUrl) {
  if (typeof dataOrUrl === "string") {
    // GET request with URL
    return { url: dataOrUrl };
  }
  // POST request with body data
  return {
    on: jest.fn((event, callback) => {
      if (event === "data") {
        callback(Buffer.from(JSON.stringify(dataOrUrl)));
      } else if (event === "end") {
        callback();
      }
    })
  };
}

/**
 * Create a mock response object
 * @returns {object} Mock response object
 */
function createMockResponse() {
  return {
    writeHead: jest.fn(),
    end: jest.fn()
  };
}

module.exports = {
  createTempDir,
  cleanupTempDir,
  createMockServer,
  createMockRequest,
  createMockResponse
};

