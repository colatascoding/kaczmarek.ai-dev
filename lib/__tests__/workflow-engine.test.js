/**
 * Unit tests for workflow engine
 */

const WorkflowEngine = require("../workflow/engine");
const WorkflowDatabase = require("../db/database");
const ModuleLoader = require("../modules/module-loader");
const path = require("path");
const fs = require("fs");

describe("WorkflowEngine", () => {
  let engine;
  let db;
  let testDbPath;
  let cwd;

  beforeEach(() => {
    cwd = path.join(__dirname, "../../test-temp");
    if (!fs.existsSync(cwd)) {
      fs.mkdirSync(cwd, { recursive: true });
    }
    
    testDbPath = path.join(cwd, ".kaczmarek-ai", "test-workflows.db");
    const dbDir = path.dirname(testDbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Remove existing test DB
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new WorkflowDatabase(testDbPath);
    const loader = new ModuleLoader(cwd);
    engine = new WorkflowEngine({ cwd, db, moduleLoader: loader });
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(cwd)) {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("engine initializes correctly", () => {
    expect(engine).toBeDefined();
    expect(engine.cwd).toBe(cwd);
    expect(engine.db).toBe(db);
  });

  test("can load workflow from YAML", () => {
    const YAMLParser = require("../workflow/yaml-parser");
    const workflowPath = path.join(__dirname, "../../workflows/example-simple.yaml");
    
    if (fs.existsSync(workflowPath)) {
      const workflow = YAMLParser.loadFromFile(workflowPath);
      expect(workflow).toBeDefined();
      expect(workflow.name).toBeDefined();
      expect(workflow.steps).toBeDefined();
      expect(Array.isArray(workflow.steps)).toBe(true);
    }
  });

  test("validates workflow structure", () => {
    const YAMLParser = require("../workflow/yaml-parser");
    
    const validWorkflow = {
      name: "Test",
      steps: [
        { id: "step1", module: "system", action: "log" }
      ]
    };
    
    const result = YAMLParser.validate(validWorkflow);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test("detects invalid workflow structure", () => {
    const YAMLParser = require("../workflow/yaml-parser");
    
    const invalidWorkflow = {
      // Missing name
      steps: []
    };
    
    const result = YAMLParser.validate(invalidWorkflow);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("resolves template variables", () => {
    const state = {
      trigger: { param: "value" },
      steps: {
        step1: {
          outputs: { result: "success" }
        }
      }
    };
    
    const result = engine.resolveValue("{{ trigger.param }}", state);
    expect(result).toBe("value");
    
    const result2 = engine.resolveValue("{{ steps.step1.outputs.result }}", state);
    expect(result2).toBe("success");
  });

  test("handles default values in template variables", () => {
    const state = {
      trigger: {}
    };
    
    const result = engine.resolveValue("{{ trigger.param || 'default' }}", state);
    expect(result).toBe("default");
  });
});

