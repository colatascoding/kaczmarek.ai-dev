/**
 * Unit tests for outcome determination
 */

const { createTestEngine, cleanupTest } = require("./helpers/workflow-engine-setup");

describe("Outcome Determination", () => {
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

  test("should return 'no-tasks' when check-all-complete step has allComplete === false", () => {
    const state = {
      steps: {
        "check-all-complete": {
          status: "success",
          outputs: {
            allComplete: false
          }
        }
      }
    };
    
    const workflow = { name: "test", steps: [] };
    const outcome = engine.determineOutcome(state, workflow);
    
    expect(outcome).toBe("no-tasks");
  });

  test("should return 'version-created' when step ID is 'create-next-version'", () => {
    const state = {
      steps: {
        "create-next-version": {
          status: "success",
          outputs: {}
        }
      }
    };
    
    const workflow = { name: "test", steps: [] };
    const outcome = engine.determineOutcome(state, workflow);
    
    expect(outcome).toBe("version-created");
  });
});

