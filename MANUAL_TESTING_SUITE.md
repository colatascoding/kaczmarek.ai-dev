# Manual Testing Suite - Progressive Feature Testing

**Purpose**: Test the system progressively, starting with minimal features and adding complexity as each stage passes.

**Rule**: You can only proceed to the next stage if ALL tests in the current stage pass. If any test fails, fix the issue before moving forward.

---

## Stage 1: Core CLI Basics ⚙️

**Goal**: Verify the CLI is installed and basic commands work.

### Test 1.1: CLI Installation
- [ ] Run `npm install` (if not already done)
- [ ] Verify `kad` command is available: `which kad` or `kad --help`
- **Pass Criteria**: Command exists and shows help output

### Test 1.2: CLI Help Command
- [ ] Run `kad --help` or `kad` (no arguments)
- [ ] Verify help text is displayed
- **Pass Criteria**: Help menu shows available commands

### Test 1.3: CLI Version/Info
- [ ] Run `kad --version` (if available) or check package.json version
- **Pass Criteria**: Version information is displayed or command doesn't error

### Test 1.4: Database Initialization
- [ ] Run `kad init` (if available) or start API which should init DB
- [ ] Check if `.kaczmarek-ai/` directory is created
- [ ] Check if database file exists
- **Pass Criteria**: Database structure is created without errors

**Stage 1 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 2: Basic Workflow System 📋

**Prerequisites**: Stage 1 must be ✅ Passed

### Test 2.1: List Workflows
- [ ] Run `kad workflow list`
- [ ] Verify workflows are listed (should show workflows from `workflows/` and `library/workflows/`)
- **Pass Criteria**: Command executes and shows workflow list

### Test 2.2: Show Workflow Details
- [ ] Run `kad workflow show <workflow-name>` (e.g., `review-self`)
- [ ] Verify workflow YAML content is displayed
- **Pass Criteria**: Workflow details are shown correctly

### Test 2.3: Validate Workflow
- [ ] Run `kad workflow validate <workflow-name>`
- [ ] Verify validation passes for a valid workflow
- [ ] Try invalid workflow (if you have one) and verify error message
- **Pass Criteria**: Validation works correctly for valid/invalid workflows

### Test 2.4: Simple Workflow Execution (Dry Run)
- [ ] Run `kad workflow run <simple-workflow>` with a very simple workflow
- [ ] Verify workflow starts execution
- [ ] Check execution status: `kad workflow status <execution-id>`
- **Pass Criteria**: Workflow can be started and status can be checked

**Stage 2 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 3: Agent System Basics 🤖

**Prerequisites**: Stage 2 must be ✅ Passed

### Test 3.1: Agent Queue Directory
- [ ] Verify `.kaczmarek-ai/agent-queue/` directory exists
- [ ] Check directory is readable/writable
- **Pass Criteria**: Agent queue directory exists and is accessible

### Test 3.2: List Agents
- [ ] Run `kad agent list`
- [ ] Verify command executes (may show empty list if no agents)
- **Pass Criteria**: Command executes without errors

### Test 3.3: Agent Status
- [ ] Run `kad agent status` (if no agents, should show empty state)
- **Pass Criteria**: Status command works

### Test 3.4: Start Agent Processor
- [ ] Run `kad agent start` (or check if auto-starts)
- [ ] Verify processor starts (check logs or status)
- **Pass Criteria**: Agent processor can be started

**Stage 3 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 4: API Server 🌐

**Prerequisites**: Stage 3 must be ✅ Passed

### Test 4.1: Start API Server
- [ ] Run `npm run api` or `kad api start`
- [ ] Verify server starts on default port (3100)
- [ ] Check for startup messages/logs
- **Pass Criteria**: Server starts without errors

### Test 4.2: Health Check Endpoint
- [ ] With server running, visit `http://localhost:3100/health` or `http://localhost:3100/api/health`
- [ ] Verify health check responds
- **Pass Criteria**: Health endpoint returns success response

### Test 4.3: API Root Endpoint
- [ ] Visit `http://localhost:3100/` or `http://localhost:3100/api`
- [ ] Verify API responds (may show API info or redirect)
- **Pass Criteria**: Root endpoint responds

