/**
 * Unit tests for follow-up suggestions
 */

const { createTestEngine, cleanupTest } = require("./helpers/workflow-engine-setup");

describe("Follow-Up Suggestions", () => {
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

