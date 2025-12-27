# Decision Paths Testing Guide

This guide explains how to test the decision paths feature through the dashboard UI.

## Overview

Decision paths allow workflows to pause execution and wait for user decisions. When a workflow reaches a `wait-for-decision` step, it:
1. Pauses execution
2. Displays proposals in the UI
3. Waits for your selection
4. Resumes based on your choice

## Prerequisites

1. **API Server Running**: Start the API server
   ```bash
   kad api
   ```
   The server should start on `http://localhost:3000`

2. **Browser Access**: Open the dashboard at `http://localhost:3000`

## Testing Steps

### Step 1: Access the Dashboard

1. Open your browser and navigate to `http://localhost:3000`
2. You should see the new UI with navigation: Home, Versions, Workflows, Library

### Step 2: Run a Workflow with Decisions

#### Option A: Use the Example Workflow (Recommended)

The example workflow `plan-with-decisions` is already in the library:

1. Navigate to **Library** in the dashboard (click "Library" in the top navigation)
2. Find the workflow: `planning/plan-with-decisions` (or search for "plan-with-decisions")
3. Click the **Run** button to start the workflow
4. The workflow will start executing immediately

#### Option B: Create Your Own Test Workflow

1. Create a workflow file manually in `workflows/test-decisions.yaml`:

```yaml
name: "Test Decisions"
version: "1.0.0"
description: "Simple test workflow with decision point"
interactionMode: "human-in-the-loop"

steps:
  - id: "start"
    module: "system"
    action: "log"
    inputs:
      message: "Starting test workflow"
      level: "info"
    onSuccess: "get-decision"

  - id: "get-decision"
    module: "system"
    action: "wait-for-decision"
    inputs:
      title: "Test Decision"
      description: "This is a test decision. Please choose an option."
      proposals:
        - id: "option1"
          label: "Option 1"
          description: "Choose this to continue with option 1"
        - id: "option2"
          label: "Option 2"
          description: "Choose this to continue with option 2"
        - id: "skip"
          label: "Skip"
          description: "Skip this step"
    onSuccess:
      condition: "{{ steps.get-decision.outputs.decision }} === 'option1'"
      then: "handle-option1"
      else:
        condition: "{{ steps.get-decision.outputs.decision }} === 'option2'"
        then: "handle-option2"
        else: "complete"

  - id: "handle-option1"
    module: "system"
    action: "log"
    inputs:
      message: "You chose option 1"
      level: "info"
    onSuccess: "complete"

  - id: "handle-option2"
    module: "system"
    action: "log"
    inputs:
      message: "You chose option 2"
      level: "info"
    onSuccess: "complete"

  - id: "complete"
    module: "system"
    action: "notify-completion"
    inputs:
      status: "completed"
      executionId: "{{ workflow.executionId }}"
```

3. Save the file
4. Navigate to **Workflows** in the dashboard
5. Find your workflow and click **Run**

### Step 3: Observe Workflow Execution

1. After clicking **Run**, navigate to **Home** view
2. You should see:
   - The workflow execution in the "Recent Activity" section
   - Status will show as "waiting" when it reaches the decision point
   - A decision card appears in the top-right corner

### Step 4: View and Respond to Decisions (All in Dashboard!)

#### Decision Card Location

Decision cards appear **automatically** in a **fixed position in the top-right corner** of the dashboard when a workflow is waiting for a decision. You don't need to navigate anywhere - they appear on any view!

#### Decision Card Contents

Each decision card shows:
- **Title**: The decision title (e.g., "Planning Proposals")
- **Description**: Explanation of what needs to be decided
- **Proposals**: List of options with:
  - **Label** (e.g., "Add New Features")
  - **Description** explaining what the option does
  - **Select** button to choose that option

#### Making a Decision (Simple!)

1. **Look at the top-right corner** - you'll see the decision card
2. **Read the proposals** - each option has a label and description
3. **Click the "Select" button** for your chosen option
4. **That's it!** The workflow automatically:
   - Records your decision
   - Resumes execution
   - Updates the decision card to show "Decision submitted"
   - Continues based on your choice

**No page refresh needed** - everything happens automatically!

### Step 5: Monitor Execution Status (Dashboard)

1. **On Home view**: Check "Recent Activity" section
   - Executions show their current status
   - "waiting" status means a decision is pending
   - Click on an execution to see details

2. **On Workflows view**: 
   - Click on a workflow name to see details
   - View execution history
   - See decision points in the step list

### Step 6: View Execution Details

1. **From Home view**: Click on any execution in "Recent Activity"
2. **Or from Workflows view**: Click on a workflow, then view its executions
3. You'll see:
   - All steps executed
   - Decision points and your choices
   - Final outcome
   - Complete execution summary

## Dashboard Features for Decisions

### Home View

- **Recent Activity**: Shows all executions, including those waiting for decisions
- **Status Badges**: "waiting" status indicates a decision is pending
- **Auto-refresh**: Decision cards automatically appear when workflows are waiting

### Workflows View

- **Run Workflow**: Start a workflow that may have decision points
- **Workflow Details**: View workflow structure and see decision steps
- **Execution History**: See past executions and their decisions

### Executions View (if available)

- **Filter by Status**: Filter to see "waiting" executions
- **Decision History**: View all decisions made during execution
- **Resume Workflow**: Manually resume if needed (usually automatic)

## Testing Scenarios (All Through Dashboard)

### Scenario 1: Simple Decision

1. **Navigate to Workflows** → Find a workflow with decisions
2. **Click "Run"** button
3. **Watch top-right corner** → Decision card appears automatically
4. **Click "Select"** on your chosen option
5. **Observe**: Card updates to "Decision submitted", workflow resumes
6. **Check Home view** → Execution status changes from "waiting" to "running" to "completed"