### Test 4.4: Stop API Server
- [ ] Stop the server (Ctrl+C or `kad api stop` if available)
- [ ] Verify server stops cleanly
- **Pass Criteria**: Server can be stopped

**Stage 4 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 5: Frontend UI Basics 🖥️

**Prerequisites**: Stage 4 must be ✅ Passed

### Test 5.1: Start API and Open Frontend
- [ ] Start API server: `npm run api`
- [ ] Open browser to `http://localhost:3100`
- [ ] Verify page loads
- **Pass Criteria**: Frontend HTML loads in browser

### Test 5.2: Navigation Bar
- [ ] Verify navigation buttons are visible
- [ ] Check navigation includes: Dashboard, Workflows, Agents, Executions, Versions, etc.
- **Pass Criteria**: Navigation UI is present and visible

### Test 5.3: Dashboard View
- [ ] Click on Dashboard (or load by default)
- [ ] Verify dashboard content loads
- [ ] Check for any stats or overview information
- **Pass Criteria**: Dashboard view displays correctly

### Test 5.4: View Switching
- [ ] Click on "Workflows" navigation button
- [ ] Verify view switches to workflows
- [ ] Click on "Agents" navigation button
- [ ] Verify view switches to agents
- [ ] Try 2-3 different views
- **Pass Criteria**: Navigation between views works

**Stage 5 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 6: Workflow + Agent Integration 🔄

**Prerequisites**: Stage 5 must be ✅ Passed

### Test 6.1: Run Workflow That Creates Agent
- [ ] Run a workflow that queues an agent: `kad workflow run execute-features` (or similar)
- [ ] Verify workflow execution starts
- [ ] Check execution status
- **Pass Criteria**: Workflow executes and creates agent tasks

### Test 6.2: Agent Appears in Queue
- [ ] After workflow runs, check `kad agent list`
- [ ] Verify agent task appears in the list
- [ ] Check agent status: `kad agent status <agent-id>`
- **Pass Criteria**: Agent is queued and visible

### Test 6.3: Agent Processing
- [ ] With agent processor running, wait for agent to be processed
- [ ] Check agent status changes (ready → processing → completed/failed)
- [ ] Verify agent processor logs show activity
- **Pass Criteria**: Agent is processed by the system

### Test 6.4: Workflow Execution Status in UI
- [ ] In frontend, navigate to "Executions" view
- [ ] Verify workflow execution appears in the list
- [ ] Check execution details are visible
- **Pass Criteria**: Executions are visible in UI

**Stage 6 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 7: Version Management 📦

**Prerequisites**: Stage 6 must be ✅ Passed

### Test 7.1: List Versions
- [ ] Run `kad scan` or check versions directory
- [ ] Verify versions are detected
- [ ] In UI, navigate to "Versions" view
- [ ] Verify versions appear in UI
- **Pass Criteria**: Versions can be listed via CLI and UI

### Test 7.2: Version Details
- [ ] In UI, click on a version
- [ ] Verify version details are shown
- [ ] Check for version structure (plan, implement, test, review stages)
- **Pass Criteria**: Version details display correctly

### Test 7.3: Progress Files
- [ ] Check if progress files exist: `progress/version0-*.md`
- [ ] Verify progress files are readable
- [ ] Check if workflow can read/write progress files
- **Pass Criteria**: Progress file system works

### Test 7.4: Review Files
- [ ] Check if review files exist: `review/version0-*.md`
- [ ] Verify review files are readable
- [ ] Check if workflow can read/write review files
- **Pass Criteria**: Review file system works

**Stage 7 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 8: Advanced Workflow Features 🚀

**Prerequisites**: Stage 7 must be ✅ Passed

### Test 8.1: Workflow with Multiple Steps
- [ ] Run a complex workflow with multiple steps
- [ ] Verify each step executes in order
- [ ] Check step statuses during execution
- **Pass Criteria**: Multi-step workflow executes correctly

