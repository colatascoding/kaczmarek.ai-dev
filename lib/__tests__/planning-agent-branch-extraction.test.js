/**
 * Unit tests for planning agent branch extraction
 * Tests the logic for extracting branch names from various sources
 */

const { describe, test, expect, beforeEach, afterEach } = require("@jest/globals");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("Planning Agent Branch Extraction", () => {
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
    const createVersionRoutes = require("../api/routes/versions");
    versionRoutes = createVersionRoutes(server);
  });

  afterEach(() => {
    // Cleanup
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Branch extraction from cloudStatus", () => {
    test("should extract branch from cloudStatus.target.branchName (primary source)", async () => {
      const req = {
        url: "/api/versions/0-13/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "agent-0-13.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "agent-0-13",
        versionTag: "0-13",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-0-13",
        status: "FINISHED",
        startedAt: new Date().toISOString(),
        autoMerge: true,
        cloudStatus: {
          id: "cloud-agent-0-13",
          status: "FINISHED",
          source: {
            repository: "github.com/test/repo",
            ref: "main"
          },
          target: {
            branchName: "cursor/version-0-13-plan-318e",
            url: "https://cursor.com/agents?id=cloud-agent-0-13"
          }
        }
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.agentBranch).toBe("cursor/version-0-13-plan-318e");
    });

    test("should extract branch from cloudStatus.branchName (fallback)", async () => {
      const req = {
        url: "/api/versions/0-14/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "agent-0-14.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "agent-0-14",
        versionTag: "0-14",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-0-14",
        status: "completed",
        startedAt: new Date().toISOString(),
        cloudStatus: {
          branchName: "cursor/version-0-14-plan-abc",
          // No target.branchName
        }
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.agentBranch).toBe("cursor/version-0-14-plan-abc");
    });

    test("should ignore agentBranch if it equals source.ref", async () => {
      const req = {
        url: "/api/versions/0-15/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "agent-0-15.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "agent-0-15",
        versionTag: "0-15",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-0-15",
        status: "completed",
        startedAt: new Date().toISOString(),
        agentBranch: "main", // Incorrectly set to source branch
        cloudStatus: {
          source: {
            ref: "main"
          },
          target: {
            branchName: "cursor/version-0-15-plan-xyz" // Correct branch
          }
        }
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      // Should use target.branchName, not the incorrect agentBranch
      expect(responseData.agent.agentBranch).toBe("cursor/version-0-15-plan-xyz");
      expect(responseData.agent.agentBranch).not.toBe("main");
    });

    test("should use agentBranch if it doesn't equal source.ref", async () => {
      const req = {
        url: "/api/versions/0-16/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "agent-0-16.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "agent-0-16",
        versionTag: "0-16",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-0-16",
        status: "completed",
        startedAt: new Date().toISOString(),
        agentBranch: "cursor/version-0-16-plan-123", // Valid branch, different from source
        cloudStatus: {
          source: {
            ref: "main"
          }
          // No target.branchName
        }
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.agentBranch).toBe("cursor/version-0-16-plan-123");
    });

    test("should return null if no branch information available", async () => {
      const req = {
        url: "/api/versions/0-17/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "agent-0-17.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "agent-0-17",
        versionTag: "0-17",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-0-17",
        status: "running",
        startedAt: new Date().toISOString()
        // No branch information at all
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.agentBranch).toBeNull();
    });
  });

  describe("Status normalization", () => {
    test("should normalize FINISHED to completed", async () => {
      const req = {
        url: "/api/versions/0-18/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "agent-0-18.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "agent-0-18",
        versionTag: "0-18",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-0-18",
        status: "FINISHED", // Uppercase
        startedAt: new Date().toISOString(),
        cloudStatus: {
          target: {
            branchName: "cursor/version-0-18-plan"
          }
        }
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.status).toBe("completed"); // Should be normalized
    });
  });

  describe("Auto-merge flag", () => {
    test("should include autoMerge flag when true", async () => {
      const req = {
        url: "/api/versions/0-19/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "agent-0-19.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "agent-0-19",
        versionTag: "0-19",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-0-19",
        status: "completed",
        startedAt: new Date().toISOString(),
        autoMerge: true,
        mergeStrategy: "squash",
        cloudStatus: {
          target: {
            branchName: "cursor/version-0-19-plan"
          }
        }
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.autoMerge).toBe(true);
      expect(responseData.agent.mergeStrategy).toBe("squash");
      expect(responseData.agent.agentBranch).toBe("cursor/version-0-19-plan");
    });

    test("should include autoMerge as false when not set", async () => {
      const req = {
        url: "/api/versions/0-20/planning-agent-status"
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "agent-0-20.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "agent-0-20",
        versionTag: "0-20",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-0-20",
        status: "completed",
        startedAt: new Date().toISOString()
        // autoMerge not set
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.autoMerge).toBe(false);
    });
  });
});

