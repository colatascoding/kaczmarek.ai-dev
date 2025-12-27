# Workflow & Dashboard Library

This library contains reusable workflows, dashboards, and templates organized by category.

## Workflows

- [Version Management](./workflows/version-management/) - Version lifecycle workflows
- [Implementation](./workflows/implementation/) - Feature implementation workflows
- [Review](./workflows/review/) - Review and analysis workflows
- [Testing](./workflows/testing/) - Testing workflows
- [Common](./workflows/common/) - Shared utility workflows

## Dashboards

- [Version Overview](./dashboards/version-overview/) - Version status dashboards
- [Execution Monitoring](./dashboards/execution-monitoring/) - Execution tracking dashboards
- [Project Health](./dashboards/project-health/) - Project metrics dashboards

## Templates

- [Workflow Templates](./templates/workflow-templates/) - Reusable workflow templates
- [Dashboard Templates](./templates/dashboard-templates/) - Reusable dashboard templates

## Usage

### Using Workflows

```bash
# List workflows by category
kad library workflows list --category implementation

# Run a workflow from library
kad library workflows run implementation/execute-features

# Copy workflow to active workflows
kad library workflows copy implementation/execute-features
```

### Using Dashboards

```bash
# List dashboards
kad library dashboards list

# Load a dashboard
kad library dashboards load version-overview/version-status
```

