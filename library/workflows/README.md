# Workflow Library

Reusable workflows organized by category.

## Categories

- [Version Management](./version-management/) - Version lifecycle workflows
- [Implementation](./implementation/) - Feature implementation workflows
- [Review](./review/) - Review and analysis workflows
- [Testing](./testing/) - Testing workflows
- [Common](./common/) - Shared utility workflows

## Usage

```bash
# List all workflows
kad library workflows list

# List workflows by category
kad library workflows list --category implementation

# Show workflow details
kad library workflows show implementation/execute-features

# Run workflow from library
kad library workflows run implementation/execute-features --maxTasks 5

# Copy workflow to active
kad library workflows copy implementation/execute-features
```

