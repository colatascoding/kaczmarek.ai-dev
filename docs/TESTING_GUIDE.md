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

## Next Steps

After testing:
1. Review test results
2. Check for any errors
3. Verify all features work
4. Report any issues
5. Continue development based on test findings




