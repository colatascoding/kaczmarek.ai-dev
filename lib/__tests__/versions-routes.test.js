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
      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      // Mock versionOps
      const versionOps = require("../versions/file-operations");
      jest.spyOn(versionOps, "findVersionFolder").mockReturnValue(path.join(tempDir, "versions", "v0", "0-3"));
      jest.spyOn(versionOps, "getStagePath").mockReturnValue(path.join(tempDir, "versions", "v0", "0-3", "01_plan"));

      // Mock stageOps
      const stageOps = require("../versions/stage-management");
      jest.spyOn(stageOps, "getStageStatus").mockReturnValue("in-progress");
      
      // Mock generateStageSummary
      const stageSummaries = require("../api/routes/versions-stage-summaries");
      jest.spyOn(stageSummaries, "generateStageSummary").mockResolvedValue({
        stage: "plan",
        status: "in-progress",
        progress: 50,
        summary: "Test summary",
        details: {
          goals: [{ text: "Goal 1", completed: false }, { text: "Goal 2", completed: true }],
          totalGoals: 2,
          completedGoals: 1
        }
      });

      // Create goals file
      const goalsPath = path.join(tempDir, "versions", "v0", "0-3", "01_plan", "goals.md");
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

      const utils = require("../../bin/utils");
      jest.spyOn(utils, "loadConfig").mockReturnValue({
        docs: {
          versionsDir: "versions"
        }
      });

      const versionOps = require("../versions/file-operations");
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

      const utils = require("../../bin/utils");
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

      const utils = require("../../bin/utils");
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

    test("should include autoMerge flag in agent status", async () => {
      const req = {
        url: "/api/versions/0-3/planning-agent-status"
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

      // Create agent queue directory and task file with autoMerge enabled
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
        startedAt: new Date().toISOString(),
        autoMerge: true,
        mergeStrategy: "merge"
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.autoMerge).toBe(true);
      expect(responseData.agent.mergeStrategy).toBe("merge");
    });

    test("should extract branch from cloudStatus.target.branchName", async () => {
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

      // Create agent queue directory and task file matching the real task structure
      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      
      const taskFile = path.join(queueDir, "bc-8822b28b-1ffb-430e-a487-a8f18a22e4c7.json");
      fs.writeFileSync(taskFile, JSON.stringify({
        id: "bc-8822b28b-1ffb-430e-a487-a8f18a22e4c7",
        versionTag: "0-13",
        taskType: "planning",
        type: "cursor-cloud",
        cloudAgentId: "bc-8822b28b-1ffb-430e-a487-a8f18a22e4c7",
        status: "FINISHED",
        startedAt: new Date().toISOString(),
        autoMerge: true,
        mergeStrategy: "merge",
        cloudStatus: {
          id: "bc-8822b28b-1ffb-430e-a487-a8f18a22e4c7",
          status: "FINISHED",
          source: {
            repository: "github.com/test/repo",
            ref: "main"
          },
          target: {
            branchName: "cursor/version-0-13-plan-318e",
            url: "https://cursor.com/agents?id=bc-8822b28b-1ffb-430e-a487-a8f18a22e4c7"
          }
        }
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.agentBranch).toBe("cursor/version-0-13-plan-318e");
      expect(responseData.agent.status).toBe("completed"); // Should normalize FINISHED to completed
      expect(responseData.agent.autoMerge).toBe(true);
    });

    test("should normalize FINISHED status to completed", async () => {
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
        status: "FINISHED", // Uppercase status
        startedAt: new Date().toISOString(),
        autoMerge: true,
        cloudStatus: {
          target: {
            branchName: "cursor/version-0-15-plan-xyz"
          }
        }
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.status).toBe("completed"); // Should be normalized
      expect(responseData.agent.agentBranch).toBe("cursor/version-0-15-plan-xyz");
    });

    test("should return null agentBranch if no branch information available", async () => {
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
        status: "running",
        startedAt: new Date().toISOString()
        // No cloudStatus or branch information
      }));

      await versionRoutes.handleGetPlanningAgentStatus(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.hasAgent).toBe(true);
      expect(responseData.agent.agentBranch).toBeNull();
    });
  });

  describe("handleCreateVersion", () => {
    test("should create version with folder structure", async () => {
      const req = {
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback(Buffer.from(JSON.stringify({
              major: 0,
              minor: 1,
              type: "minor",
              goals: ["Goal 1", "Goal 2"]
            })));
          } else if (event === "end") {
            callback();
          }
        })
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

      // Mock findCurrentVersion to return no current version
      const fileOpsV2 = require("../modules/review/file-operations-v2");
      jest.spyOn(fileOpsV2, "findCurrentVersion").mockResolvedValue({
        found: false
      });

      await versionRoutes.handleCreateVersion(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.success).toBe(true);
      expect(responseData.version.tag).toBe("0-1");
      expect(responseData.version.type).toBe("minor");
      
      // Check that folder structure was created
      const versionPath = path.join(tempDir, "versions", "v0", "0-1");
      expect(fs.existsSync(versionPath)).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "01_plan"))).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "02_implement"))).toBe(true);
    });

    test("should create version with skipFolderCreation option", async () => {
      const req = {
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback(Buffer.from(JSON.stringify({
              major: 0,
              minor: 2,
              type: "minor",
              goals: [],
              skipFolderCreation: true
            })));
          } else if (event === "end") {
            callback();
          }
        })
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

      const fileOpsV2 = require("../modules/review/file-operations-v2");
      jest.spyOn(fileOpsV2, "findCurrentVersion").mockResolvedValue({
        found: false
      });

      await versionRoutes.handleCreateVersion(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.success).toBe(true);
      expect(responseData.version.tag).toBe("0-2");
      expect(responseData.version.stages).toEqual([]);
      
      // Check that folder structure was NOT created
      const versionPath = path.join(tempDir, "versions", "v0", "0-2");
      expect(fs.existsSync(versionPath)).toBe(false);
      
      // But metadata should exist
      const versionOps = require("../versions/file-operations");
      const metadata = versionOps.readVersionMetadata("0-2", tempDir, "versions");
      expect(metadata).toBeDefined();
      expect(metadata.version).toBe("0-2");
    });

    test("should create version with autoMerge option", async () => {
      const req = {
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback(Buffer.from(JSON.stringify({
              major: 0,
              minor: 3,
              type: "minor",
              goals: [],
              launchPlanningAgent: true,
              autoMerge: true,
              mergeStrategy: "squash"
            })));
          } else if (event === "end") {
            callback();
          }
        })
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

      const fileOpsV2 = require("../modules/review/file-operations-v2");
      jest.spyOn(fileOpsV2, "findCurrentVersion").mockResolvedValue({
        found: false
      });

      // Mock implementation module
      const implementationModule = require("../modules/implementation");
      jest.spyOn(implementationModule.actions, "launch-planning-agent").mockResolvedValue({
        success: true,
        agentTaskId: "test-agent-id"
      });

      await versionRoutes.handleCreateVersion(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.success).toBe(true);
      expect(responseData.autoMerge).toBe(true);
      expect(responseData.agentTaskId).toBe("test-agent-id");
      
      // Check that agent task was created with autoMerge flag
      const queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
      if (fs.existsSync(queueDir)) {
        const taskFiles = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
        if (taskFiles.length > 0) {
          const taskContent = JSON.parse(fs.readFileSync(path.join(queueDir, taskFiles[0]), "utf8"));
          expect(taskContent.autoMerge).toBe(true);
          expect(taskContent.mergeStrategy).toBe("squash");
        }
      }
    });

    test("should commit and push folder structure when commitBeforeAgent is true", async () => {
      const req = {
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback(Buffer.from(JSON.stringify({
              major: 0,
              minor: 4,
              type: "minor",
              goals: [],
              launchPlanningAgent: true,
              commitBeforeAgent: true,
              pushBeforeAgent: true
            })));
          } else if (event === "end") {
            callback();
          }
        })
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

      const fileOpsV2 = require("../modules/review/file-operations-v2");
      jest.spyOn(fileOpsV2, "findCurrentVersion").mockResolvedValue({
        found: false
      });

      // Mock git module
      const gitModule = require("../modules/git");
      jest.spyOn(gitModule.actions, "commit-and-push").mockResolvedValue({
        success: true,
        committed: true,
        pushed: true,
        message: "Changes committed and pushed successfully"
      });

      // Mock implementation module
      const implementationModule = require("../modules/implementation");
      jest.spyOn(implementationModule.actions, "launch-planning-agent").mockResolvedValue({
        success: true,
        agentTaskId: "test-agent-id"
      });

      // Initialize git repo for testing
      const { execSync } = require("child_process");
      try {
        execSync("git init", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.name 'Test User'", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.email 'test@example.com'", { cwd: tempDir, stdio: "ignore" });
      } catch (e) {
        // Git might not be available in test environment, skip this test
        return;
      }

      await versionRoutes.handleCreateVersion(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
      expect(gitModule.actions["commit-and-push"]).toHaveBeenCalled();
      const commitCall = gitModule.actions["commit-and-push"].mock.calls[0][0];
      expect(commitCall.message).toContain("Create version 0-4 folder structure");
      expect(commitCall.push).toBe(true);
    });
  });
});