### Scenario 2: Multiple Decisions

1. **Run a workflow** with multiple decision points
2. **First decision card appears** → Make your choice
3. **Card updates** → Workflow continues
4. **Second decision card appears** (if workflow has another decision point)
5. **Make second decision** → Workflow completes

### Scenario 3: Conditional Routing

1. **Run a workflow** with conditional routing (like `plan-with-decisions`)
2. **Decision card appears** with multiple options
3. **Choose option A** (e.g., "Add New Features")
4. **Verify**: Workflow takes path A (check execution details)
5. **Run workflow again**
6. **Choose option B** (e.g., "Refactor Code")
7. **Verify**: Workflow takes path B (different steps executed)

### Scenario 4: Planning Workflow (Full Example)

1. **Navigate to Library** view
2. **Find**: `planning/plan-with-decisions` workflow
3. **Click "Run"** button
4. **Wait 2-3 seconds** → Decision card appears in top-right
5. **Review proposals**:
   - "Add New Features" - Plan new features
   - "Refactor Code" - Plan code improvements  
   - "Update Documentation" - Plan docs updates
   - "Skip Planning" - Continue without changes
6. **Click "Select"** on your chosen option
7. **Observe**: 
   - Decision card shows "Decision submitted"
   - Workflow continues based on your choice
   - Check Home view to see execution progress

## Troubleshooting

### Decision Card Not Appearing

1. **Check execution status**: 
   - Go to **Home** view
   - Look in "Recent Activity" 
   - Verify execution status is **"waiting"**
   - If status is "waiting" but no card appears, refresh the page

2. **Check browser console**: 
   - Open browser DevTools (F12)
   - Look for JavaScript errors
   - Check Network tab for API calls to `/api/executions/:id/decisions`

3. **Manual check**: 
   - The dashboard polls for decisions every 5 seconds
   - If card doesn't appear, wait a few seconds and check again

### Workflow Not Resuming

1. **Check decision submission**: 
   - After clicking "Select", the card should update
   - If it doesn't, check browser console for errors

2. **Check execution status**: 
   - Go to **Home** view
   - Status should change from "waiting" → "running" → "completed"
   - If stuck on "waiting", check API server console for errors

3. **Refresh dashboard**: 
   - Click "Refresh" button on Home view
   - Or manually refresh the page (F5)

### Multiple Decision Cards

- **Normal behavior**: If multiple workflows are waiting, you'll see multiple cards
- **Stacked vertically**: Cards appear one below another in top-right corner
- **Independent**: Each card is for a different workflow - make decisions separately

### Multiple Decision Cards

- If multiple workflows are waiting, you'll see multiple decision cards
- Each card is independent - make decisions for each workflow separately
- Cards are stacked vertically in the top-right corner

## Expected Behavior

### When Workflow Reaches Decision Point

✅ Execution status changes to "waiting"  
✅ Decision card appears in top-right corner  
✅ Workflow execution pauses  
✅ Decision is stored in database  

### When Decision is Submitted

✅ Decision card updates to show "submitted"  
✅ Workflow status changes to "running"  
✅ Workflow resumes from next step  
✅ Decision choice is available in step outputs  

### After Workflow Completes

✅ Execution status changes to "completed"  
✅ Decision card disappears  
✅ Full execution history is available  
✅ Decision choices are visible in execution details  

## Advanced: Creating Custom Decision Workflows

### Planning Workflow Example

```yaml
- id: "scan-project"
  module: "review"
  action: "scan-repository"
  onSuccess: "generate-proposals"

- id: "generate-proposals"
  module: "system"
  action: "wait-for-decision"
  inputs:
    title: "Planning Proposals"
    description: "Select planning items to include"
    proposals:
      - id: "features"
        label: "Add Features"
        description: "Plan new features"
      - id: "refactor"
        label: "Refactor"
        description: "Plan code improvements"
  onSuccess:
    condition: "{{ steps.generate-proposals.outputs.decision }} === 'features'"
    then: "plan-features"
    else: "plan-refactor"
```

### Iterative Planning with Subloops

For workflows that need to iterate (e.g., planning multiple items), you can use subloops:

```yaml
- id: "planning-loop"
  type: "subloop"
  maxIterations: 10
  condition: "{{ steps.scan.outputs.hasMoreItems }}"
  steps:
    - id: "get-item-decision"
      module: "system"
      action: "wait-for-decision"
      inputs:
        title: "Plan Next Item"
        proposals: "{{ steps.scan.outputs.items }}"
```

## Quick Start Testing (30 seconds)

1. **Start API server**: `kad api`
2. **Open browser**: `http://localhost:3000`
3. **Go to Library**: Click "Library" in navigation
4. **Find workflow**: `planning/plan-with-decisions`
5. **Click "Run"**: Workflow starts executing
6. **Watch top-right**: Decision card appears automatically
7. **Click "Select"**: Choose an option
8. **Done!**: Workflow resumes and completes

## Summary

**Everything is manageable through the dashboard - no CLI commands needed!**

### What You Can Do in the Dashboard:

✅ **Start workflows** - Click "Run" button from Workflows or Library view  
✅ **See decisions** - Cards appear automatically in top-right corner  
✅ **Make decisions** - Click "Select" on any proposal  
✅ **Monitor progress** - View executions in Home view "Recent Activity"  
✅ **View details** - Click on executions to see full history  
✅ **Track status** - See "waiting", "running", "completed" status badges  

### Decision Flow:

1. **Workflow runs** → Reaches decision point
2. **Card appears** → Top-right corner automatically
3. **You choose** → Click "Select" on a proposal
4. **Workflow resumes** → Continues based on your choice
5. **Status updates** → Visible in Home view

**No manual intervention needed** - the dashboard handles everything automatically!

