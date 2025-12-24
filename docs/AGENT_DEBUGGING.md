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

## Getting Help

If tasks continue to fail:

1. Run `./kad agent debug <task-id>` for detailed information
2. Check the error message and suggestions
3. Verify workflow configuration
4. Check that review/progress files exist and are properly formatted
5. Ensure the background processor is running (if using automatic processing)

---

## Agent Filtering and Sorting

### Overview

The agent management frontend provides powerful filtering and sorting capabilities to help you find and manage agent tasks efficiently. This is especially useful when you have many agents running simultaneously.

### Accessing the Agent View

1. Open the kaczmarek.ai-dev frontend: `http://localhost:3000`
2. Navigate to the **Agents** tab
3. You'll see all agent tasks with filter and sort controls at the top

### Filter Options

#### 1. Status Filter

Filter agents by their current status:

| Status | Description | When to Use |
|--------|-------------|-------------|
| **All** | Show all agents regardless of status | Default view to see everything |
| **ready** | Agents ready for Cursor Chat integration | Find tasks ready to implement |
| **queued** | Agents waiting to be processed | See pending work |
| **processing** | Agents currently being processed | Monitor active tasks |
| **failed** | Agents that encountered errors | Troubleshoot issues |
| **completed** | Agents that finished successfully | Review completed work |

**Example Use Cases:**

- **Find work to do**: Filter by `ready` to see tasks ready for implementation
- **Monitor progress**: Filter by `processing` to see what's currently running
- **Debug issues**: Filter by `failed` to identify and fix errors
- **Review history**: Filter by `completed` to see what's been done

**CLI Equivalent:**
```bash
# List only failed agents
./kad agent list | grep "✗"

# List only ready agents
./kad agent list | grep "✓"
```

#### 2. Workflow Filter

Filter agents by the workflow that created them:

```
All Workflows ▼
├── execute-features (12 agents)
├── review-self (5 agents)
├── test-features (3 agents)
└── create-version (1 agent)
```

**How it Works:**
- The dropdown is automatically populated with workflows that have created agents
- Shows workflow name (not ID) for better readability
- Sorted alphabetically for easy navigation
- Updates dynamically as new agents are created

**Example Use Cases:**

- **Track feature implementation**: Filter by `execute-features` to see all feature tasks
- **Review workflow**: Filter by `review-self` to see review-related agents
- **Debug specific workflow**: Isolate agents from a problematic workflow

