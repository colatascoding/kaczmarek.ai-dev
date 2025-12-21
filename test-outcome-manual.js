/**
 * Manual test script for outcome determination and follow-up suggestions
 * Run with: node test-outcome-manual.js
 */

const WorkflowEngine = require("./lib/workflow/engine");
const WorkflowDatabase = require("./lib/db/database");
const ModuleLoader = require("./lib/modules/module-loader");
const path = require("path");
const fs = require("fs");

// Setup
const cwd = process.cwd();
const testDbPath = path.join(cwd, ".kaczmarek-ai", "test-outcome.db");
const dbDir = path.dirname(testDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new WorkflowDatabase(testDbPath);
const modulesDir = path.resolve(__dirname, "lib", "modules");
const loader = new ModuleLoader(modulesDir);
const engine = new WorkflowEngine({ cwd, db, moduleLoader: loader });

console.log("Testing outcome determination and follow-up suggestions...\n");

// Test 1: "no-tasks" outcome
console.log("Test 1: 'no-tasks' outcome");
const state1 = {
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

const workflow1 = {
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

const outcome1 = engine.determineOutcome(state1, workflow1);
console.log("  Outcome:", outcome1);
expect(outcome1, "no-tasks", "Test 1 - Outcome");

const suggestions1 = engine.getFollowUpSuggestions(outcome1, workflow1);
console.log("  Suggestions:", JSON.stringify(suggestions1, null, 2));
expect(suggestions1.length > 0, true, "Test 1 - Has suggestions");
expect(suggestions1[0].workflowId, "review-self", "Test 1 - Workflow ID");

// Test 2: Default suggestions for "no-tasks" (no workflow-defined follow-ups)
console.log("\nTest 2: Default suggestions for 'no-tasks'");
const workflow2 = {
  name: "Test Workflow",
  steps: []
  // No followUpWorkflows
};

const suggestions2 = engine.getFollowUpSuggestions("no-tasks", workflow2);
console.log("  Suggestions:", JSON.stringify(suggestions2, null, 2));
expect(suggestions2.length > 0, true, "Test 2 - Has default suggestions");
expect(suggestions2[0].workflowId, "review-self", "Test 2 - Default workflow ID");

// Test 3: Real workflow file
console.log("\nTest 3: Real execute-features.yaml workflow");
const workflowPath = path.join(__dirname, "workflows", "execute-features.yaml");
if (fs.existsSync(workflowPath)) {
  const yaml = require("js-yaml");
  const workflowContent = fs.readFileSync(workflowPath, "utf8");
  const workflow3 = yaml.load(workflowContent);
  
  console.log("  Workflow name:", workflow3.name);
  console.log("  Has followUpWorkflows:", !!workflow3.followUpWorkflows);
  if (workflow3.followUpWorkflows) {
    console.log("  Follow-up workflows:", workflow3.followUpWorkflows.length);
  }
  
  const suggestions3 = engine.getFollowUpSuggestions("no-tasks", workflow3);
  console.log("  Suggestions:", JSON.stringify(suggestions3, null, 2));
  expect(suggestions3.length > 0, true, "Test 3 - Has suggestions from real workflow");
} else {
  console.log("  Workflow file not found, skipping");
}

// Test 4: User's specific execution scenario
console.log("\nTest 4: User's execution scenario");
const state4 = {
  steps: {
    "scan": { status: "success", outputs: {} },
    "find-version": { status: "success", outputs: { found: true, versionTag: "version0-2" } },
    "read-review": { status: "success", outputs: {} },
    "read-progress": { status: "success", outputs: {} },
    "extract-next-steps": {
      status: "success",
      outputs: {
        count: 0,
        nextSteps: []
      }
    }
  }
};

const outcome4 = engine.determineOutcome(state4, workflow1);
console.log("  Outcome:", outcome4);
expect(outcome4, "no-tasks", "Test 4 - Outcome");

const suggestions4 = engine.getFollowUpSuggestions(outcome4, workflow1);
console.log("  Suggestions:", JSON.stringify(suggestions4, null, 2));
expect(suggestions4.length > 0, true, "Test 4 - Has suggestions");

console.log("\n✅ All tests passed!");

// Cleanup
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

function expect(actual, expected, testName) {
  if (actual !== expected) {
    console.error(`  ❌ ${testName}: Expected ${expected}, got ${actual}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${testName}: Passed`);
  }
}

