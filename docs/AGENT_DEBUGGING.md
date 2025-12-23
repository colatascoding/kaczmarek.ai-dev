# Agent Debugging Guide

## Overview

This guide explains how to debug agent tasks when they fail or don't process correctly.

## Quick Debug Commands

### List All Tasks
```bash
./kad agent list
```

Shows all agent tasks with their status:
- `✓` = ready
- `✗` = failed  
- `⟳` = processing
- `○` = queued

### Debug a Specific Task
```bash
./kad agent debug <task-id>
```

Shows detailed information about a task:
- Status and type
- Creation/processing timestamps
- Error messages (if any)
- Task list
- Prompt information
- Full history

### Check Task Status
```bash
./kad agent status <task-id>
```

Quick status check for a task.

## Common Issues and Solutions

### 1. Tasks Stuck in "queued" Status

**Problem**: Tasks remain queued and never process.

**Solution**:
```bash
# Start the background processor
./kad agent start

# Or manually process a task
./kad agent process <task-id>
```

### 2. Tasks Marked as "failed"

**Problem**: Tasks fail during processing.

**Debug Steps**:
```bash
# Get detailed error information
./kad agent debug <task-id>

# Check the error message and suggestions
```

**Common Causes**:
- **Permission errors (EPERM)**: Normal in sandboxed environments. Task is still marked as "ready" and can be used.
- **Missing files**: Check that required files exist
- **Invalid task data**: Task may have been created incorrectly

**Solution**:
```bash
# Reset failed tasks to queued
for file in .kaczmarek-ai/agent-queue/*.json; do
  node -e "
    const fs = require('fs');
    const t = JSON.parse(fs.readFileSync('$file'));
    if (t.status === 'failed') {
      t.status = 'queued';
      delete t.error;
      delete t.failedAt;
      delete t.processingStartedAt;
      fs.writeFileSync('$file', JSON.stringify(t, null, 2));
    }
  "
done

# Then process again
./kad agent process <task-id>
```

### 3. Tasks Have 0 Tasks

**Problem**: Task shows "0 tasks" in the list.

**Cause**: The workflow may not have properly extracted next steps from the review file.

**Solution**:
1. Check the review file has "Next Steps" section
2. Verify tasks are in markdown format: `- [ ] Task description`
3. Re-run the workflow: `./kad workflow run execute-features`

### 4. Permission Errors

**Problem**: `EPERM: operation not permitted` errors.

**Explanation**: This happens when the processor tries to write to `.cursor/agent-processing.json` but doesn't have permissions (common in sandboxed environments).

**Solution**: This is handled gracefully. The task is still marked as "ready" and can be processed. The context file creation is optional.

## Debugging Workflow

1. **Check task status**:
   ```bash
   ./kad agent list
   ```

2. **Get detailed information**:
   ```bash
   ./kad agent debug <task-id>
   ```

3. **Review error messages**:
   - Look for specific error types
   - Check the suggestions provided
   - Review task history

4. **Fix and retry**:
   - Reset failed tasks if needed
   - Re-process tasks
   - Check workflow configuration

## Task File Location

Task files are stored in:
```
.kaczmarek-ai/agent-queue/<task-id>.json
```

You can inspect them directly:
```bash
cat .kaczmarek-ai/agent-queue/<task-id>.json | jq .
```

## Task States

- **queued**: Task is waiting to be processed
- **processing**: Task is currently being processed
- **ready**: Task is ready for Cursor Chat integration
- **failed**: Task encountered an error (check debug output)

## Error Types

The debugger automatically categorizes errors:

- **permission_error**: File system permission issues
- **file_not_found**: Missing files or directories
- **parse_error**: JSON parsing failures
- **module_error**: Module loading issues

## Agent Filtering and Sorting

### Overview

The agent management UI includes powerful filtering and sorting capabilities to help you find and manage agent tasks efficiently. These features are available in the web interface at `/agents`.

### Filtering Agents

#### By Status

Filter agents by their current status:

```
Status Filter Options:
- All Statuses (default)
- queued    - Task is waiting to be processed
- processing - Task is currently being processed
- ready     - Task is ready for Cursor Chat
- completed - Task has been completed
- failed    - Task encountered an error
- partial   - Task partially completed
```

**How to use:**
1. Open the web interface: `./kad api start` then visit http://localhost:3000
2. Navigate to the "Agents" tab
3. Use the "Status" dropdown to select a status
4. The list will automatically update to show only agents with that status

**Result count:**
When filtered, the UI shows: "Showing X of Y agents" where X is the filtered count and Y is the total.

#### By Workflow

Filter agents by the workflow that created them:

```
Workflow Filter Options:
- All Workflows (default)
- [List of all workflows that have created agents]
```

**How to use:**
1. Select a workflow from the "Workflow" dropdown
2. The list will show only agents created by that workflow
3. Workflow names are automatically populated from existing agents

**Use cases:**
- See all agents from the "execute-features" workflow
- Find agents related to a specific review cycle
- Debug workflow-specific issues

### Sorting Agents

The agent list can be sorted by multiple criteria:

