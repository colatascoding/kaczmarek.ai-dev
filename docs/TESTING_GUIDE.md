# Testing Guide

This guide explains how to test the kaczmarek.ai-dev workflow orchestration system.

## Quick Test

### 1. Test Workflow Engine
```bash
# List available workflows
./kad workflow list

# Validate a workflow
./kad workflow validate workflows/execute-features.yaml

# Show workflow details
./kad workflow show execute-features
```

### 2. Test Review Workflow
```bash
# Run review workflow
./kad workflow run review-self --days 7

# Check execution status
./kad workflow status <execution-id>
```

### 3. Test Execution Workflow
```bash
# Run execution workflow (extracts tasks from review)
./kad workflow run execute-features --maxTasks 2

# Check agent tasks
./kad agent list

# Debug a task
./kad agent debug <task-id>

# Process a task manually
./kad agent process <task-id>
```

### 4. Test Task Completion
```bash
# Mark a task as complete (updates progress/review)
./kad agent complete <task-id>

# Verify progress file was updated
cat progress/version0-1.md | tail -20

# Verify review file was updated
grep -A 5 "Next Steps" review/version0-1.md
```

## Comprehensive Test Scenarios

### Scenario 1: End-to-End Workflow Test

**Goal**: Test the complete flow from review to task completion

```bash
# Step 1: Ensure you have a review file
ls review/version0-1.md

# Step 2: Run execution workflow
./kad workflow run execute-features --maxTasks 1

# Step 3: Check agent task was created
./kad agent list

# Step 4: Get task ID
TASK_ID=$(./kad agent list | grep "ready" | head -1 | awk '{print $2}')

# Step 5: Debug the task
./kad agent debug $TASK_ID

# Step 6: Check execution results (if executor ran)
cat .kaczmarek-ai/agent-queue/$TASK_ID.json | jq '.executionResults'

# Step 7: Mark task as complete
./kad agent complete $TASK_ID

# Step 8: Verify files were updated
echo "=== Progress File ==="
tail -15 progress/version0-1.md
echo ""
echo "=== Review File ==="
grep -A 5 "Next Steps" review/version0-1.md
```

### Scenario 2: Test Background Processor

**Goal**: Test automatic task processing

```bash
# Step 1: Create a new task (run workflow)
./kad workflow run execute-features --maxTasks 1

# Step 2: Start background processor
./kad agent start &
PROCESSOR_PID=$!

# Step 3: Wait a few seconds
sleep 5

# Step 4: Check if task was processed
./kad agent list

# Step 5: Stop processor
kill $PROCESSOR_PID
./kad agent stop
```

### Scenario 3: Test Module Actions

**Goal**: Test individual module actions

```bash
# Test review module - scan repository
node -e "
const ModuleLoader = require('./lib/modules/module-loader');
const loader = new ModuleLoader('./lib/modules');
const action = loader.getAction('review', 'scan-repository');
action({cwd: process.cwd()}, {
  logger: {info: console.log, error: console.error, warn: console.warn}
}).then(r => console.log(JSON.stringify(r, null, 2)));
"

# Test testing module - run tests
node -e "
const ModuleLoader = require('./lib/modules/module-loader');
const loader = new ModuleLoader('./lib/modules');
const action = loader.getAction('testing', 'run-tests');
action({cwd: process.cwd()}, {
  logger: {info: console.log, error: console.error, warn: console.warn}
}).then(r => console.log(JSON.stringify(r, null, 2)));
"
```

### Scenario 4: Test Executor

**Goal**: Test the execution engine

```bash
# Create a test task file
cat > /tmp/test-task.json << 'EOF'
{
  "id": "test-executor",
  "type": "cursor",
  "tasks": [
    {
      "id": "task-1",
      "description": "Create file test-output.txt",
      "priority": 1
    }
  ],
  "status": "queued"
}
EOF

# Test executor
node -e "
const AgentExecutor = require('./lib/agent/executor');
const executor = new AgentExecutor({cwd: process.cwd()});
const task = require('/tmp/test-task.json');
executor.executeTask(task, '/tmp/test-task.json').then(r => {
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
});
"

# Check if file was created
ls -la test-output.txt 2>/dev/null && echo "File created!" || echo "File not created"
```

## Module Testing

### Test System Module
```bash
node -e "
const system = require('./lib/modules/system');
const action = system.actions.log;
action({message: 'Test log', level: 'info'}, {
  logger: {info: console.log}
});
"
```