**Implementation Details:**
```javascript
// Frontend: frontend/views/agents.js
function populateWorkflowFilter(agents) {
  const workflows = new Map();
  agents.forEach(agent => {
    if (agent.workflow && agent.workflow.name) {
      workflows.set(agent.workflow.id, agent.workflow.name);
    }
  });
  
  // Add sorted options to dropdown
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

### Sort Options

Sort agents to organize your view:

| Sort Option | Description | When to Use |
|-------------|-------------|-------------|
| **Newest First** | Sort by creation date (newest → oldest) | Default, see recent work first |
| **Oldest First** | Sort by creation date (oldest → newest) | Find old tasks that need attention |
| **Name A-Z** | Sort alphabetically by agent name | Organize by name |
| **Name Z-A** | Sort reverse alphabetically | Reverse alphabetical order |
| **Status** | Sort by status (alphabetically) | Group by status type |
| **Most Tasks** | Sort by task count (high → low) | Find agents with most work |
| **Fewest Tasks** | Sort by task count (low → high) | Find simple tasks first |

**Sorting Algorithm:**

```javascript
// Frontend: frontend/views/agents.js
function filterAndSortAgents() {
  let filtered = [...allAgents];
  
  const sortBy = document.getElementById("agent-sort")?.value || "newest";
  filtered.sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      
      case "oldest":
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      
      case "name-asc":
        return (a.name || "").toLowerCase().localeCompare(
          (b.name || "").toLowerCase()
        );
      
      case "tasks-desc":
        return (b.tasks?.length || 0) - (a.tasks?.length || 0);
      
      default:
        return 0;
    }
  });
  
  renderAgents(filtered, "agents-list");
}
```

### Combining Filters and Sorting

Filters and sorts work together to create powerful queries:

#### Example 1: Failed Tasks from Specific Workflow

1. **Status Filter:** `failed`
2. **Workflow Filter:** `execute-features`
3. **Sort:** `Oldest First`

**Result:** See failed feature implementation tasks, oldest first, to prioritize fixing long-standing issues.

#### Example 2: Ready Tasks with Most Work

1. **Status Filter:** `ready`
2. **Workflow Filter:** `All`
3. **Sort:** `Most Tasks`

**Result:** Find ready tasks with the most work to tackle big items first.

#### Example 3: Recent Review Tasks

1. **Status Filter:** `All`
2. **Workflow Filter:** `review-self`
3. **Sort:** `Newest First`

**Result:** See all recent review workflow executions.

### Result Count Display

The UI shows filtered results count:

```
Showing 5 of 23 agents
```

or when no filters applied:

```
23 agents
```

**Empty State Handling:**

- **No agents at all:** "No agent tasks. Agent tasks will appear here when workflows are executed"
- **No matching filters:** "No agents match the current filters. Showing 0 of {total} agents"

### Auto-Completion Detection

The system automatically detects completed agents:

```javascript
// Backend: lib/agent/processor.js
function checkTaskCompletion(taskId) {
  const task = loadTask(taskId);
  
  // Check if implementation was done
  if (hasImplementationFiles(task)) {
    task.status = "completed";
    task.completedAt = new Date().toISOString();
    saveTask(task);
  }
}
```

**Triggers:**
- Files mentioned in task are created or modified
- Task is marked complete via `./kad agent complete <task-id>`
- Workflow execution completes successfully

### UI Navigation Tips

1. **Refresh Data:** Click the refresh icon (↻) to reload agents
2. **View Details:** Click any agent card to see full details
3. **Copy Summary:** Use the copy button (📋) to copy agent summary
4. **Quick Filters:** Use the filter dropdowns at the top of the page
5. **Keyboard Shortcuts:** 
   - `Ctrl/Cmd + R` - Refresh agents
   - `Esc` - Close agent detail modal

### Performance Considerations

- **Filtering:** Happens client-side, instant updates
- **Sorting:** Happens client-side, instant updates
- **Loading:** All agents loaded once, then cached
- **Refresh:** Click refresh to get latest data from server

### Common Filtering Scenarios

#### Scenario 1: Daily Standup Review

**Goal:** See what was worked on yesterday

1. **Status Filter:** `completed`
2. **Sort:** `Newest First`
3. **Workflow Filter:** `All`

**Result:** Review all completed work in chronological order.

#### Scenario 2: Error Triage

**Goal:** Fix all failed tasks

1. **Status Filter:** `failed`
2. **Sort:** `Oldest First`
3. **Workflow Filter:** `All`

**Action:** Start with oldest failures, debug with `./kad agent debug <task-id>`

#### Scenario 3: Feature Implementation Queue

**Goal:** Find tasks ready to implement

1. **Status Filter:** `ready`
2. **Sort:** `Most Tasks`
3. **Workflow Filter:** `execute-features`

**Action:** Implement tasks starting with biggest ones.

#### Scenario 4: Monitor Active Work

**Goal:** See what's currently running

1. **Status Filter:** `processing`
2. **Sort:** `Newest First`
3. **Workflow Filter:** `All`

**Action:** Monitor progress, check for stuck tasks.

### Advanced: CLI Filtering

While the UI provides rich filtering, you can also filter via CLI:

**Filter by workflow:**
```bash
# Show agents from execute-features workflow
sqlite3 .kaczmarek-ai/workflows.db \
  "SELECT id, status, workflow FROM agent_tasks 
   WHERE workflow = 'execute-features'"
```

**Filter by status:**
```bash
# Show all failed agents
./kad agent list | grep "✗"
```

**Filter by date range:**
```bash
# Show agents created today
sqlite3 .kaczmarek-ai/workflows.db \
  "SELECT id, status, created_at FROM agent_tasks 
   WHERE DATE(created_at) = DATE('now')"
```

### Troubleshooting Filters

#### Problem: Workflow filter is empty

**Cause:** No agents have been created yet

**Solution:** Run a workflow that creates agents:
```bash
./kad workflow run execute-features
```

#### Problem: Filter shows wrong count

**Cause:** Frontend cache is stale

**Solution:** Click the refresh button (↻) to reload

#### Problem: Agent not appearing in filtered view

**Cause:** Agent doesn't match current filter criteria

**Solution:** 
1. Reset filters to "All"
2. Use search (if available) to find specific agent
3. Check agent status with `./kad agent debug <task-id>`

### API for Filtering

The frontend uses these API endpoints:

**Get all agents:**
```bash
GET /api/agents
```

**Response:**
```json
{
  "agents": [
    {
      "id": "task-id",
      "status": "ready",
      "workflow": {
        "id": "execute-features",
        "name": "Execute Features"
      },
      "tasks": [...],
      "createdAt": "2025-12-23T10:00:00Z"
    }
  ]
}
```

**Filter logic:** Implemented client-side in `frontend/views/agents.js`

### Best Practices

1. **Start with filters, then sort**: Apply filters first to reduce result set, then sort
2. **Use workflow filter for focus**: When working on specific feature, filter by workflow
3. **Regular cleanup**: Periodically review and clean up old completed/failed agents
4. **Bookmark common views**: Use browser bookmarks with URL params (if implemented)
5. **Monitor processing agents**: Check regularly to ensure no agents are stuck


