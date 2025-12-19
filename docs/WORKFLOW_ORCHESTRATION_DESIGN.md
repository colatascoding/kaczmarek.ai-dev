# Workflow Orchestration System Design

**Version**: 0.1.0  
**Status**: Design Proposal  
**Last updated**: 2025-01-XX

## Problem Statement

Current CLI is too simple for complex workflows. Need:
- **Event-driven triggers** - CLI as trigger emitter
- **Complex workflows** - Multi-step processes with conditional logic
- **Module-based** - Separate modules (testing, implementing, refactoring, bug fixing, documentation)
- **Outcome-based routing** - Different next steps based on outcomes
- **State persistence** - Track workflow execution state

## Requirements Analysis

### Core Requirements

1. **Trigger System**
   - CLI commands emit events/triggers
   - Events can be manual (CLI) or automatic (scheduled, webhooks)

2. **Workflow Modules**
   - Testing module
   - Implementing new features module
   - Refactoring module
   - Bug fixing module
   - Documentation module

3. **Outcome-Based Routing**
   - Each step produces outcomes
   - Outcomes determine next steps
   - Conditional branching (if/then/else)

4. **State Management**
   - Persist workflow execution state
   - Resume failed workflows
   - Track history

5. **Local-First Principle**
   - Must work offline
   - No external dependencies for core functionality
   - Database should be local (SQLite)

## Technology Evaluation

### Option 1: n8n (Visual Workflow Automation)

**Pros:**
- Visual workflow builder (no-code)
- Self-hosted
- Built-in integrations
- Good for non-technical users

**Cons:**
- Requires separate service/container
- Overkill for simple workflows
- Not local-first (needs server)
- Harder to version control workflows
- Additional infrastructure

**Verdict**: ❌ Too heavy, conflicts with local-first principle

### Option 2: Temporal (Workflow Orchestration Framework)

**Pros:**
- Industry-standard workflow engine
- Excellent for complex workflows
- Built-in retries, timeouts, state management
- Code-based (version controllable)

**Cons:**
- Requires Temporal server (infrastructure)
- Steep learning curve
- Overkill for this use case
- Not local-first

**Verdict**: ❌ Too complex, requires infrastructure

### Option 3: Custom Workflow Engine (Recommended)

**Pros:**
- ✅ Local-first (SQLite database)
- ✅ Lightweight (no external services)
- ✅ Version controllable (YAML/JSON workflows)
- ✅ CLI integration (keep existing CLI)
- ✅ Flexible (can add features as needed)
- ✅ Fits kaczmarek.ai-dev philosophy

**Cons:**
- Need to build it
- Less features than Temporal/n8n initially

**Verdict**: ✅ **RECOMMENDED** - Best fit for requirements

### Option 4: Hybrid (CLI + Lightweight Workflow Engine)

**Pros:**
- Keep existing CLI
- Add workflow engine as library
- Use SQLite for state
- YAML/JSON workflow definitions
- Can integrate with n8n/Temporal later if needed

**Cons:**
- Need to build workflow engine
- Less mature than existing solutions

**Verdict**: ✅ **RECOMMENDED** - Best balance

## Recommended Architecture

### Hybrid Approach: CLI + Workflow Engine

```
┌─────────────────┐
│   CLI (kad)     │  ← Trigger emitter
│  (Node.js)      │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Event Bus      │  ← Event routing
│  (In-memory)    │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│ Workflow Engine │  ← Workflow execution
│  (Node.js)      │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  State Store    │  ← SQLite database
│  (SQLite)       │
└─────────────────┘
```

### Technology Stack

- **Runtime**: Node.js (keep existing)
- **Database**: SQLite (local-first, no server needed)
- **Workflow Definition**: YAML/JSON (version controllable)
- **Workflow Engine**: Custom (lightweight, fits needs)

## Architecture Design

### 1. Workflow Definition Format

**YAML-based workflow definition** (`workflows/implement-feature.yaml`):

