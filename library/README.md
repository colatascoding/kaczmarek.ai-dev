# Workflow & Dashboard Library

This library contains reusable workflows, dashboards, and templates organized by category.

## Workflows

- [Version Management](./workflows/version-management/) - Version lifecycle workflows
- [Implementation](./workflows/implementation/) - Feature implementation workflows
- [Review](./workflows/review/) - Review and analysis workflows
- [Planning](./workflows/planning/) - Planning workflows with decision points
- [Testing](./workflows/testing/) - Testing workflows
- [Common](./workflows/common/) - Shared utility workflows

## Decision Paths & User Interaction

Workflows can pause execution and wait for user decisions using the `wait-for-decision` action. This enables interactive workflows where the system generates proposals and waits for your approval.

### Example: Planning with Decisions

```yaml
- id: "get-approval"
  module: "system"
  action: "wait-for-decision"
  inputs:
    title: "Review Proposals"
    description: "Please review and select an option"
    proposals:
      - id: "approve"
        label: "Approve"
        description: "Proceed with changes"
      - id: "reject"
        label: "Reject"
        description: "Skip this step"
  onSuccess:
    condition: "{{ steps.get-approval.outputs.decision }} === 'approve'"
    then: "apply-changes"
    else: "skip-changes"
```

### Decision Flow

1. **Workflow pauses** when it reaches a `wait-for-decision` step
2. **Proposals appear** in the UI for review
3. **User selects** an option
4. **Workflow resumes** based on the decision
5. **Conditional routing** uses the decision in `onSuccess` conditions

### Using Decisions in Workflows

- Decisions are stored in step outputs: `{{ steps.step-id.outputs.decision }}`
- Use conditional routing to branch based on decisions
- Multiple decision points can be chained for complex flows
- Decisions are persisted in the database for audit trails

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

