# Testing Version Transition

## Scenario: All Tasks Complete

To test the automatic version transition:

### Step 1: Create a test version with all tasks completed

```bash
# Create a test review file
cat > review/version-test.md << 'EOF'
# Version Test

**Status**: In Progress  
**Started**: 2025-12-20

## Next Steps

- [x] Task 1
- [x] Task 2
- [x] Task 3
EOF
```

### Step 2: Run the workflow

```bash
# Temporarily rename current version
mv review/version0-1.md review/version0-1.md.backup
mv review/version0-2.md review/version0-2.md.backup

# Run workflow - should detect all tasks complete
./kad workflow run execute-features --maxTasks 1

# Check output for:
# - "No uncompleted tasks found"
# - "All tasks completed!"
# - "Created new version: versionX-Y"
```

### Step 3: Verify new version created

```bash
# Check new version files exist
ls -la review/version*.md
ls -la progress/version*.md

# Check previous version marked complete
grep "Status" review/version-test.md
# Should show: **Status**: Complete
```

### Step 4: Cleanup

```bash
# Restore original versions
mv review/version0-1.md.backup review/version0-1.md
mv review/version0-2.md.backup review/version0-2.md
rm review/version-test.md
```

## Manual Test

Test the actions directly:

```bash
# Check if all tasks complete
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

# Create next version
node -e "
const r = require('./lib/modules/review');
r.actions['create-next-version']({
  cwd: process.cwd(),
  currentVersionTag: 'version0-1'
}, {
  logger: {info: console.log, error: console.error, warn: console.warn}
}).then(r => {
  console.log('Created:', r.versionTag);
  console.log('Review:', r.reviewFile);
  console.log('Progress:', r.progressFile);
});
"
```




