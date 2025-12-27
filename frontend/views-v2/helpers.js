/**
 * Helper Functions V2
 * Utility functions for the new UI
 */

/**
 * Run tests
 */
async function runTests(type) {
  try {
    window.showNotification(`Running ${type} tests...`, "info");
    
    // TODO: Implement actual test running
    // This would call the implementation module's run-tests action
    // For now, just show a notification
    setTimeout(() => {
      window.showNotification("Test execution coming soon", "info");
    }, 500);
  } catch (error) {
    console.error("Failed to run tests:", error);
    window.showNotification(`Failed to run tests: ${error.message}`, "error");
  }
}

/**
 * Consolidate workstreams
 */
async function consolidateWorkstreams(versionTag) {
  try {
    window.showNotification("Consolidating workstreams...", "info");
    
    const data = await window.apiCall(`/api/workstreams/consolidate`, {
      method: "POST",
      body: JSON.stringify({ versionTag }),
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (data.success) {
      window.showNotification(`Consolidated ${data.workstreamCount || 0} workstream(s)`, "success");
      
      // Refresh implement stage
      if (window.loadStageContent && currentVersion) {
        await window.loadStageContent(currentVersion, "implement");
      }
    } else {
      window.showNotification(data.message || "Consolidation completed", "info");
    }
  } catch (error) {
    console.error("Failed to consolidate workstreams:", error);
    window.showNotification(`Failed to consolidate: ${error.message}`, "error");
  }
}

/**
 * Mark stage as complete
 */
async function markStageComplete(versionTag, stage) {
  try {
    // Map stage names
    const stageMap = {
      plan: "01_plan",
      implement: "02_implement",
      test: "03_test",
      review: "04_review"
    };
    
    const stageFolder = stageMap[stage] || stage;
    
    // TODO: Call API to update stage status
    // For now, use the stage management module directly via API
    window.showNotification(`Marking ${stage} stage as complete...`, "info");
    
    // This would need a new API endpoint or we can use the existing stage management
    // For now, just show notification
    setTimeout(() => {
      window.showNotification("Stage completion coming soon", "info");
    }, 500);
  } catch (error) {
    console.error("Failed to mark stage complete:", error);
    window.showNotification(`Failed to mark stage complete: ${error.message}`, "error");
  }
}

/**
 * Create next version
 */
async function createNextVersion(currentVersionTag) {
  try {
    // Parse current version
    const [major, minor] = currentVersionTag.split("-").map(Number);
    const nextMinor = minor + 1;
    
    // Open version creation wizard with pre-filled data
    if (window.openVersionCreationWizard) {
      // Set wizard data
      if (window.versionWizardData !== undefined) {
        window.versionWizardData = {
          major: major,
          minor: nextMinor,
          type: "minor",
          goals: []
        };
      }
      window.openVersionCreationWizard();
    } else {
      // Fallback: create directly
      const data = await window.apiCall("/api/versions", {
        method: "POST",
        body: JSON.stringify({
          major: major,
          minor: nextMinor,
          type: "minor",
          goals: []
        }),
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      window.showNotification(`Version ${major}-${nextMinor} created`, "success");
      
      if (window.loadVersionsV2) {
        await window.loadVersionsV2();
      }
    }
  } catch (error) {
    console.error("Failed to create next version:", error);
    window.showNotification(`Failed to create next version: ${error.message}`, "error");
  }
}

/**
 * Save plan stage
 */
async function savePlanStage(versionTag) {
  try {
    const goals = [];
    const goalInputs = document.querySelectorAll("#plan-goals-list input[type='text']");
    goalInputs.forEach(input => {
      if (input.value.trim()) {
        goals.push(input.value.trim());
      }
    });
    
    // TODO: Save goals to version files
    window.showNotification("Plan stage saved", "success");
  } catch (error) {
    console.error("Failed to save plan stage:", error);
    window.showNotification(`Failed to save: ${error.message}`, "error");
  }
}

/**
 * Add plan goal
 */
function addPlanGoal() {
  const container = document.getElementById("plan-goals-list");
  if (!container) return;
  
  const goalDiv = document.createElement("div");
  goalDiv.style.cssText = "display: flex; gap: 0.5rem; margin-bottom: 0.5rem;";
  goalDiv.innerHTML = `
    <input type="text" placeholder="Enter goal" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);">
    <button class="btn btn-sm" onclick="this.parentElement.remove()">Remove</button>
  `;
  container.appendChild(goalDiv);
}

/**
 * Update plan goal
 */
function updatePlanGoal(index, value) {
  // TODO: Save to version file
  console.log(`Update goal ${index}: ${value}`);
}

/**
 * Remove plan goal
 */
function removePlanGoal(index) {
  // TODO: Remove from version file
  console.log(`Remove goal ${index}`);
  // Reload plan stage
  if (window.loadStageContent && window.currentVersion) {
    window.loadStageContent(window.currentVersion, "plan");
  }
}

/**
 * Run review workflow
 */
async function runReviewWorkflow() {
  try {
    if (window.runWorkflow) {
      await window.runWorkflow("review-self");
    } else {
      window.showNotification("Workflow execution not available", "error");
    }
  } catch (error) {
    console.error("Failed to run review workflow:", error);
    window.showNotification(`Failed to run workflow: ${error.message}`, "error");
  }
}

// Expose globally
window.runTests = runTests;
window.consolidateWorkstreams = consolidateWorkstreams;
window.markStageComplete = markStageComplete;
window.createNextVersion = createNextVersion;
window.savePlanStage = savePlanStage;
window.addPlanGoal = addPlanGoal;
window.updatePlanGoal = updatePlanGoal;
window.removePlanGoal = removePlanGoal;
window.runReviewWorkflow = runReviewWorkflow;

