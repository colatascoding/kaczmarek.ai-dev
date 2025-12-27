/**
 * Integration tests for Cursor Cloud Agent background task execution
 * Tests the full flow: launch -> poll -> sync -> complete
 */

const { describe, test, expect, beforeEach, afterEach } = require("@jest/globals");
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const { EventEmitter } = require("events");

// Mock https module
jest.mock("https");

describe("Cursor Cloud Agent Integration", () => {
  let tempDir;
  let queueDir;
  let agentModule;
  let cloudAgentModule;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set required API keys
    process.env.CURSOR_API_KEY = "test-cursor-api-key";
    process.env.CLAUDE_API_KEY = "test-claude-api-key";
    
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kaczmarek-cloud-agent-test-"));
    queueDir = path.join(tempDir, ".kaczmarek-ai", "agent-queue");
    fs.mkdirSync(queueDir, { recursive: true });
    
    // Clear module cache to get fresh instances
    delete require.cache[require.resolve("../modules/agent/index.js")];
    delete require.cache[require.resolve("../modules/cursor-cloud-agent/index.js")];
    
    // Load modules
    agentModule = require("../modules/agent/index.js");
    cloudAgentModule = require("../modules/cursor-cloud-agent/index.js");
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    jest.restoreAllMocks();
  });

  describe("Launch Cloud Agent", () => {
    test("should launch cloud agent and create task file", async () => {
      // Mock successful API response
      const mockRequest = jest.fn((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { "content-type": "application/json" };
        
        process.nextTick(() => {
          callback(res);
          const body = JSON.stringify({
            id: "cloud-agent-123",
            status: "running",
            created_at: new Date().toISOString()
          });
          res.emit("data", Buffer.from(body));
          res.emit("end");
        });
        
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });
      
      https.request = mockRequest;
      
      const inputs = {
        prompt: "Test task: Create a new feature",
        repository: "https://github.com/test/repo",
        branch: "main",
        agentType: "cursor",
        executionId: "test-execution-123",
        versionTag: "0-1"
      };
      
      const context = {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        },
        cwd: tempDir
      };
      
      const result = await agentModule.actions["launch-background"](inputs, context);
      
      expect(result.success).toBe(true);
      expect(result.agentTaskId).toBeDefined();
      expect(result.cloudAgentId).toBe("cloud-agent-123");
      
      // Verify task file was created
      const taskFiles = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
      expect(taskFiles.length).toBe(1);
      
      const taskData = JSON.parse(fs.readFileSync(path.join(queueDir, taskFiles[0]), "utf8"));
      expect(taskData.type).toBe("cursor-cloud");
      expect(taskData.cloudAgentId).toBe("cloud-agent-123");
      expect(taskData.status).toBe("running");
    });

    test("should fallback to local queue if cloud agent launch fails", async () => {
      // Mock failed API response
      const mockRequest = jest.fn((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = 400;
        res.headers = { "content-type": "application/json" };
        
        process.nextTick(() => {
          callback(res);
          const body = JSON.stringify({
            error: "Invalid request"
          });
          res.emit("data", Buffer.from(body));
          res.emit("end");
        });
        
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });
      
      https.request = mockRequest;
      
      const inputs = {
        prompt: "Test task",
        repository: "https://github.com/test/repo",
        branch: "main",
        agentType: "cursor",
        executionId: "test-execution-123"
      };
      
      const context = {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        },
        cwd: tempDir
      };
      
      const result = await agentModule.actions["launch-background"](inputs, context);
      
      // Should fallback to local queue
      expect(result.success).toBe(true);
      expect(result.agentTaskId).toBeDefined();
      // For local queue, cloudAgentId should be undefined
      expect(result.cloudAgentId).toBeUndefined();
      
      // Verify local task file was created
      const taskFiles = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
      expect(taskFiles.length).toBe(1);
    });
  });

  describe("Status Polling and Syncing", () => {
    test("should poll cloud agent status and update task file", async () => {
      // Create initial task file
      const taskId = "test-task-123";
      const taskFile = path.join(queueDir, `${taskId}.json`);
      const initialTask = {
        id: taskId,
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-123",
        status: "running",
        executionId: "test-execution-123",
        startedAt: new Date().toISOString()
      };
      fs.writeFileSync(taskFile, JSON.stringify(initialTask, null, 2));
      
      // Mock status API response - agent still running
      let callCount = 0;
      const mockRequest = jest.fn((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { "content-type": "application/json" };
        
        process.nextTick(() => {
          callback(res);
          callCount++;
          const status = callCount < 2 ? "running" : "completed";
          const body = JSON.stringify({
            id: "cloud-agent-123",
            status: status,
            created_at: new Date().toISOString(),
            completed_at: status === "completed" ? new Date().toISOString() : null
          });
          res.emit("data", Buffer.from(body));
          res.emit("end");
        });
        
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });
      
      https.request = mockRequest;
      
      // Check status multiple times
      const inputs1 = {
        taskId: taskId,
        cwd: tempDir
      };
      
      const context = {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        }
      };
      
      // First check - should still be running
      const status1 = await agentModule.actions["check-status"](inputs1, context);
      expect(status1.success).toBe(true);
      expect(status1.task.status).toBe("running");
      
      // Second check - should be completed
      const status2 = await agentModule.actions["check-status"](inputs1, context);
      expect(status2.success).toBe(true);
      expect(status2.task.status).toBe("completed");
      
      // Verify task file was updated
      const updatedTask = JSON.parse(fs.readFileSync(taskFile, "utf8"));
      expect(updatedTask.status).toBe("completed");
      expect(updatedTask.completedAt).toBeDefined();
    });

    test("should handle API errors during status polling gracefully", async () => {
      // Create task file
      const taskId = "test-task-456";
      const taskFile = path.join(queueDir, `${taskId}.json`);
      const initialTask = {
        id: taskId,
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-456",
        status: "running",
        executionId: "test-execution-456",
        startedAt: new Date().toISOString()
      };
      fs.writeFileSync(taskFile, JSON.stringify(initialTask, null, 2));
      
      // Mock API error
      const mockRequest = jest.fn((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = 500;
        res.headers = { "content-type": "application/json" };
        
        process.nextTick(() => {
          callback(res);
          const body = JSON.stringify({
            error: "Internal server error"
          });
          res.emit("data", Buffer.from(body));
          res.emit("end");
        });
        
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });
      
      https.request = mockRequest;
      
      const inputs = {
        agentTaskId: taskId,
        cwd: tempDir
      };
      
      const context = {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        }
      };
      
      // Should handle error gracefully
      await expect(agentModule.actions["check-status"](inputs, context)).rejects.toThrow();
      
      // Task file should still exist
      expect(fs.existsSync(taskFile)).toBe(true);
    });
  });

  describe("Background Processor Integration", () => {
    test("should process cloud agent tasks and sync status", async () => {
      // Create task file
      const taskId = "test-task-789";
      const taskFile = path.join(queueDir, `${taskId}.json`);
      const initialTask = {
        id: taskId,
        type: "cursor-cloud",
        cloudAgentId: "cloud-agent-789",
        status: "running",
        executionId: "test-execution-789",
        versionTag: "0-1",
        tasks: ["Task 1", "Task 2"],
        startedAt: new Date().toISOString()
      };
      fs.writeFileSync(taskFile, JSON.stringify(initialTask, null, 2));
      
      // Mock status API - agent completed
      const mockRequest = jest.fn((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { "content-type": "application/json" };
        
        process.nextTick(() => {
          callback(res);
          const body = JSON.stringify({
            id: "cloud-agent-789",
            status: "completed",
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          });
          res.emit("data", Buffer.from(body));
          res.emit("end");
        });
        
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });
      
      https.request = mockRequest;
      
      // Simulate checking status via agent module
      const statusInputs = {
        taskId: taskId,
        cwd: tempDir
      };
      
      const checkContext = {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        }
      };
      
      const checkResult = await agentModule.actions["check-status"](statusInputs, checkContext);
      
      expect(checkResult).toBeDefined();
      expect(checkResult.success).toBe(true);
      expect(checkResult.task.status).toBe("completed");
      
      // Verify task file was updated
      const updatedTask = JSON.parse(fs.readFileSync(taskFile, "utf8"));
      expect(updatedTask.status).toBe("completed");
      expect(updatedTask.completedAt).toBeDefined();
    });
  });

  describe("End-to-End Flow", () => {
    test("should complete full cycle: launch -> poll -> sync -> complete", async () => {
      let agentStatus = "running";
      let callCount = 0;
      
      // Mock API for launch
      const mockLaunchRequest = jest.fn((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { "content-type": "application/json" };
        
        process.nextTick(() => {
          callback(res);
          const body = JSON.stringify({
            id: "cloud-agent-e2e",
            status: "running",
            created_at: new Date().toISOString()
          });
          res.emit("data", Buffer.from(body));
          res.emit("end");
        });
        
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });
      
      // Mock API for status polling
      const mockStatusRequest = jest.fn((options, callback) => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { "content-type": "application/json" };
        
        process.nextTick(() => {
          callback(res);
          callCount++;
          // Simulate progression: running -> running -> completed
          if (callCount >= 3) {
            agentStatus = "completed";
          }
          
          const body = JSON.stringify({
            id: "cloud-agent-e2e",
            status: agentStatus,
            created_at: new Date().toISOString(),
            completed_at: agentStatus === "completed" ? new Date().toISOString() : null
          });
          res.emit("data", Buffer.from(body));
          res.emit("end");
        });
        
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });
      
      https.request = jest.fn((options, callback) => {
        // Determine if this is a launch or status request
        if (options.path && options.path.includes("/agents")) {
          return mockLaunchRequest(options, callback);
        } else {
          return mockStatusRequest(options, callback);
        }
      });
      
      const context = {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        },
        cwd: tempDir
      };
      
      // Step 1: Launch agent
      const launchInputs = {
        prompt: "E2E test: Implement feature X",
        repository: "https://github.com/test/repo",
        branch: "main",
        agentType: "cursor",
        executionId: "e2e-execution-123",
        versionTag: "0-1"
      };
      
      const launchResult = await agentModule.actions["launch-background"](launchInputs, context);
      expect(launchResult.success).toBe(true);
      expect(launchResult.agentTaskId).toBeDefined();
      
      // For cloud agents, agentTaskId is the cloudAgentId
      const taskId = launchResult.agentTaskId;
      const taskFile = path.join(queueDir, `${taskId}.json`);
      expect(fs.existsSync(taskFile)).toBe(true);
      
      // Step 2: Poll status (simulate multiple polls)
      const statusInputs = {
        taskId: taskId,
        cwd: tempDir
      };
      
      // First poll - should be running
      const status1 = await agentModule.actions["check-status"](statusInputs, context);
      expect(status1.success).toBe(true);
      expect(status1.task.status).toBe("running");
      
      // Second poll - should still be running
      const status2 = await agentModule.actions["check-status"](statusInputs, context);
      expect(status2.success).toBe(true);
      expect(status2.task.status).toBe("running");
      
      // Third poll - should be completed
      const status3 = await agentModule.actions["check-status"](statusInputs, context);
      expect(status3.success).toBe(true);
      expect(status3.task.status).toBe("completed");
      
      // Step 3: Verify final state
      const finalTask = JSON.parse(fs.readFileSync(taskFile, "utf8"));
      expect(finalTask.status).toBe("completed");
      expect(finalTask.completedAt).toBeDefined();
      expect(finalTask.cloudAgentId).toBe("cloud-agent-e2e");
    });
  });
});

