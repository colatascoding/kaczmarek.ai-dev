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