### Test Review Module
```bash
# Test scan repository
node -e "
const review = require('./lib/modules/review');
const action = review.actions['scan-repository'];
action({cwd: process.cwd()}, {
  logger: {info: console.log, error: console.error}
}).then(r => console.log('Success:', r.success));
"

# Test find current version
node -e "
const review = require('./lib/modules/review');
const action = review.actions['find-current-version'];
action({cwd: process.cwd()}, {
  logger: {info: console.log, error: console.error}
}).then(r => console.log('Found:', r.found, 'Version:', r.versionTag));
"
```

### Test Implementation Module
```bash
# Test extract next steps
node -e "
const impl = require('./lib/modules/implementation');
const action = impl.actions['extract-next-steps'];
action({reviewFile: 'review/version0-1.md'}, {
  logger: {info: console.log, error: console.error}
}).then(r => console.log('Found', r.count, 'next steps'));
"
```

### Test Testing Module
```bash
# Test run tests
node -e "
const testing = require('./lib/modules/testing');
const action = testing.actions['run-tests'];
action({cwd: process.cwd()}, {
  logger: {info: console.log, error: console.error, warn: console.warn}
}).then(r => {
  console.log('Success:', r.success);
  console.log('Passed:', r.passed);
});
"
```

## Database Testing

### Check Workflow Database
```bash
# List workflows in database
sqlite3 .kaczmarek-ai/workflows.db "SELECT name, version FROM workflows;"

# List executions
sqlite3 .kaczmarek-ai/workflows.db "SELECT id, workflow_id, status, started_at FROM executions ORDER BY started_at DESC LIMIT 5;"

# List step executions
sqlite3 .kaczmarek-ai/workflows.db "SELECT step_id, status, module, action FROM step_executions ORDER BY started_at DESC LIMIT 10;"
```

## Integration Testing

### Test Complete Workflow Chain

```bash
#!/bin/bash
# Complete integration test

echo "=== Step 1: Run Review Workflow ==="
REVIEW_EXEC=$(./kad workflow run review-self --days 7 2>&1 | grep -oE '[a-f0-9]{32}' | head -1)
echo "Review execution ID: $REVIEW_EXEC"

echo ""
echo "=== Step 2: Run Execution Workflow ==="
EXEC_EXEC=$(./kad workflow run execute-features --maxTasks 1 2>&1 | grep -oE '[a-f0-9]{32}' | head -1)
echo "Execution ID: $EXEC_EXEC"

echo ""
echo "=== Step 3: Check Agent Tasks ==="
./kad agent list

echo ""
echo "=== Step 4: Get Task ID ==="
TASK_ID=$(./kad agent list | grep "ready" | head -1 | awk '{print $2}')
echo "Task ID: $TASK_ID"

echo ""
echo "=== Step 5: Debug Task ==="
./kad agent debug $TASK_ID

echo ""
echo "=== Step 6: Complete Task ==="
./kad agent complete $TASK_ID

echo ""
echo "=== Step 7: Verify Updates ==="
echo "Progress file updated:"
tail -10 progress/version0-1.md
echo ""
echo "Review file updated:"
grep -A 3 "Next Steps" review/version0-1.md
```

## Verification Checklist

After running tests, verify:

- [ ] Workflows can be listed and validated
- [ ] Review workflow generates prompts
- [ ] Execution workflow creates agent tasks
- [ ] Agent tasks are queued correctly
- [ ] Background processor processes tasks
- [ ] Executor handles simple tasks
- [ ] Task completion updates progress file
- [ ] Task completion updates review file
- [ ] Database stores execution state
- [ ] All modules load correctly
- [ ] CLI commands work as expected

## Troubleshooting Tests

### If workflows don't run:
```bash
# Check workflow files exist
ls workflows/*.yaml

# Validate workflow syntax
./kad workflow validate workflows/execute-features.yaml

# Check database
ls -la .kaczmarek-ai/workflows.db
```

### If agents don't process:
```bash
# Check agent queue
ls -la .kaczmarek-ai/agent-queue/

# Check task files
cat .kaczmarek-ai/agent-queue/*.json | jq '.status'

# Check processor
./kad agent start
```

### If modules don't load:
```bash
# Test module loading
node -e "
const ModuleLoader = require('./lib/modules/module-loader');
const loader = new ModuleLoader('./lib/modules');
console.log(loader.listModules());
"
```

## Performance Testing

### Test Workflow Execution Speed
```bash
time ./kad workflow run execute-features --maxTasks 1
```

### Test Agent Processing Speed
```bash
# Create multiple tasks
for i in {1..5}; do
  ./kad workflow run execute-features --maxTasks 1
done

# Time processing
time ./kad agent start &
sleep 10
pkill -f "kad agent start"
```

