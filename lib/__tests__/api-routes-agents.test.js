/**
 * Unit tests for agent API routes
 */

const { describe, test, expect, beforeEach, afterEach } = require("@jest/globals");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("Agent Routes", () => {
  let tempDir;
  let server;
  let agentRoutes;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kaczmarek-test-"));
    
    // Mock server
    server = {
      cwd: tempDir,
      db: {
        getExecution: jest.fn(),
        getWorkflow: jest.fn()
      }
    };
    
    // Load agent routes
    const createAgentRoutes = require("../api/routes/agents");
    agentRoutes = createAgentRoutes(server);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("handleListAgents", () => {
    test("should return empty array if queue directory does not exist", async () => {
      const req = { url: "/api/agents" };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      await agentRoutes.handleListAgents(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.agents).toEqual([]);
    });

    test("should list agents from queue directory", async () => {
      // Create queue directory and task file
      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "test-agent.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "test-agent",
        status: "ready",
        type: "cursor",
        tasks: ["Task 1", "Task 2"],
        startedAt: new Date().toISOString()
      }));

      const req = { url: "/api/agents" };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      await agentRoutes.handleListAgents(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.agents).toHaveLength(1);
      expect(responseData.agents[0].id).toBe("test-agent");
      expect(responseData.agents[0].status).toBe("ready");
    });
  });
});