```
Sort Options:
- newest       - Most recent agents first (default)
- oldest       - Oldest agents first
- name-asc     - Agent name A-Z
- name-desc    - Agent name Z-A
- status       - Alphabetically by status
- tasks-asc    - Fewest tasks first
- tasks-desc   - Most tasks first
```

**How to use:**
1. Select a sort option from the "Sort by" dropdown
2. The list will automatically re-sort

**Examples:**
- `newest` - See what agents were created most recently
- `tasks-desc` - Find agents with the most work to do
- `status` - Group agents by their current status

### Combined Filtering and Sorting

Filters and sorting work together:

**Example 1: Find recent failed agents**
- Status: `failed`
- Sort: `newest`
- Result: Most recent failed agents first

**Example 2: Find ready agents with most tasks**
- Status: `ready`
- Sort: `tasks-desc`
- Result: Ready agents sorted by task count (most first)

**Example 3: Find all agents from a workflow**
- Workflow: `execute-features`
- Sort: `newest`
- Result: All execute-features agents, most recent first

### Agent Count Display

The UI displays helpful count information:

- **When not filtered**: "5 agents" (total count)
- **When filtered**: "Showing 2 of 5 agents" (filtered / total)
- **When no results**: "No agents match the current filters"

### Implementation Details

Location: `frontend/views/agents.js`

#### Filter Implementation

```javascript
function filterAndSortAgents() {
  let filtered = [...allAgents];
  
  // Apply status filter
  const statusFilter = document.getElementById("agent-status-filter")?.value || "all";
  if (statusFilter !== "all") {
    filtered = filtered.filter(agent => agent.status === statusFilter);
  }
  
  // Apply workflow filter
  const workflowFilter = document.getElementById("agent-workflow-filter")?.value || "all";
  if (workflowFilter !== "all") {
    filtered = filtered.filter(agent => 
      agent.workflow && agent.workflow.id === workflowFilter
    );
  }
  
  // Apply sorting...
  renderAgents(filtered, "agents-list");
}
```

#### Sort Implementation

```javascript
filtered.sort((a, b) => {
  switch (sortBy) {
    case "newest":
      const dateA = new Date(a.createdAt || a.startedAt || 0);
      const dateB = new Date(b.createdAt || b.startedAt || 0);
      return dateB - dateA;  // Descending (newest first)
    
    case "tasks-desc":
      return (b.tasks?.length || 0) - (a.tasks?.length || 0);
    
    case "status":
      return (a.status || "").localeCompare(b.status || "");
    
    // ... more sort options
  }
});
```

#### Workflow Filter Population

The workflow filter is automatically populated from available agents:

```javascript
function populateWorkflowFilter(agents) {
  const workflowFilter = document.getElementById("agent-workflow-filter");
  
  // Get unique workflows
  const workflows = new Map();
  agents.forEach(agent => {
    if (agent.workflow && agent.workflow.name) {
      workflows.set(agent.workflow.id, agent.workflow.name);
    }
  });
  
  // Clear and repopulate
  workflowFilter.innerHTML = '<option value="all">All Workflows</option>';
  
  // Add workflow options (sorted alphabetically)
  Array.from(workflows.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([id, name]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      workflowFilter.appendChild(option);
    });
}
```

### Auto-Completion Logic

The agent loading system includes auto-completion detection:

```javascript
async function loadAgents() {
  const data = await window.apiCall("/api/agents");
  allAgents = data.agents || [];
  
  // Filter out auto-completed placeholder agents
  allAgents = allAgents.filter(agent => {
    // Keep agents that:
    // - Have tasks to complete
    // - Are not auto-completed placeholders
    // - Have valid execution data
    return agent.tasks?.length > 0 && 
           !agent.autoCompleted &&
           (agent.status !== "completed" || agent.hasRealWork);
  });
  
  populateWorkflowFilter(allAgents);
  filterAndSortAgents();
}
```

### Best Practices

1. **Use status filters** to focus on actionable agents (e.g., `ready` or `failed`)
2. **Sort by newest** when debugging recent workflow runs
3. **Sort by tasks-desc** to prioritize agents with more work
4. **Filter by workflow** when investigating workflow-specific issues
5. **Combine filters** for precise agent selection

### Common Workflows

#### Finding Failed Agents
1. Filter: Status = `failed`
2. Sort: `newest`
3. Review error messages and debug

#### Processing Ready Tasks
1. Filter: Status = `ready`
2. Sort: `tasks-desc`
3. Work on agents with most tasks first

#### Workflow Analysis
1. Filter: Workflow = `execute-features`
2. Sort: `newest`
3. Review execution patterns and outcomes

#### Task Completion Tracking
1. Filter: Status = `completed`
2. Sort: `newest`
3. Verify recent completions

## Getting Help

If tasks continue to fail:

1. Run `./kad agent debug <task-id>` for detailed information
2. Check the error message and suggestions
3. Verify workflow configuration
4. Check that review/progress files exist and are properly formatted
5. Ensure the background processor is running (if using automatic processing)
6. Use the web UI's filtering and sorting features to identify patterns in failures


