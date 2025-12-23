/**
 * Integration tests for outcome determination and follow-up suggestions
 */

const { createTestEngine, cleanupTest } = require("./helpers/workflow-engine-setup");
const path = require("path");
const fs = require("fs");

describe("Integration: determineOutcome + getFollowUpSuggestions", () => {
  let engine;
  let db;
  let testDbPath;
  let cwd;

  beforeEach(() => {
    const setup = createTestEngine();
    engine = setup.engine;
    db = setup.db;
    testDbPath = setup.testDbPath;
    cwd = setup.cwd;
  });

  afterEach(() => {
    cleanupTest(testDbPath, cwd);
  });

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

