#!/bin/bash
# Integration test script for kaczmarek.ai-dev

set -e

echo "=========================================="
echo "kaczmarek.ai-dev Integration Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_step() {
    local name=$1
    local command=$2
    
    echo -n "Testing: $name... "
    
    if eval "$command" > /tmp/test-output.log 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Command: $command"
        echo "  Output:"
        cat /tmp/test-output.log | sed 's/^/    /'
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "=== Step 1: Basic CLI Commands ==="
test_step "kad help" "./kad --help"
test_step "kad workflow list" "./kad workflow list"
test_step "kad agent list" "./kad agent list"

echo ""
echo "=== Step 2: Workflow Validation ==="
test_step "validate execute-features" "./kad workflow validate workflows/execute-features.yaml"
test_step "validate review-self" "./kad workflow validate workflows/review-self.yaml"

echo ""
echo "=== Step 3: Module Loading ==="
test_step "load modules" "node -e 'const m=require(\"./lib/modules/module-loader\"); new m(\"./lib/modules\").listModules();'"

echo ""
echo "=== Step 4: Review Workflow ==="
REVIEW_EXEC=$(./kad workflow run review-self --days 7 2>&1 | grep -oE '[a-f0-9]{32}' | head -1 || echo "")
if [ -n "$REVIEW_EXEC" ]; then
    echo -e "${GREEN}✓ Review workflow executed: $REVIEW_EXEC${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ Review workflow failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "=== Step 5: Execution Workflow ==="
EXEC_EXEC=$(./kad workflow run execute-features --maxTasks 1 2>&1 | grep -oE '[a-f0-9]{32}' | head -1 || echo "")
if [ -n "$EXEC_EXEC" ]; then
    echo -e "${GREEN}✓ Execution workflow executed: $EXEC_EXEC${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Wait a moment for processing
    sleep 2
    
    # Check agent task was created
    TASK_COUNT=$(./kad agent list 2>&1 | grep -c "ready\|completed" || echo "0")
    if [ "$TASK_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Agent task created${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Get task ID
        TASK_ID=$(./kad agent list 2>&1 | grep "ready" | head -1 | awk '{print $2}' || echo "")
        if [ -n "$TASK_ID" ]; then
            echo ""
            echo "=== Step 6: Agent Debug ==="
            test_step "debug task" "./kad agent debug $TASK_ID"
            
            echo ""
            echo "=== Step 7: Task Completion ==="
            test_step "complete task" "./kad agent complete $TASK_ID"
            
            # Verify progress file was updated
            if tail -5 progress/version0-1.md | grep -q "Task Completed"; then
                echo -e "${GREEN}✓ Progress file updated${NC}"
                TESTS_PASSED=$((TESTS_PASSED + 1))
            else
                echo -e "${YELLOW}⚠ Progress file may not have been updated${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ No agent tasks found${NC}"
    fi
else
    echo -e "${RED}✗ Execution workflow failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "=== Step 8: Database Verification ==="
if [ -f ".kaczmarek-ai/workflows.db" ]; then
    WORKFLOW_COUNT=$(sqlite3 .kaczmarek-ai/workflows.db "SELECT COUNT(*) FROM workflows;" 2>/dev/null || echo "0")
    EXEC_COUNT=$(sqlite3 .kaczmarek-ai/workflows.db "SELECT COUNT(*) FROM executions;" 2>/dev/null || echo "0")
    
    if [ "$WORKFLOW_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Database has $WORKFLOW_COUNT workflow(s)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
    
    if [ "$EXEC_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Database has $EXEC_COUNT execution(s)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
else
    echo -e "${YELLOW}⚠ Database file not found${NC}"
fi

echo ""
echo "=========================================="
echo "Test Results"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ "$TESTS_FAILED" -gt 0 ]; then
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Failed: $TESTS_FAILED${NC}"
    echo ""
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
fi

