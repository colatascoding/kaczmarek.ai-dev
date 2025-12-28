/**
 * Unit tests for Claude module behavior
 */

const path = require("path");
const { EventEmitter } = require("events");

// Mock https so we don't do real network calls
jest.mock("https", () => {
  return {
    request: jest.fn()
  };
});

const https = require("https");

describe("Claude module", () => {
  let claudeModule;

  beforeEach(() => {
    // Ensure API key is set so the module doesn't early-return
    process.env.CLAUDE_API_KEY = "test-key";
    delete require.cache[require.resolve("../modules/claude/index.js")];
    claudeModule = require("../modules/claude/index.js");
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("throws an error when Claude API returns non-2xx (e.g. model not found)", async () => {
    // Arrange: mock https.request to simulate a 404 response from Claude
    https.request.mockImplementation((options, callback) => {
      const res = new EventEmitter();
      res.statusCode = 404;

      process.nextTick(() => {
        callback(res);
        const body = JSON.stringify({
          error: {
            type: "not_found_error",
            message: "model: claude-3-5-sonnet-latest"
          }
        });
        res.emit("data", Buffer.from(body));
        res.emit("end");
      });

      const req = new EventEmitter();
      req.write = jest.fn();
      req.end = jest.fn();
      return req;
    });

    const runPrompt = claudeModule.actions["run-prompt"];

    const inputs = {
      prompt: "Test prompt",
      // No model specified so default is used
      maxTokens: 128,
      temperature: 0.1
    };

    const logs = [];
    const context = {
      logger: {
        info: (msg) => logs.push({ level: "info", msg }),
        error: (msg) => logs.push({ level: "error", msg }),
        warn: (msg) => logs.push({ level: "warn", msg })
      }
    };

    // Act + Assert: the action should reject with a descriptive error
    await expect(runPrompt(inputs, context)).rejects.toThrow(
      /Claude API error \(404\): model: claude-3-5-sonnet-latest/
    );
  });
});



