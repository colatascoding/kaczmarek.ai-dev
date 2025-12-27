/**
 * Unit tests for version routes
 */

const { describe, test, expect, beforeEach, afterEach } = require("@jest/globals");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("Version Routes", () => {
  let tempDir;
  let server;
  let versionRoutes;

  beforeEach(() => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kaczmarek-test-"));
    
    // Mock server
    server = {
      cwd: tempDir,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      }
    };
    
    // Load version routes
    const createVersionRoutes = require("../../api/routes/versions");
    versionRoutes = createVersionRoutes(server);
  });

  afterEach(() => {
    // Cleanup
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("handleGetStageSummary", () => {
    test("should parse URL correctly for /api/versions/:versionTag/:stage/summary", async () => {
      const req = {
        url: "/api/versions/0-3/plan/summary"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      // Mock loadConfig
      const utils = require("../../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      // Mock versionOps
      const versionOps = require("../../versions/file-operations");
      jest.spyOn(versionOps, "findVersionFolder").mockReturnValue(path.join(tempDir, "versions", "0", "0-3"));
      jest.spyOn(versionOps, "getStagePath").mockReturnValue(path.join(tempDir, "versions", "0", "0-3", "01_plan"));

      // Mock stageOps
      const stageOps = require("../../versions/stage-management");
      jest.spyOn(stageOps, "getStageStatus").mockReturnValue("in-progress");

      // Create goals file
      const goalsPath = path.join(tempDir, "versions", "0", "0-3", "01_plan", "goals.md");
      fs.mkdirSync(path.dirname(goalsPath), { recursive: true });
      fs.writeFileSync(goalsPath, "# Goals\n\n- [ ] Goal 1\n- [x] Goal 2\n");

      await versionRoutes.handleGetStageSummary(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(res.end).toHaveBeenCalled();
      
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.versionTag).toBe("0-3");
      expect(responseData.stage).toBe("plan");
      expect(responseData.summary).toBeDefined();
      expect(responseData.summary.stage).toBe("plan");
    });

    test("should return 404 if version not found", async () => {
      const req = {
        url: "/api/versions/999-999/plan/summary"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const versionOps = require("../../versions/file-operations");
      jest.spyOn(versionOps, "findVersionFolder").mockReturnValue(null);

      await versionRoutes.handleGetStageSummary(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.error).toBe("Version not found");
    });

    test("should return 400 for invalid URL format", async () => {
      const req = {
        url: "/api/versions/invalid"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      await versionRoutes.handleGetStageSummary(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.error).toBe("Invalid URL format");
    });
  });

  describe("handleGetPlanningAgentStatus", () => {
    test("should return hasAgent: false if no agent queue directory", async () => {
      const req = {
        url: "/api/versions/0-3/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(false);
      expect(responseData.agent).toBe(null);
    });

    test("should return agent status if agent exists", async () => {
      const req = {
        url: "/api/versions/0-3/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      // Create agent queue directory and task file
      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "test-agent-id.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "test-agent-id",
        versionTag: "0-3",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-123",
        status: "running",
        startedAt: new Date().toISOString()
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent).toBeDefined();
      expect(responseData.agent.id).toBe("test-agent-id");
      expect(responseData.agent.status).toBe("running");
    });
  });
});
