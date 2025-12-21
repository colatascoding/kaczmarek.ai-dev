/**
 * Unit tests for API Server module loading
 */

const APIServer = require("../api/server");
const path = require("path");
const fs = require("fs");

describe("APIServer Module Loading", () => {
  let apiServer;
  let testCwd;

  beforeEach(() => {
    testCwd = path.join(__dirname, "../../test-temp-api");
    if (!fs.existsSync(testCwd)) {
      fs.mkdirSync(testCwd, { recursive: true });
    }
    
    apiServer = new APIServer({
      port: 0, // Use port 0 for testing (OS assigns available port)
      cwd: testCwd
    });
  });

  afterEach(() => {
    if (apiServer && apiServer.server) {
      apiServer.server.close();
    }
    
    // Clean up test directory
    if (fs.existsSync(testCwd)) {
      try {
        fs.rmSync(testCwd, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Initialization", () => {
    test("should initialize WorkflowEngine with correct paths", () => {
      expect(apiServer.engine).toBeDefined();
      expect(apiServer.engine.modulesDir).toBeDefined();
      expect(path.isAbsolute(apiServer.engine.modulesDir)).toBe(true);
    });

    test("should load modules through WorkflowEngine", () => {
      const systemModule = apiServer.engine.moduleLoader.getModule("system");
      expect(systemModule).toBeDefined();
      expect(systemModule.name).toBe("system");
    });

    test("should have access to all modules", () => {
      const modules = apiServer.engine.moduleLoader.listModules();
      expect(modules.length).toBeGreaterThan(0);
      
      // Verify key modules are loaded
      const moduleNames = modules.map(m => m.name);
      expect(moduleNames).toContain("system");
      expect(moduleNames).toContain("review");
    });
  });

  describe("Module Path Resolution", () => {
    test("should resolve modules directory to absolute path", () => {
      const modulesDir = apiServer.engine.modulesDir;
      expect(path.isAbsolute(modulesDir)).toBe(true);
      expect(fs.existsSync(modulesDir)).toBe(true);
    });

    test("should find system module index file", () => {
      const systemIndexPath = path.join(apiServer.engine.modulesDir, "system", "index.js");
      expect(fs.existsSync(systemIndexPath)).toBe(true);
    });

    test("should find review module index file", () => {
      const reviewIndexPath = path.join(apiServer.engine.modulesDir, "review", "index.js");
      expect(fs.existsSync(reviewIndexPath)).toBe(true);
    });
  });

  describe("Module Actions", () => {
    test("should get system module actions", () => {
      const logAction = apiServer.engine.moduleLoader.getAction("system", "log");
      expect(logAction).toBeDefined();
      expect(typeof logAction).toBe("function");
    });

    test("should get review module actions", () => {
      const scanAction = apiServer.engine.moduleLoader.getAction("review", "scan-repository");
      expect(scanAction).toBeDefined();
      expect(typeof scanAction).toBe("function");
    });

    test("should handle missing actions gracefully", () => {
      expect(() => {
        apiServer.engine.moduleLoader.getAction("system", "non-existent");
      }).toThrow();
    });
  });

  describe("Workflow Execution with Modules", () => {
    test("should be able to execute workflow steps using loaded modules", async () => {
      // This test verifies that the engine can access modules
      // We don't actually execute a workflow, just verify module access
      const hasLogAction = apiServer.engine.moduleLoader.hasAction("system", "log");
      expect(hasLogAction).toBe(true);
      
      const hasScanAction = apiServer.engine.moduleLoader.hasAction("review", "scan-repository");
      expect(hasScanAction).toBe(true);
    });
  });

  describe("Custom Working Directory", () => {
    test("should work with custom cwd", () => {
      const customCwd = path.join(__dirname, "../../test-temp-custom");
      if (!fs.existsSync(customCwd)) {
        fs.mkdirSync(customCwd, { recursive: true });
      }
      
      const customServer = new APIServer({
        port: 0,
        cwd: customCwd
      });
      
      expect(customServer.cwd).toBe(customCwd);
      expect(customServer.engine).toBeDefined();
      expect(customServer.engine.moduleLoader.getModule("system")).toBeDefined();
      
      if (customServer.server) {
        customServer.server.close();
      }
      
      // Cleanup
      try {
        fs.rmSync(customCwd, { recursive: true, force: true });
      } catch (e) {
        // Ignore
      }
    });
  });
});