```yaml
name: "Implement New Feature"
version: "1.0.0"
description: "Complete workflow for implementing a new feature"

triggers:
  - type: "cli"
    command: "kad workflow implement-feature"
    params:
      - name: "feature"
        type: "string"
        required: true

steps:
  - id: "analyze"
    module: "analysis"
    action: "analyze-requirements"
    inputs:
      feature: "{{ trigger.feature }}"
    outputs:
      - name: "complexity"
        type: "string"
      - name: "estimatedTime"
        type: "number"
    onSuccess: "plan"
    onFailure: "error-handler"

  - id: "plan"
    module: "planning"
    action: "create-implementation-plan"
    inputs:
      feature: "{{ trigger.feature }}"
      complexity: "{{ steps.analyze.outputs.complexity }}"
    outputs:
      - name: "plan"
        type: "object"
    onSuccess: "implement"
    onFailure: "error-handler"

  - id: "implement"
    module: "implementation"
    action: "implement-feature"
    inputs:
      plan: "{{ steps.plan.outputs.plan }}"
    outputs:
      - name: "codeChanges"
        type: "array"
    onSuccess: "test"
    onFailure: "rollback"

  - id: "test"
    module: "testing"
    action: "run-tests"
    inputs:
      changes: "{{ steps.implement.outputs.codeChanges }}"
    outputs:
      - name: "testResults"
        type: "object"
        properties:
          passed: "boolean"
          coverage: "number"
    onSuccess:
      condition: "{{ steps.test.outputs.testResults.passed }}"
      then: "document"
      else: "fix-tests"
    onFailure: "error-handler"

  - id: "fix-tests"
    module: "testing"
    action: "fix-failing-tests"
    inputs:
      testResults: "{{ steps.test.outputs.testResults }}"
    onSuccess: "test"  # Retry testing
    onFailure: "error-handler"
    maxRetries: 3

  - id: "document"
    module: "documentation"
    action: "update-docs"
    inputs:
      feature: "{{ trigger.feature }}"
      changes: "{{ steps.implement.outputs.codeChanges }}"
    onSuccess: "review"
    onFailure: "error-handler"

  - id: "review"
    module: "review"
    action: "create-pr"
    inputs:
      feature: "{{ trigger.feature }}"
      changes: "{{ steps.implement.outputs.codeChanges }}"
    onSuccess: "complete"
    onFailure: "error-handler"

  - id: "rollback"
    module: "implementation"
    action: "rollback-changes"
    inputs:
      changes: "{{ steps.implement.outputs.codeChanges }}"
    onSuccess: "error-handler"
    onFailure: "error-handler"

  - id: "error-handler"
    module: "system"
    action: "handle-error"
    inputs:
      error: "{{ workflow.error }}"
    onSuccess: "complete"
    onFailure: "complete"  # Always complete, even on error

  - id: "complete"
    module: "system"
    action: "notify-completion"
    inputs:
      status: "{{ workflow.status }}"
```

### 2. Module System

**Module Structure** (`modules/testing/index.js`):

```javascript
module.exports = {
  name: "testing",
  version: "1.0.0",
  actions: {
    "run-tests": async (inputs, context) => {
      const { changes } = inputs;
      const { logger, executor } = context;
      
      logger.info("Running tests...");
      
      // Execute test command
      const result = await executor.run("npm test");
      
      return {
        passed: result.exitCode === 0,
        coverage: result.coverage || 0,
        output: result.stdout
      };
    },
    
    "fix-failing-tests": async (inputs, context) => {
      const { testResults } = inputs;
      const { logger, aiAgent } = context;
      
      logger.info("Fixing failing tests...");
      
      // Use AI agent to fix tests
      const fix = await aiAgent.fixTests(testResults);
      
      return {
        fixed: fix.success,
        changes: fix.changes
      };
    }
  }
};
```

### 3. Database Schema (SQLite)

```sql
-- Workflow definitions
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  definition TEXT NOT NULL,  -- JSON/YAML
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workflow executions
CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_data TEXT,  -- JSON
  status TEXT NOT NULL,  -- running, completed, failed, paused
  current_step TEXT,
  state TEXT,  -- JSON (workflow state)
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- Step executions
CREATE TABLE step_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  inputs TEXT,  -- JSON
  outputs TEXT,  -- JSON
  status TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error TEXT,
  FOREIGN KEY (execution_id) REFERENCES executions(id)
);

-- Workflow history
CREATE TABLE execution_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- step_started, step_completed, step_failed
  step_id TEXT,
  data TEXT,  -- JSON
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES executions(id)
);
```

### 4. CLI Integration

**Enhanced CLI command** (`bin/kad.js`):

```javascript
function cmdWorkflow(argv) {
  const [subcommand, ...rest] = argv;
  
  switch (subcommand) {
    case "run":
      // Run a workflow
      const workflowName = rest[0];
      const params = parseParams(rest.slice(1));
      runWorkflow(workflowName, params);
      break;
      
    case "list":
      // List available workflows
      listWorkflows();
      break;
      
    case "status":
      // Check workflow execution status
      const executionId = rest[0];
      showWorkflowStatus(executionId);
      break;
      
    case "resume":
      // Resume paused/failed workflow
      const execId = rest[0];
      resumeWorkflow(execId);
      break;
      
    case "define":
      // Define new workflow interactively
      defineWorkflow();
      break;
  }
}
```

### 5. Workflow Engine Core

**Workflow Engine** (`lib/workflow-engine.js`):