## Expected Results

### Successful Test Output

**Workflow Run:**
```
Running workflow: execute-features
Parameters: { "maxTasks": 1 }
[scan] Scanning repository...
[find-version] Finding current version files...
[extract-next-steps] Found 4 next steps in review file
[create-plan] Creating implementation plan from 4 next steps (max 1 tasks)
[generate-prompt] Generating implementation prompt...
[launch-agent] Launching background agent (type: cursor) for 1 tasks
Workflow execution started: <execution-id>
Status: completed
```

**Agent List:**
```
Found 1 agent task(s):
  ✓ <task-id> - ready (cursor) - 1 tasks
```

**Agent Debug:**
```
Task Details: <task-id>
============================================================
Status: ready
Type: cursor
Tasks: 1
  1. <task description>
Prompt: <length> characters
```

**Task Complete:**
```
Completing task workflow for <task-id>
Marking task <task-id> as completed
Task <task-id> marked as completed
Updating progress file for task <task-id>
Progress file updated: progress/version0-1.md
Marking review tasks as completed for task <task-id>
Review file updated: review/version0-1.md
Task <task-id> completed successfully.
Progress and review files updated.
```

## Jest Unit and Integration Tests

### Overview

The project uses Jest for automated testing with jsdom for DOM testing. Tests are organized into:
- **Unit tests**: Test individual modules and functions in isolation
- **Integration tests**: Test how multiple components work together

### Test Setup

Install test dependencies:
```bash
npm install --save-dev jest jsdom
```

Configuration in `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "lib/**/*.js",
      "frontend/**/*.js",
      "!**/__tests__/**"
    ]
  }
}
```

### Unit Test Patterns

#### Pattern 1: Workflow Engine Testing

Test file: `lib/__tests__/workflow-engine.test.js`

```javascript
const WorkflowEngine = require("../workflow/engine");
const WorkflowDatabase = require("../db/database");
const ModuleLoader = require("../modules/module-loader");

describe("WorkflowEngine", () => {
  let engine, db, testDbPath, cwd;

  beforeEach(() => {
    // Setup test environment
    cwd = path.join(__dirname, "../../test-temp");
    fs.mkdirSync(cwd, { recursive: true });
    
    testDbPath = path.join(cwd, ".kaczmarek-ai", "test-workflows.db");
    fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
    
    // Create test database
    db = new WorkflowDatabase(testDbPath);
    const loader = new ModuleLoader(path.resolve(__dirname, "..", "modules"));
    engine = new WorkflowEngine({ cwd, db, moduleLoader: loader });
  });

  afterEach(() => {
    // Cleanup test files and database
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
  });

  test("resolves template variables", () => {
    const state = {
      trigger: { param: "value" },
      steps: { step1: { outputs: { result: "success" } } }
    };
    
    expect(engine.resolveValue("{{ trigger.param }}", state)).toBe("value");
    expect(engine.resolveValue("{{ steps.step1.outputs.result }}", state)).toBe("success");
  });
});
```

**Key patterns:**
- Use `beforeEach`/`afterEach` for test isolation
- Create temporary directories for test data
- Clean up all test artifacts after each test
- Test both success and failure cases

#### Pattern 2: Outcome Determination Testing

Test file: `lib/__tests__/outcome-determination.test.js`

```javascript
const { createTestEngine, cleanupTest } = require("./helpers/workflow-engine-setup");

describe("Outcome Determination", () => {
  let engine;

  beforeEach(() => {
    const setup = createTestEngine();
    engine = setup.engine;
  });

  test("should return 'no-tasks' when count === 0", () => {
    const state = {
      steps: {
        "extract-tasks": {
          status: "success",
          outputs: { count: 0, nextSteps: [] }
        }
      }
    };
    
    const workflow = { name: "test", steps: [] };
    const outcome = engine.determineOutcome(state, workflow);
    
    expect(outcome).toBe("no-tasks");
  });
});
```

**Key patterns:**
- Use test helpers to reduce boilerplate
- Test edge cases (empty arrays, null values, missing properties)
- Use descriptive test names that explain the scenario
- Test all outcome types

#### Pattern 3: Module Testing

Test file: `lib/__tests__/module-loader.test.js`

