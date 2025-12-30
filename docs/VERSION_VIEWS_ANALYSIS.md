# Version Views Analysis

## Current State (CONFUSING - Has Duplicates)

### Files:
1. **`frontend/views-v2/versions.js`** (880 lines)
   - `loadVersionsV2()` - Loads list of all versions
   - `renderVersionsList()` - Renders version cards
   - `loadVersionDetail()` - Loads a specific version detail view
   - `loadVersionStages()` - Loads stages for a version
   - `loadStageContent()` - Loads content for a specific stage
   - `renderPlanStage()` - **DUPLICATE** - Renders plan stage (simple version)
   - `renderImplementStage()` - **DUPLICATE** - Renders implement stage (simple version)
   - `renderTestStage()` - **DUPLICATE** - Renders test stage (simple version)
   - `renderReviewStage()` - **DUPLICATE** - Renders review stage (simple version)
   - `startPlanningAgentPolling()` - Polls for agent status
   - `rejectVersion()` - Rejects a version

2. **`frontend/views-v2/versions-stage-renderers.js`** (755 lines)
   - `renderPlanStage()` - **DUPLICATE** - Renders plan stage (enhanced version with technical details)
   - `renderImplementStage()` - **DUPLICATE** - Renders implement stage (enhanced version)
   - `renderTestStage()` - **DUPLICATE** - Renders test stage (enhanced version)
   - `renderReviewStage()` - **DUPLICATE** - Renders review stage (enhanced version)
   - `mergePlanningAgentBranch()` - Merges agent branch
   - `copyTechnicalDetails()` - Copies technical details to clipboard

### Problems:
1. **Duplicate render functions** - Same functions exist in both files with different implementations
2. **Confusing logic** - `loadStageContent()` tries to use `window.renderPlanStage` from `versions-stage-renderers.js` first, then falls back to local version
3. **Inconsistent features** - `versions-stage-renderers.js` has enhanced features (technical details, sync history) that `versions.js` doesn't have
4. **Large files** - Both files are very large (880 and 755 lines)

## Proposed Solution

### Consolidate into:
1. **`frontend/views-v2/versions.js`** - Main versions view
   - `loadVersionsV2()` - List of versions
   - `renderVersionsList()` - Render version cards
   - `loadVersionDetail()` - Load version detail view
   - `loadVersionStages()` - Load stages
   - `loadStageContent()` - Load stage content (delegates to renderers)
   - `rejectVersion()` - Reject version
   - `startPlanningAgentPolling()` - Poll agent status

2. **`frontend/views-v2/versions-stage-renderers.js`** - Stage renderers ONLY
   - `renderPlanStage()` - Enhanced plan stage with technical details
   - `renderImplementStage()` - Enhanced implement stage
   - `renderTestStage()` - Enhanced test stage
   - `renderReviewStage()` - Enhanced review stage
   - `mergePlanningAgentBranch()` - Merge branch helper
   - `copyTechnicalDetails()` - Copy details helper

### Changes:
1. Remove duplicate render functions from `versions.js`
2. Always use renderers from `versions-stage-renderers.js`
3. Keep `versions.js` focused on version list and navigation
4. Keep `versions-stage-renderers.js` focused on stage rendering



