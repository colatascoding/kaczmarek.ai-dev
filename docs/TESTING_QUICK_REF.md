# Testing Quick Reference

## Quick Test Commands

### Basic Functionality
```bash
# Test CLI
./kad --help
./kad workflow list
./kad agent list

# Test workflows
./kad workflow validate workflows/execute-features.yaml
./kad workflow show execute-features

# Run integration test
./test-integration.sh
```

### Test Workflows
```bash
# Review workflow
./kad workflow run review-self --days 7

# Execution workflow
./kad workflow run execute-features --maxTasks 2

# Check status
./kad workflow status <execution-id>
```

### Test Agents
```bash
# List tasks
./kad agent list

# Debug task
./kad agent debug <task-id>

# Complete task
./kad agent complete <task-id>

# Start processor
./kad agent start
```

### Test Modules
```bash
# List all modules
node -e "const m=require('./lib/modules/module-loader'); console.log(JSON.stringify(new m('./lib/modules').listModules(), null, 2));"

# Test review module
node -e "const r=require('./lib/modules/review'); r.actions['scan-repository']({cwd:'.'}, {logger:console}).then(r=>console.log('Success:',r.success));"

# Test testing module
node -e "const t=require('./lib/modules/testing'); t.actions['run-tests']({cwd:'.'}, {logger:console}).then(r=>console.log('Passed:',r.passed));"
```

## One-Liner Tests

### Complete End-to-End Test
```bash
./kad workflow run execute-features --maxTasks 1 && \
TASK_ID=$(./kad agent list | grep ready | head -1 | awk '{print $2}') && \
./kad agent debug $TASK_ID && \
./kad agent complete $TASK_ID && \
echo "✓ Test complete!"
```

### Test Database
```bash
sqlite3 .kaczmarek-ai/workflows.db "SELECT COUNT(*) as workflows FROM workflows; SELECT COUNT(*) as executions FROM executions;"
```

### Test File Updates
```bash
./kad agent complete $(./kad agent list | grep ready | head -1 | awk '{print $2}') && \
echo "Progress:" && tail -5 progress/version0-1.md && \
echo "Review:" && grep -A 3 "Next Steps" review/version0-1.md
```

## Expected Test Results

✅ **All tests should:**
- Workflows validate successfully
- Agent tasks are created
- Tasks can be debugged
- Tasks can be completed
- Progress/review files update
- Database stores state

## Common Test Issues

**Issue**: Workflow validation fails
```bash
# Check YAML syntax
./kad workflow validate workflows/<workflow-name>.yaml
```

**Issue**: Agent tasks not processing
```bash
# Check task status
./kad agent list
./kad agent debug <task-id>

# Manually process
./kad agent process <task-id>
```

**Issue**: Module not found
```bash
# Verify module exists
ls lib/modules/<module-name>/index.js

# Test module loading
node -e "const m=require('./lib/modules/module-loader'); console.log(new m('./lib/modules').listModules());"
```

