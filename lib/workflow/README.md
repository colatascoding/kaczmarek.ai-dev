# Workflow Engine

The workflow engine provides orchestration for complex multi-step processes with conditional routing and state management.

## Features

- **YAML-based workflows** - Define workflows in version-controllable YAML files
- **Module system** - Extensible action modules
- **State persistence** - SQLite database for execution state
- **Conditional routing** - Outcome-based next step selection
- **Execution tracking** - Full history and status monitoring

## Quick Start

### 1. Create a Workflow

Create a YAML file in the `workflows/` directory:

```yaml
name: "My Workflow"
version: "1.0.0"
steps:
  - id: "step1"
    module: "system"
    action: "log"
    inputs:
      message: "Hello, World!"
    onSuccess: "step2"
    onFailure: "error-handler"
```

### 2. List Workflows

```bash
kad workflow list
```

### 3. Run a Workflow

```bash
kad workflow run my-workflow --param1 value1
```

### 4. Check Status

```bash
kad workflow status <execution-id>
```

## Workflow Structure

```yaml
name: "Workflow Name"
version: "1.0.0"
description: "Optional description"

triggers:
  - type: "cli"
    command: "kad workflow run my-workflow"

steps:
  - id: "step-id"
    module: "module-name"
    action: "action-name"
    inputs:
      key: "value"
      template: "{{ trigger.param }}"
    outputs:
      - name: "output-name"
        type: "string"
    onSuccess: "next-step-id"
    onFailure: "error-handler-id"
    timeout: 300
    maxRetries: 3
```

## Modules

Modules are located in `lib/modules/` and export actions:

```javascript
module.exports = {
  name: "my-module",
  version: "1.0.0",
  actions: {
    "my-action": async (inputs, context) => {
      // inputs: resolved input values
      // context: { logger, executionId, stepId, state }
      
      return {
        result: "success",
        data: {}
      };
    }
  }
};
```

## Built-in Modules

### System Module

- `log` - Log messages
- `wait` - Wait for specified seconds
- `handle-error` - Handle errors
- `notify-completion` - Notify workflow completion

## Template Variables

Use `{{ }}` syntax for template variables:

- `{{ trigger.param }}` - Access trigger parameters
- `{{ steps.step-id.outputs.key }}` - Access step outputs
- `{{ workflow.executionId }}` - Access workflow metadata

## CLI Commands

- `kad workflow list` - List all workflows
- `kad workflow run <name> [--params]` - Run a workflow
- `kad workflow status <execution-id>` - Check execution status
- `kad workflow validate <file>` - Validate a workflow file
- `kad workflow show <name>` - Show workflow details

## Database

Workflow state is stored in SQLite at `.kaczmarek-ai/workflows.db`:

- `workflows` - Workflow definitions
- `executions` - Workflow executions
- `step_executions` - Individual step results
- `execution_history` - Audit trail

## Examples

See `workflows/example-simple.yaml` for a basic example.

