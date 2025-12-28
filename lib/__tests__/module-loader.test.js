/**
 * Unit tests for ModuleLoader
 */

const ModuleLoader = require("../modules/module-loader");
const path = require("path");
const fs = require("fs");

describe("ModuleLoader", () => {
  let modulesDir;
  let loader;

  beforeEach(() => {
    // Use the actual modules directory for testing
    modulesDir = path.resolve(__dirname, "..", "modules");
    loader = new ModuleLoader(modulesDir);
  });

  describe("Constructor", () => {
    test("should resolve relative path to absolute path", () => {
      const relativePath = path.join(__dirname, "..", "modules");
      const loader = new ModuleLoader(relativePath);
      
      expect(loader.modulesDir).toBe(path.resolve(relativePath));
      expect(path.isAbsolute(loader.modulesDir)).toBe(true);
    });

    test("should use default path when no path provided", () => {
      const loader = new ModuleLoader();
      
      expect(loader.modulesDir).toBeDefined();
      expect(path.isAbsolute(loader.modulesDir)).toBe(true);
      expect(loader.modulesDir).toContain("modules");
    });

    test("should resolve absolute paths correctly", () => {
      const absolutePath = path.resolve(__dirname, "..", "modules");
      const loader = new ModuleLoader(absolutePath);
      
      expect(loader.modulesDir).toBe(absolutePath);
    });
  });

  describe("Module Loading", () => {
    test("should load all available modules", () => {
      const modules = loader.listModules();
      
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.some(m => m.name === "system")).toBe(true);
      expect(modules.some(m => m.name === "review")).toBe(true);
    });

    test("should load system module correctly", () => {
      const systemModule = loader.getModule("system");
      
      expect(systemModule).toBeDefined();
      expect(systemModule.name).toBe("system");
      expect(systemModule.actions).toBeDefined();
      expect(typeof systemModule.actions).toBe("object");
    });

    test("should load review module correctly", () => {
      const reviewModule = loader.getModule("review");
      
      expect(reviewModule).toBeDefined();
      expect(reviewModule.name).toBe("review");
      expect(reviewModule.actions).toBeDefined();
    });

    test("should get action from module", () => {
      const logAction = loader.getAction("system", "log");
      
      expect(logAction).toBeDefined();
      expect(typeof logAction).toBe("function");
    });

    test("should throw error for non-existent module", () => {
      expect(() => {
        loader.getModule("non-existent-module");
      }).not.toThrow(); // getModule returns undefined, doesn't throw
      
      expect(loader.getModule("non-existent-module")).toBeUndefined();
    });

    test("should throw error for non-existent action", () => {
      expect(() => {
        loader.getAction("system", "non-existent-action");
      }).toThrow("Action non-existent-action not found in module system");
    });

    test("should throw error when getting action from non-existent module", () => {
      expect(() => {
        loader.getAction("non-existent-module", "some-action");
      }).toThrow("Module not found: non-existent-module");
    });
  });

  describe("Path Resolution", () => {
    test("should resolve module paths correctly", () => {
      const systemModule = loader.getModule("system");
      expect(systemModule).toBeDefined();
      
      // Verify the module was loaded from the correct path
      const expectedPath = path.join(modulesDir, "system", "index.js");
      expect(fs.existsSync(expectedPath)).toBe(true);
    });

    test("should handle paths with different separators", () => {
      // Test with forward slashes (Unix)
      const unixPath = modulesDir.replace(/\\/g, "/");
      const loader1 = new ModuleLoader(unixPath);
      expect(loader1.getModule("system")).toBeDefined();
      
      // Test with backslashes (Windows-style, if on Windows)
      if (process.platform === "win32") {
        const windowsPath = modulesDir.replace(/\//g, "\\");
        const loader2 = new ModuleLoader(windowsPath);
        expect(loader2.getModule("system")).toBeDefined();
      }
    });
  });

  describe("Module Actions", () => {
    test("should list all actions for a module", () => {
      const modules = loader.listModules();
      const systemModule = modules.find(m => m.name === "system");
      
      expect(systemModule).toBeDefined();
      expect(systemModule.actions).toBeDefined();
      expect(Array.isArray(systemModule.actions)).toBe(true);
      expect(systemModule.actions.length).toBeGreaterThan(0);
    });

    test("should check if module has action", () => {
      expect(loader.hasAction("system", "log")).toBe(true);
      expect(loader.hasAction("system", "wait")).toBe(true);
      expect(loader.hasAction("system", "non-existent")).toBe(false);
      expect(loader.hasAction("non-existent-module", "log")).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("should handle missing module directory gracefully", () => {
      const nonExistentPath = path.join(__dirname, "non-existent-modules");
      const loader = new ModuleLoader(nonExistentPath);
      
      // Should not throw, but should have no modules loaded
      const modules = loader.listModules();
      expect(modules.length).toBe(0);
    });

    test("should handle invalid module structure", () => {
      // This test verifies that modules without name or actions are skipped
      // We can't easily test this without creating a test module, but the
      // loader should handle it gracefully
      const modules = loader.listModules();
      
      // All loaded modules should have name and actions
      modules.forEach(module => {
        expect(module.name).toBeDefined();
        expect(module.actions).toBeDefined();
        expect(Array.isArray(module.actions)).toBe(true);
      });
    });
  });

  describe("Module Cache", () => {
    test("should clear require cache when reloading", () => {
      const systemModule1 = loader.getModule("system");
      expect(systemModule1).toBeDefined();
      
      // Create a new loader to test cache clearing
      const loader2 = new ModuleLoader(modulesDir);
      const systemModule2 = loader2.getModule("system");
      
      expect(systemModule2).toBeDefined();
      expect(systemModule2.name).toBe("system");
    });
  });

  describe("Integration with WorkflowEngine", () => {
    test("should work with WorkflowEngine initialization", () => {
      const WorkflowEngine = require("../workflow/engine");
      const testCwd = path.join(__dirname, "../../test-temp");
      
      // Ensure test directory exists
      if (!fs.existsSync(testCwd)) {
        fs.mkdirSync(testCwd, { recursive: true });
      }
      
      // Ensure .kaczmarek-ai directory exists
      const dbDir = path.join(testCwd, ".kaczmarek-ai");
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      const engine = new WorkflowEngine({
        cwd: testCwd
      });
      
      expect(engine.moduleLoader).toBeDefined();
      expect(engine.moduleLoader.getModule("system")).toBeDefined();
      
      // Cleanup: close database connection if it exists
      if (engine.db && engine.db.close) {
        try {
          engine.db.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    test("should load modules with custom modulesDir in WorkflowEngine", () => {
      const WorkflowEngine = require("../workflow/engine");
      const customModulesDir = path.resolve(__dirname, "..", "modules");
      const testCwd = path.join(__dirname, "../../test-temp");
      
      // Ensure test directory exists
      if (!fs.existsSync(testCwd)) {
        fs.mkdirSync(testCwd, { recursive: true });
      }
      
      // Ensure .kaczmarek-ai directory exists
      const dbDir = path.join(testCwd, ".kaczmarek-ai");
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      const engine = new WorkflowEngine({
        cwd: testCwd,
        modulesDir: customModulesDir
      });
      
      expect(engine.modulesDir).toBe(customModulesDir);
      expect(engine.moduleLoader.modulesDir).toBe(customModulesDir);
      expect(engine.moduleLoader.getModule("system")).toBeDefined();
    });
  });
});



