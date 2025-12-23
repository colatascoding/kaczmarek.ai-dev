/**
 * Claude module - run prompts against Anthropic Claude
 *
 * This module is intentionally minimal and only depends on Node's built-in
 * https module so it works in your current environment without extra installs.
 *
 * Configure via:
 *   - Environment variable: CLAUDE_API_KEY
 *   - Or per-call input: apiKey
 */

const https = require("https");

async function callClaude({ apiKey, model, systemPrompt, prompt, maxTokens, temperature }) {
  const body = JSON.stringify({
    model: model || "claude-3-5-sonnet-latest",
    max_tokens: maxTokens || 2048,
    temperature: typeof temperature === "number" ? temperature : 0.2,
    system: systemPrompt || "You are an AI software engineer helping with a local-first dev assistant.",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const options = {
    method: "POST",
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Length": Buffer.byteLength(body)
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
          const json = JSON.parse(data);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return resolve({
              success: false,
              statusCode: res.statusCode,
              error: json.error || json
            });
          }

          const text =
            Array.isArray(json.content) && json.content.length > 0 && json.content[0].type === "text"
              ? json.content[0].text
              : "";

          resolve({
            success: true,
            model: json.model,
            output: text,
            raw: json,
            usage: json.usage || null
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  name: "claude",
  version: "1.0.0",
  description: "Run prompts against Anthropic Claude",
  actions: {
    /**
     * Run a single prompt with Claude
     *
     * inputs:
     *   - prompt (string, required)
     *   - apiKey (string, optional – overrides CLAUDE_API_KEY env)
     *   - model (string, optional, default claude-3-5-sonnet-latest)
     *   - systemPrompt (string, optional)
     *   - maxTokens (number, optional, default 2048)
     *   - temperature (number, optional, default 0.2)
     */
    "run-prompt": async (inputs, context) => {
      const { logger } = context;
      const {
        prompt,
        apiKey: apiKeyInput,
        model,
        systemPrompt,
        maxTokens,
        temperature
      } = inputs;

      const apiKey = apiKeyInput || process.env.CLAUDE_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          error: "CLAUDE_API_KEY not set and no apiKey provided to claude.run-prompt"
        };
      }

      if (!prompt || typeof prompt !== "string") {
        return {
          success: false,
          error: "Missing required input: prompt"
        };
      }

      logger.info(`Calling Claude model ${model || "claude-3-5-sonnet-latest"}...`);

      try {
        const result = await callClaude({
          apiKey,
          model,
          systemPrompt,
          prompt,
          maxTokens,
          temperature
        });

        if (!result.success) {
          logger.error("Claude API call failed", result.error || result);
          return {
            success: false,
            error: result.error || "Claude API call failed",
            statusCode: result.statusCode || null
          };
        }

        return {
          success: true,
          model: result.model,
          output: result.output,
          usage: result.usage
        };
      } catch (error) {
        logger.error("Error calling Claude API", error);
        return {
          success: false,
          error: error.message || String(error)
        };
      }
    }
  }
};