### Test 8.2: Conditional Workflow Logic
- [ ] Run a workflow with conditional steps (if/then/else)
- [ ] Verify correct branch is taken based on conditions
- **Pass Criteria**: Conditional logic works as expected

### Test 8.3: Workflow Error Handling
- [ ] Run a workflow that intentionally fails at a step
- [ ] Verify error is caught and logged
- [ ] Check workflow status shows error state
- **Pass Criteria**: Errors are handled gracefully

### Test 8.4: Workflow Resume/Retry
- [ ] If a workflow fails, try to resume it: `kad workflow resume <execution-id>`
- [ ] Verify workflow can be resumed from failure point
- **Pass Criteria**: Failed workflows can be resumed

**Stage 8 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 9: Agent Execution Features ⚡

**Prerequisites**: Stage 8 must be ✅ Passed

### Test 9.1: Simple Task Execution
- [ ] Queue an agent with a simple task (e.g., "Create a test file")
- [ ] Verify agent executes the task
- [ ] Check that the task result is correct
- **Pass Criteria**: Simple tasks are executed successfully

### Test 9.2: Agent Debugging
- [ ] Run `kad agent debug <agent-id>`
- [ ] Verify debug information is displayed
- [ ] Check for logs, status, and error information
- **Pass Criteria**: Debug command provides useful information

### Test 9.3: Agent Completion
- [ ] After agent completes, verify task completion workflow runs
- [ ] Check that progress files are updated
- [ ] Verify agent status changes to "completed"
- **Pass Criteria**: Agent completion updates system state

### Test 9.4: Agent Failure Handling
- [ ] Queue an agent with an invalid/impossible task
- [ ] Verify agent fails gracefully
- [ ] Check error is logged and status updated
- **Pass Criteria**: Agent failures are handled properly

**Stage 9 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Stage 10: Full System Integration 🎯

**Prerequisites**: Stage 9 must be ✅ Passed

### Test 10.1: End-to-End Workflow
- [ ] Run a complete workflow from start to finish
- [ ] Verify all steps execute
- [ ] Check that agents are created and processed
- [ ] Verify final state is correct
- **Pass Criteria**: Complete workflow executes successfully

### Test 10.2: UI Updates During Execution
- [ ] Start a workflow execution
- [ ] In UI, navigate to "Executions" view
- [ ] Verify execution status updates in real-time (or on refresh)
- [ ] Check agent status updates in "Agents" view
- **Pass Criteria**: UI reflects execution state

### Test 10.3: Multiple Concurrent Workflows
- [ ] Start 2-3 workflows simultaneously
- [ ] Verify all workflows execute
- [ ] Check that agents are queued and processed
- [ ] Verify no conflicts or race conditions
- **Pass Criteria**: Concurrent workflows work correctly

### Test 10.4: System Recovery
- [ ] Stop the API server during a workflow execution
- [ ] Restart the API server
- [ ] Verify system recovers gracefully
- [ ] Check that workflow state is preserved
- **Pass Criteria**: System recovers from interruption

**Stage 10 Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Notes**:
```
[Record any issues or observations here]
```

---

## Testing Summary

### Overall Status
- **Current Stage**: Stage X
- **Total Stages Passed**: X / 10
- **Last Tested**: [Date]

### Critical Issues Found
```
[List any critical issues that block progression]
```

### Minor Issues Found
```
[List minor issues that don't block progression]
```

### Recommendations
```
[Any recommendations for improvements]
```

---

## Quick Reference Commands

```bash
# CLI Basics
kad --help
kad init

# Workflows
kad workflow list
kad workflow show <name>
kad workflow validate <name>
kad workflow run <name>
kad workflow status <execution-id>
kad workflow resume <execution-id>

# Agents
kad agent list
kad agent status [<agent-id>]
kad agent start
kad agent stop
kad agent debug <agent-id>
kad agent process

# API
npm run api
# or
kad api start

# Scanning
kad scan
```

---

## Notes

- Mark each test with ✅ (passed) or ❌ (failed)
- Update stage status as you progress
- Document any issues in the Notes section for each stage
- Only proceed to next stage when current stage is ✅ Passed
- If a test fails, investigate and fix before continuing


