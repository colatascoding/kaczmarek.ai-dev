/**
 * API Server utilities
 */

const path = require("path");
const fs = require("fs");

/**
 * Minimal .env loader (dependency-free)
 * 
 * Loads KEY=VALUE pairs from a .env file in the given cwd into process.env,
 * without overwriting variables that are already set.
 */
function loadEnvFile(cwd) {
  try {
    const envPath = path.join(cwd, ".env");
    if (!fs.existsSync(envPath)) {
      return;
    }

    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) {
        continue;
      }

      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();

      // Strip surrounding quotes
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.warn("[API Server] Failed to load .env file:", e.message);
  }
}

/**
 * Validate that required API keys are present
 * @param {string} cwd - Current working directory
 * @param {boolean} skipValidation - If true, skip validation (for tests)
 */
function validateApiKeys(cwd, skipValidation = false) {
  // Skip validation if explicitly requested (for tests) or if NODE_ENV is test
  if (skipValidation || process.env.NODE_ENV === "test") {
    return;
  }
  
  const missingKeys = [];
  
  if (!process.env.CURSOR_API_KEY) {
    missingKeys.push("CURSOR_API_KEY");
  }
  
  if (!process.env.CLAUDE_API_KEY) {
    missingKeys.push("CLAUDE_API_KEY");
  }
  
  if (missingKeys.length > 0) {
    const envPath = path.join(cwd, ".env");
    const errorMessage = `
❌ Missing required API keys:

  Missing: ${missingKeys.join(", ")}

Please add these to your .env file:
  ${envPath}

Get your API keys from:
  - CURSOR_API_KEY: https://cursor.com/dashboard
  - CLAUDE_API_KEY: https://console.anthropic.com/

Example .env file:
  CURSOR_API_KEY=your_cursor_key_here
  CLAUDE_API_KEY=your_claude_key_here
  CLAUDE_MODEL=claude-3-5-sonnet-20241022
`;
    console.error(errorMessage);
    throw new Error("Missing required API keys for server startup.");
  }
  console.log("✅ API keys validated successfully.");
}

module.exports = {
  loadEnvFile,
  validateApiKeys
};

