# Version Views Consolidation Plan

## Problem Identified

There are **duplicate render functions** in two files:
1. `frontend/views-v2/versions.js` - Has simple render functions
2. `frontend/views-v2/versions-stage-renderers.js` - Has enhanced render functions with technical details

This causes confusion about which renderer is being used.

## Solution

### File Responsibilities:

**`frontend/views-v2/versions.js`** (Main versions view)
- ✅ `loadVersionsV2()` - Load list of all versions
- ✅ `renderVersionsList()` - Render version cards
- ✅ `loadVersionDetail()` - Load version detail view
- ✅ `loadVersionStages()` - Load stages for a version
- ✅ `loadStageContent()` - Load stage content (delegates to renderers)
- ✅ `rejectVersion()` - Reject a version
- ✅ `startPlanningAgentPolling()` - Poll agent status
- ❌ **REMOVE**: `renderPlanStage()` - Use `window.renderPlanStage` instead
- ❌ **REMOVE**: `renderImplementStage()` - Use `window.renderImplementStage` instead
- ❌ **REMOVE**: `renderTestStage()` - Use `window.renderTestStage` instead
- ❌ **REMOVE**: `renderReviewStage()` - Use `window.renderReviewStage` instead

**`frontend/views-v2/versions-stage-renderers.js`** (Stage renderers ONLY)
- ✅ `renderPlanStage()` - Enhanced plan stage with technical details, sync history, branch merging
- ✅ `renderImplementStage()` - Enhanced implement stage
- ✅ `renderTestStage()` - Enhanced test stage
- ✅ `renderReviewStage()` - Enhanced review stage
- ✅ `mergePlanningAgentBranch()` - Merge branch helper
- ✅ `copyTechnicalDetails()` - Copy details helper

## Changes Made

1. ✅ Updated `loadStageContent()` to always use renderers from `versions-stage-renderers.js`
2. ✅ Updated `refreshPlanStage()` to use `window.renderPlanStage`
3. ✅ Updated polling logic to use `window.renderPlanStage`
4. ⏳ **TODO**: Remove duplicate render functions from `versions.js` (lines 305-690)

## Next Steps

1. Remove all duplicate render functions from `versions.js`
2. Update any remaining references to use `window.render*Stage` functions
3. Test that all stages render correctly
4. Verify technical details view works

