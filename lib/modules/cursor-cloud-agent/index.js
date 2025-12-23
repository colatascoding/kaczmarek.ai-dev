/**
 * Cursor Cloud Agents API module
 *
 * This module integrates with Cursor's Cloud Agents API to launch and monitor
 * background agents that can implement features autonomously.
 *
 * Configure via:
 *   - Environment variable: CURSOR_API_KEY
 *   - Or per-call input: apiKey
 */

const https = require("https");

const API_BASE = "api.cursor.com";
const API_VERSION = "v0";

/**
 * Make an API request to Cursor Cloud Agents API
 */
async function callCursorAPI({ apiKey, method, path, body = null }) {
  const bodyString = body ? JSON.stringify(body) : null;

  const options = {
    method,
    hostname: API_BASE,
    path: `/${API_VERSION}${path}`,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...(bodyString && { "Content-Length": Buffer.byteLength(bodyString) })
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = "";

      res.on("data", chunk => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : {};
          if (res.statusCode < 200 || res.statusCode >= 300) {
            // Include full response in error for debugging
            return resolve({
              success: false,
              statusCode: res.statusCode,
              error: json.error || json.message || json.detail || `HTTP ${res.statusCode}`,
              data: json // Include full response for debugging
            });
          }

          resolve({
            success: true,
            statusCode: res.statusCode,
            data: json
          });
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}

/**
 * Launch a Cloud Agent
 *
 * @param {Object} params
 * @param {string} params.apiKey - Cursor API key
 * @param {string} params.prompt - Task description/prompt for the agent
 * @param {string} params.repository - Repository identifier (e.g., "owner/repo" or full URL)
 * @param {string} [params.branch] - Target branch (default: current branch or "main")
 * @param {Object} [params.options] - Additional options (mode, maxRuntime, etc.)
 */
async function launchAgent({ apiKey, prompt, repository, branch = null, options = {} }) {
  // Based on official Cursor Cloud Agents API documentation:
  // https://cursor.com/docs/cloud-agent/api/endpoints
  // The request body should have:
  // - prompt: { text: "..." }
  // - source: { repository: "https://github.com/...", ref: "branch-name" }
  
  // Convert repository to full GitHub URL if needed
  let repositoryUrl = repository;
  if (!repository.startsWith("http")) {
    repositoryUrl = `https://github.com/${repository}`;
  }

  // Determine branch - API requires a ref field
  // If no branch provided, try to detect from git or default to "main"
  let branchRef = branch;
  if (!branchRef) {
    try {
      const { execSync } = require("child_process");
      // Try to get current branch from git
      branchRef = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        cwd: process.cwd()
      }).trim();
    } catch (e) {
      // Git not available or not a git repo, default to "main"
      branchRef = "main";
    }
  }

  // Filter out unsupported options (like "mode" which is not in the API spec)
  const { mode, ...supportedOptions } = options;

  // Build request body according to API spec
  const body = {
    prompt: {
      text: prompt
    },
    source: {
      repository: repositoryUrl,
      ref: branchRef
    },
    ...supportedOptions
  };

  const result = await callCursorAPI({
    apiKey,
    method: "POST",
    path: "/agents",
    body
  });

  if (!result.success) {
    const errorDetails = result.data ? JSON.stringify(result.data, null, 2) : result.error;
    const requestBody = JSON.stringify(body, null, 2);
    throw new Error(`Cursor API error (${result.statusCode}): ${result.error}\n\nRequest body sent:\n${requestBody}\n\nAPI response:\n${errorDetails}`);
  }

  return {
    success: true,
    agentId: result.data.id || result.data.agent_id,
    status: result.data.status || "queued",
    data: result.data
  };
}

/**
 * Get agent status
 *
 * @param {Object} params
 * @param {string} params.apiKey - Cursor API key
 * @param {string} params.agentId - Agent ID from launchAgent
 */
async function getAgentStatus({ apiKey, agentId }) {
  const result = await callCursorAPI({
    apiKey,
    method: "GET",
    path: `/agents/${agentId}`
  });

  if (!result.success) {
    throw new Error(`Cursor API error (${result.statusCode}): ${result.error}`);
  }

  return {
    success: true,
    agentId: result.data.id || agentId,
    status: result.data.status,
    data: result.data
  };
}

module.exports = {
  name: "cursor-cloud-agent",
  version: "1.0.0",
  description: "Integrate with Cursor Cloud Agents API",
  actions: {
    /**
     * Launch a Cloud Agent
     *
     * inputs:
     *   - prompt (string, required) - Task description
     *   - repository (string, required) - Repository identifier
     *   - branch (string, optional) - Target branch
     *   - apiKey (string, optional) - Overrides CURSOR_API_KEY env
     *   - mode (string, optional) - Agent mode (interactive, background, etc.)
     *   - maxRuntime (number, optional) - Max runtime in seconds
     */
    "launch": async (inputs, context) => {
      const { prompt, repository, branch, apiKey, mode, maxRuntime } = inputs;
      const { logger } = context;

      const key = apiKey || process.env.CURSOR_API_KEY;
      if (!key) {
        throw new Error(
          "CURSOR_API_KEY environment variable is required. " +
          "Get your API key from https://cursor.com/dashboard"
        );
      }

      if (!prompt) {
        throw new Error("prompt is required");
      }

      if (!repository) {
        throw new Error("repository is required");
      }

      logger.info(`Launching Cursor Cloud Agent: ${prompt.substring(0, 100)}...`);

      // Build options object (excluding unsupported fields like "mode")
      const options = {};
      if (maxRuntime) options.maxRuntime = maxRuntime;
      // Note: "mode" is not supported by the API, so we don't include it

      try {
        const result = await launchAgent({
          apiKey: key,
          prompt,
          repository,
          branch,
          options
        });

        logger.info(`Cloud Agent launched: ${result.agentId} (status: ${result.status})`);

        return {
          success: true,
          agentId: result.agentId,
          status: result.status,
          data: result.data
        };
      } catch (error) {
        logger.error(`Failed to launch Cloud Agent: ${error.message}`);
        throw error;
      }
    },

    /**
     * Get agent status
     *
     * inputs:
     *   - agentId (string, required) - Agent ID
     *   - apiKey (string, optional) - Overrides CURSOR_API_KEY env
     */
    "get-status": async (inputs, context) => {
      const { agentId, apiKey } = inputs;
      const { logger } = context;

      const key = apiKey || process.env.CURSOR_API_KEY;
      if (!key) {
        throw new Error("CURSOR_API_KEY environment variable is required");
      }

      if (!agentId) {
        throw new Error("agentId is required");
      }

      try {
        const result = await getAgentStatus({
          apiKey: key,
          agentId
        });

        return {
          success: true,
          agentId: result.agentId,
          status: result.status,
          data: result.data
        };
      } catch (error) {
        logger.error(`Failed to get agent status: ${error.message}`);
        throw error;
      }
    }
  }
};