```javascript
class WorkflowEngine {
  constructor(db, modules) {
    this.db = db;
    this.modules = modules;
    this.executions = new Map();
  }
  
  async execute(workflowId, triggerData) {
    // Load workflow definition
    const workflow = await this.loadWorkflow(workflowId);
    
    // Create execution record
    const execution = await this.createExecution(workflowId, triggerData);
    
    // Execute workflow steps
    await this.executeSteps(execution, workflow);
    
    return execution;
  }
  
  async executeSteps(execution, workflow) {
    let currentStep = workflow.steps[0];
    const state = {};
    
    while (currentStep) {
      // Execute step
      const result = await this.executeStep(
        execution,
        currentStep,
        state
      );
      
      // Update state
      state[currentStep.id] = result;
      
      // Determine next step based on outcome
      currentStep = this.determineNextStep(
        currentStep,
        result,
        workflow
      );
    }
  }
  
  determineNextStep(step, result, workflow) {
    if (result.status === "success") {
      if (step.onSuccess) {
        if (typeof step.onSuccess === "string") {
          return workflow.steps.find(s => s.id === step.onSuccess);
        } else if (step.onSuccess.condition) {
          // Evaluate condition
          const conditionMet = this.evaluateCondition(
            step.onSuccess.condition,
            result
          );
          return conditionMet
            ? workflow.steps.find(s => s.id === step.onSuccess.then)
            : workflow.steps.find(s => s.id === step.onSuccess.else);
        }
      }
    } else if (result.status === "failure") {
      if (step.onFailure) {
        return workflow.steps.find(s => s.id === step.onFailure);
      }
    }
    
    return null; // Workflow complete
  }
}
```

## Module Definitions

### Testing Module

```yaml
module: testing
version: 1.0.0
actions:
  - name: run-tests
    description: Run test suite
    inputs:
      - name: changes
        type: array
    outputs:
      - name: testResults
        type: object
  
  - name: fix-failing-tests
    description: Fix failing tests using AI
    inputs:
      - name: testResults
        type: object
    outputs:
      - name: fixed
        type: boolean
```

### Implementation Module

```yaml
module: implementation
version: 1.0.0
actions:
  - name: implement-feature
    description: Implement feature using AI agent
    inputs:
      - name: plan
        type: object
    outputs:
      - name: codeChanges
        type: array
  
  - name: rollback-changes
    description: Rollback code changes
    inputs:
      - name: changes
        type: array
```

### Documentation Module

```yaml
module: documentation
version: 1.0.0
actions:
  - name: update-docs
    description: Update documentation
    inputs:
      - name: feature
        type: string
      - name: changes
        type: array
```

## Usage Examples

### Example 1: Run Workflow

```bash
# Run implement-feature workflow
kad workflow run implement-feature --feature "User authentication"

# Check status
kad workflow status <execution-id>

# Resume if paused
kad workflow resume <execution-id>
```

### Example 2: Define Workflow

```bash
# Interactive workflow definition
kad workflow define

# Or create YAML file manually
# workflows/my-workflow.yaml
```

### Example 3: List Workflows

```bash
# List all available workflows
kad workflow list

# Show workflow details
kad workflow show implement-feature
```

## Comparison with n8n

| Feature | n8n | Custom Engine |
|---------|-----|---------------|
| Local-first | ❌ | ✅ |
| No infrastructure | ❌ | ✅ |
| Version control | ⚠️ | ✅ |
| Visual editor | ✅ | ❌ (can add later) |
| Code-based | ❌ | ✅ |
| Lightweight | ❌ | ✅ |
| CLI integration | ⚠️ | ✅ |
| Learning curve | Low | Medium |

## Implementation Plan

### Phase 1: Core Engine
- [ ] SQLite database setup
- [ ] Workflow definition parser (YAML)
- [ ] Basic workflow execution engine
- [ ] Step execution with modules

### Phase 2: Module System
- [ ] Module loader
- [ ] Testing module
- [ ] Implementation module
- [ ] Documentation module

### Phase 3: CLI Integration
- [ ] `kad workflow` commands
- [ ] Workflow execution from CLI
- [ ] Status monitoring

### Phase 4: Advanced Features
- [ ] Conditional routing
- [ ] Retries and error handling
- [ ] Workflow resumption
- [ ] History and logging

### Phase 5: Visual Editor (Optional)
- [ ] Web-based workflow editor
- [ ] Visual workflow builder
- [ ] Export to YAML

## Recommendation

**Use Custom Workflow Engine** because:
1. ✅ Fits local-first philosophy
2. ✅ No infrastructure required
3. ✅ Version controllable (YAML in git)
4. ✅ CLI integration
5. ✅ Flexible and extensible
6. ✅ Can add visual editor later if needed

**n8n is NOT suitable** because:
- ❌ Requires server infrastructure
- ❌ Not local-first
- ❌ Harder to version control
- ❌ Overkill for this use case

## Next Steps

1. Review and refine design
2. Implement core workflow engine
3. Create module system
4. Integrate with CLI
5. Add workflow definitions for common tasks