```javascript
describe("ModuleLoader", () => {
  test("loads modules from directory", () => {
    const loader = new ModuleLoader("./lib/modules");
    const modules = loader.listModules();
    
    expect(modules).toContain("system");
    expect(modules).toContain("review");
    expect(modules).toContain("implementation");
  });

  test("gets action from module", () => {
    const loader = new ModuleLoader("./lib/modules");
    const action = loader.getAction("system", "log");
    
    expect(action).toBeDefined();
    expect(typeof action).toBe("function");
  });
});
```

### Integration Test Patterns

#### Pattern 1: Workflow View Integration

Test file: `frontend/__tests__/workflow-view-integration.test.js`

```javascript
// Setup DOM
document.body.innerHTML = `
  <div id="modal">
    <div class="modal-content">
      <div id="modal-body"></div>
    </div>
  </div>
`;

describe("Workflow View Integration", () => {
  let modalBody;

  beforeEach(() => {
    modalBody = document.getElementById("modal-body");
    modalBody.innerHTML = "";
  });

  it("workflow steps are rendered with correct structure", () => {
    const workflow = {
      name: "Test Workflow",
      steps: [
        { id: "step1", module: "system", action: "log" }
      ]
    };
    
    // Render workflow
    modalBody.innerHTML = `
      <div class="workflow-steps-view">
        <div class="workflow-step-card">
          <h4>${workflow.steps[0].id}</h4>
          <span class="module-badge">${workflow.steps[0].module}</span>
        </div>
      </div>
    `;
    
    const stepCard = modalBody.querySelector(".workflow-step-card");
    expect(stepCard).not.toBeNull();
    expect(stepCard.querySelector("h4").textContent).toBe("step1");
  });
});
```

**Key patterns:**
- Set up realistic DOM structures in tests
- Test both rendering and user interactions
- Use `beforeEach` to reset DOM state
- Test accessibility and visibility

#### Pattern 2: API Server Integration

Test file: `lib/__tests__/api-server-modules.test.js`

```javascript
describe("API Server Module Endpoints", () => {
  test("modules endpoint returns correct structure", async () => {
    const response = await fetch("/api/modules");
    const data = await response.json();
    
    expect(data.modules).toBeDefined();
    expect(Array.isArray(data.modules)).toBe(true);
    expect(data.modules.length).toBeGreaterThan(0);
  });
});
```

### Test Helpers

Create reusable test setup in `lib/__tests__/helpers/workflow-engine-setup.js`:

```javascript
const WorkflowEngine = require("../../workflow/engine");
const WorkflowDatabase = require("../../db/database");
const ModuleLoader = require("../../modules/module-loader");
const path = require("path");
const fs = require("fs");

function createTestEngine() {
  const cwd = path.join(__dirname, "../../../test-temp");
  fs.mkdirSync(cwd, { recursive: true });
  
  const testDbPath = path.join(cwd, ".kaczmarek-ai", "test-workflows.db");
  fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  
  const db = new WorkflowDatabase(testDbPath);
  const loader = new ModuleLoader(path.resolve(__dirname, "..", "..", "modules"));
  const engine = new WorkflowEngine({ cwd, db, moduleLoader: loader });
  
  return { engine, db, testDbPath, cwd };
}

function cleanupTest(testDbPath, cwd) {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(cwd)) fs.rmSync(cwd, { recursive: true, force: true });
}

module.exports = { createTestEngine, cleanupTest };
```

### Running Tests

Execute all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

View coverage in browser:
```bash
open coverage/lcov-report/index.html
```

### Test Coverage Goals

Target coverage levels:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

Check coverage for specific files:
```bash
npm run test:coverage -- --collectCoverageFrom="lib/workflow/*.js"
```

### Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Clean Setup/Teardown**: Always clean up test artifacts in `afterEach`
3. **Descriptive Names**: Use clear test names that describe what is being tested
4. **Test Edge Cases**: Include tests for null, undefined, empty arrays, etc.
5. **Mock External Dependencies**: Use Jest mocks for file system, API calls, etc.
6. **Fast Tests**: Keep unit tests fast (< 50ms each) by avoiding real file I/O
7. **Integration Tests**: Use integration tests to verify component interactions

### Common Test Scenarios

#### Testing Async Operations
```javascript
test("async operation completes", async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

#### Testing Error Handling
```javascript
test("handles errors gracefully", () => {
  expect(() => functionThatThrows()).toThrow("Expected error message");
});
```

#### Testing with Mocks
```javascript
const mockFn = jest.fn();
mockFn.mockReturnValue("mocked value");
expect(mockFn()).toBe("mocked value");
```

## Next Steps

After testing:
1. Review test results
2. Check for any errors
3. Verify all features work
4. Report any issues
5. Continue development based on test findings


