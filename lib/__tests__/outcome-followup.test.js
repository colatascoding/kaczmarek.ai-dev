/**
 * Unit tests for outcome determination and follow-up suggestions
 */

const WorkflowEngine = require("../workflow/engine");
const WorkflowDatabase = require("../db/database");
const ModuleLoader = require("../modules/module-loader");
const path = require("path");
const fs = require("fs");

describe("Outcome Determination and Follow-Up Suggestions", () => {
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
    const modulesDir = path.resolve(__dirname, "..", "modules");
    const loader = new ModuleLoader(modulesDir);
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

  describe("determineOutcome", () => {
    test("should return 'no-tasks' when last step has count === 0", () => {
      const state = {
        steps: {
          "extract-tasks": {
            status: "success",
            outputs: {
              count: 0,
              nextSteps: []
            }
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("no-tasks");
    });

    test("should return 'no-tasks' when last step has nextStepsCount === 0", () => {
      const state = {
        steps: {
          "extract-tasks": {
            status: "success",
            outputs: {
              nextStepsCount: 0
            }
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("no-tasks");
    });

    test("should return 'no-tasks' when last step has empty nextSteps array", () => {
      const state = {
        steps: {
          "extract-tasks": {
            status: "success",
            outputs: {
              nextSteps: []
            }
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("no-tasks");
    });

    test("should return 'no-tasks' when step ID is 'no-tasks'", () => {
      const state = {
        steps: {
          "no-tasks": {
            status: "success",
            outputs: {}
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("no-tasks");
    });

    test("should return 'all-complete' when last step has allComplete === true", () => {
      const state = {
        steps: {
          "check-complete": {
            status: "success",
            outputs: {
              allComplete: true
            }
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("all-complete");
    });

    test("should return 'version-created' when last step has versionTag", () => {
      const state = {
        steps: {
          "create-version": {
            status: "success",
            outputs: {
              versionTag: "version0-3"
            }
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("version-created");
    });

    test("should return 'failed' when last step status is 'failure'", () => {
      const state = {
        steps: {
          "some-step": {
            status: "failure",
            error: "Something went wrong"
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("failed");
    });

    test("should return 'no-tasks' when any step has count === 0", () => {
      const state = {
        steps: {
          "step1": {
            status: "success",
            outputs: { count: 5 }
          },
          "step2": {
            status: "success",
            outputs: { count: 0 }
          },
          "step3": {
            status: "success",
            outputs: {}
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("no-tasks");
    });

    test("should return 'completed' when no specific outcome indicators found", () => {
      const state = {
        steps: {
          "step1": {
            status: "success",
            outputs: { result: "done" }
          }
        }
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("completed");
    });

    test("should return 'unknown' when state has no steps", () => {
      const state = {
        steps: {}
      };
      
      const workflow = { name: "test", steps: [] };
      const outcome = engine.determineOutcome(state, workflow);
      
      expect(outcome).toBe("unknown");
    });
  });

  describe("getFollowUpSuggestions", () => {
    test("should return default suggestion for 'no-tasks' outcome", () => {
      const outcome = "no-tasks";
      const workflow = {
        name: "test",
        steps: []
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      const reviewSuggestion = suggestions.find(s => s.workflowId === "review-self");
      expect(reviewSuggestion).toBeDefined();
      expect(reviewSuggestion.name).toBe("Review Self");
      expect(reviewSuggestion.description).toBe("Run a new review to identify new tasks");
      expect(reviewSuggestion.reason).toBe("No tasks found - run a review to identify new work");
    });

    test("should return default suggestion for 'all-complete' outcome", () => {
      const outcome = "all-complete";
      const workflow = {
        name: "test",
        steps: []
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      const reviewSuggestion = suggestions.find(s => s.workflowId === "review-self");
      expect(reviewSuggestion).toBeDefined();
      expect(reviewSuggestion.name).toBe("Review Self");
    });

    test("should return default suggestion for 'version-created' outcome", () => {
      const outcome = "version-created";
      const workflow = {
        name: "test",
        steps: []
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      const executeSuggestion = suggestions.find(s => s.workflowId === "execute-features");
      expect(executeSuggestion).toBeDefined();
      expect(executeSuggestion.name).toBe("Execute Features");
    });

    test("should use workflow-defined follow-up workflows when available", () => {
      const outcome = "no-tasks";
      const workflow = {
        name: "test",
        steps: [],
        followUpWorkflows: [
          {
            workflowId: "custom-review",
            name: "Custom Review",
            description: "Run custom review",
            reason: "Custom reason",
            onOutcome: ["no-tasks"]
          }
        ]
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      const customSuggestion = suggestions.find(s => s.workflowId === "custom-review");
      expect(customSuggestion).toBeDefined();
      expect(customSuggestion.name).toBe("Custom Review");
      expect(customSuggestion.description).toBe("Run custom review");
      expect(customSuggestion.reason).toBe("Custom reason");
    });

    test("should match multiple outcomes in onOutcome array", () => {
      const outcome = "no-tasks";
      const workflow = {
        name: "test",
        steps: [],
        followUpWorkflows: [
          {
            workflowId: "multi-outcome",
            name: "Multi Outcome",
            onOutcome: ["no-tasks", "all-complete"]
          }
        ]
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions.length).toBeGreaterThan(0);
      const multiSuggestion = suggestions.find(s => s.workflowId === "multi-outcome");
      expect(multiSuggestion).toBeDefined();
    });

    test("should not match when outcome is not in onOutcome", () => {
      const outcome = "no-tasks";
      const workflow = {
        name: "test",
        steps: [],
        followUpWorkflows: [
          {
            workflowId: "wrong-outcome",
            name: "Wrong Outcome",
            onOutcome: ["all-complete"]
          }
        ]
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      // Should fall back to default suggestions
      const wrongSuggestion = suggestions.find(s => s.workflowId === "wrong-outcome");
      expect(wrongSuggestion).toBeUndefined();
      
      // Should have default suggestion instead
      const defaultSuggestion = suggestions.find(s => s.workflowId === "review-self");
      expect(defaultSuggestion).toBeDefined();
    });

    test("should return empty array for unknown outcome", () => {
      const outcome = "unknown";
      const workflow = {
        name: "test",
        steps: []
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    test("should return empty array for 'failed' outcome", () => {
      const outcome = "failed";
      const workflow = {
        name: "test",
        steps: []
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    test("should handle workflow without followUpWorkflows property", () => {
      const outcome = "no-tasks";
      const workflow = {
        name: "test",
        steps: []
        // No followUpWorkflows property
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test("should handle workflow with empty followUpWorkflows array", () => {
      const outcome = "no-tasks";
      const workflow = {
        name: "test",
        steps: [],
        followUpWorkflows: []
      };
      
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0); // Should use defaults
    });
  });

  describe("Integration: determineOutcome + getFollowUpSuggestions", () => {
    test("should generate follow-up suggestions for 'no-tasks' outcome scenario", () => {
      // Simulate the exact scenario from the user's execution
      const state = {
        steps: {
          "extract-next-steps": {
            status: "success",
            outputs: {
              count: 0,
              nextSteps: []
            }
          }
        }
      };
      
      const workflow = {
        name: "Execute Features from Review",
        steps: [],
        followUpWorkflows: [
          {
            workflowId: "review-self",
            name: "Review Self",
            description: "Run a new review to identify new tasks",
            reason: "No tasks found - run a review to identify new work",
            onOutcome: ["no-tasks"]
          }
        ]
      };
      
      // Determine outcome
      const outcome = engine.determineOutcome(state, workflow);
      expect(outcome).toBe("no-tasks");
      
      // Get follow-up suggestions
      const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Should have the workflow-defined suggestion
      const reviewSuggestion = suggestions.find(s => s.workflowId === "review-self");
      expect(reviewSuggestion).toBeDefined();
      expect(reviewSuggestion.name).toBe("Review Self");
      expect(reviewSuggestion.workflowId).toBe("review-self");
      expect(reviewSuggestion.description).toBe("Run a new review to identify new tasks");
      expect(reviewSuggestion.reason).toBe("No tasks found - run a review to identify new work");
    });

    test("should work with real execute-features workflow structure", () => {
      const state = {
        steps: {
          "scan": {
            status: "success",
            outputs: {}
          },
          "extract-next-steps": {
            status: "success",
            outputs: {
              count: 0,
              nextSteps: []
            }
          }
        }
      };
      
      // Load actual workflow definition
      const workflowPath = path.join(__dirname, "../../workflows/execute-features.yaml");
      if (fs.existsSync(workflowPath)) {
        const yaml = require("js-yaml");
        const workflowContent = fs.readFileSync(workflowPath, "utf8");
        const workflow = yaml.load(workflowContent);
        
        const outcome = engine.determineOutcome(state, workflow);
        expect(outcome).toBe("no-tasks");
        
        const suggestions = engine.getFollowUpSuggestions(outcome, workflow);
        
        expect(suggestions).toBeDefined();
        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThan(0);
        
        console.log("Generated suggestions:", JSON.stringify(suggestions, null, 2));
      }
    });
  });
});


