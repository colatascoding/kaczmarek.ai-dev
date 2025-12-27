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
    
    // Call workflow to run tests
    if (window.runWorkflow) {
      const executionId = await window.runWorkflow("run-tests", {
        type: type || "all"
      });
      
      if (executionId) {
        window.showNotification(`Test execution started (ID: ${executionId.substring(0, 8)}...)`, "success");
      } else {
        window.showNotification("Test execution failed to start", "error");
      }
    } else {
      // Fallback: try direct API call
      try {
        const data = await window.apiCall("/api/workflows/run-tests/run", {
          method: "POST",
          body: JSON.stringify({ type: type || "all" }),
          headers: { "Content-Type": "application/json" }
        });
        
        if (data.executionId) {
          window.showNotification(`Test execution started`, "success");
        } else {
          window.showNotification("Test workflow not found. Please create a 'run-tests' workflow.", "info");
        }
      } catch (apiError) {
        window.showNotification("Test execution not available. Please create a 'run-tests' workflow.", "info");
      }
    }
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
      const currentVersionTag = window.currentVersionTag || document.getElementById("version-detail-title")?.textContent?.replace("Version ", "");
      if (window.loadStageContent && currentVersionTag) {
        await window.loadStageContent(currentVersionTag, "implement");
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
    
    window.showNotification(`Marking ${stage} stage as complete...`, "info");
    
    try {
      const data = await window.apiCall(`/api/versions/${versionTag}/${stage}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "completed" }),
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (data.success) {
        window.showNotification(`Stage ${stage} marked as complete`, "success");
        
        // Refresh stage view
        if (window.loadStageContent) {
          await window.loadStageContent(versionTag, stage);
        }
      } else {
        window.showNotification(data.error || "Failed to update stage status", "error");
      }
    } catch (error) {
      console.error("Failed to mark stage complete:", error);
      window.showNotification(`Failed to mark stage complete: ${error.message}`, "error");
    }
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
      await window.apiCall("/api/versions", {
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
    
    const data = await window.apiCall(`/api/versions/${versionTag}/plan/goals`, {
      method: "POST",
      body: JSON.stringify({ goals }),
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (data.success) {
      window.showNotification("Plan stage saved", "success");
      
      // Refresh plan stage view
      if (window.loadStageContent) {
        await window.loadStageContent(versionTag, "plan");
      }
    } else {
      window.showNotification(data.error || "Failed to save goals", "error");
    }
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
async function updatePlanGoal(index, value) {
  // Get current version tag
  const versionTag = window.currentVersion || document.getElementById("version-detail-title")?.textContent?.replace("Version ", "");
  if (!versionTag) {
    console.error("No version tag found");
    return;
  }
  
  // Save all goals (including the updated one)
  await savePlanStage(versionTag);
}

/**
 * Remove plan goal
 */
async function removePlanGoal(index) {
  // Get current version tag
  const versionTag = window.currentVersion || document.getElementById("version-detail-title")?.textContent?.replace("Version ", "");
  if (!versionTag) {
    console.error("No version tag found");
    return;
  }
  
  // Remove the goal from DOM
  const goalInputs = document.querySelectorAll("#plan-goals-list input[type='text']");
  if (goalInputs[index]) {
    goalInputs[index].parentElement.remove();
    
    // Save remaining goals
    await savePlanStage(versionTag);
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

