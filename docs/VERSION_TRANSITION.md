# Version Transition Workflow

## Overview

The `execute-features` workflow now automatically detects when all tasks in a version are completed and creates a new version.

## How It Works

### Automatic Detection

1. **Extract Next Steps**: Workflow extracts uncompleted tasks from review
2. **Check Count**: If 0 tasks found, checks if all tasks are actually complete
3. **Verify Completion**: Uses `check-all-tasks-complete` to verify all tasks are done
4. **Create New Version**: If all complete, automatically creates next version (increments minor version)

### Workflow Steps

```
extract-next-steps
  ↓ (if count = 0)
check-all-complete
  ↓ (if allComplete = true)
create-next-version
  ↓
log-version-created
```

## Usage

### Normal Flow (Tasks Available)
```bash
./kad workflow run execute-features --maxTasks 3
# Extracts tasks, creates plan, launches agent
```

### Automatic Version Transition (All Tasks Complete)
```bash
./kad workflow run execute-features --maxTasks 3
# Detects all tasks complete
# Creates version0-2 automatically
# Marks version0-1 as Complete
```

## Version Creation

When all tasks are complete, the system:

1. **Creates New Review File**: `review/version0-2.md`
   - Status: In Progress
   - Started: Today's date
   - Summary: Continuation from previous version
   - Empty Goals and Next Steps sections

2. **Creates New Progress File**: `progress/version0-2.md`
   - Initial entry: "Version Started"

3. **Marks Previous Version Complete**:
   - Updates status: `In Progress` → `Complete`
   - Adds completion date

## Manual Version Creation

You can also create a new version manually:

```bash
node -e "
const r = require('./lib/modules/review');
r.actions['create-next-version']({
  cwd: process.cwd(),
  currentVersionTag: 'version0-1'
}, {
  logger: {info: console.log, error: console.error, warn: console.warn}
}).then(r => {
  console.log('Created:', r.versionTag);
});
"
```

## Check Task Completion Status

Check if all tasks in a version are complete:

```bash
node -e "
const r = require('./lib/modules/review');
r.actions['check-all-tasks-complete']({
  reviewFile: 'review/version0-1.md'
}, {
  logger: console
}).then(r => {
  console.log('All complete:', r.allComplete);
  console.log('Tasks:', r.completedTasks + '/' + r.totalTasks);
});
"
```

## Configuration

The version transition happens automatically when:
- No uncompleted tasks are found in "Next Steps"
- All tasks in "Next Steps" are marked with `[x]`

## Example

**Before (version0-1):**
```markdown
## Next Steps
- [x] Task 1
- [x] Task 2
- [x] Task 3
```

**After running workflow:**
- version0-1 marked as `Complete`
- version0-2 created with empty Next Steps
- Workflow logs: "All tasks completed! Created new version: version0-2"

## Notes

- Version numbers increment minor version (0-1 → 0-2)
- Previous version is automatically marked complete
- New version starts with empty goals and next steps
- You can add goals/next steps to the new version manually or via workflow



