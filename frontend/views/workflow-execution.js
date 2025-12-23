/**
 * Workflow execution module
 */

/**
 * Run a workflow
 */
async function runWorkflow(workflowId, params = {}) {
  try {
    let workflowParams = params;
    
    if (Object.keys(params).length === 0) {
      try {
        await window.apiCall(`/api/workflows/${workflowId}`);
      } catch (e) {
        // Ignore
      }
    }
    
    const loadingMsg = document.createElement("div");
    loadingMsg.id = "workflow-running-msg";
    loadingMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: var(--primary); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
    loadingMsg.textContent = `Running workflow: ${workflowId}...`;
    document.body.appendChild(loadingMsg);
    
    const response = await fetch(`/api/workflows/${workflowId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(workflowParams)
    });
    
    const result = await response.json();
    
    document.body.removeChild(loadingMsg);
    
    if (result.success) {
      window.showNotification(`Workflow started! Execution ID: ${result.executionId.substring(0, 8)}...`, "success");
      
      setTimeout(() => {
        if (window.currentView === "dashboard") {
          window.loadDashboard();
        } else if (window.currentView === "executions") {
          window.loadExecutions();
        }
      }, 1000);
      
      window.closeModal();
      
      if (window.currentView !== "executions") {
        setTimeout(() => {
          window.switchView("executions");
          window.showExecutionDetails(result.executionId);
        }, 500);
      }
    } else {
      throw new Error(result.error || "Failed to run workflow");
    }
  } catch (error) {
    console.error("Failed to run workflow:", error);
    window.showNotification(`Error: ${error.message}`, "error");
  }
}

/**
 * Run a workflow in step-by-step mode
 */
async function runWorkflowStepByStep(workflowId, params = {}) {
  try {
    const workflowParams = { ...params, executionMode: "step" };
    
    const loadingMsg = document.createElement("div");
    loadingMsg.id = "workflow-running-msg";
    loadingMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: var(--secondary); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
    loadingMsg.textContent = `Starting step-by-step workflow: ${workflowId}...`;
    document.body.appendChild(loadingMsg);
    
    const response = await fetch(`/api/workflows/${workflowId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(workflowParams)
    });
    
    const result = await response.json();
    
    document.body.removeChild(loadingMsg);
    
    if (result.success) {
      window.showNotification(`Step-by-step execution started (ID: ${result.executionId.substring(0, 8)}...)`, "info");
      
      setTimeout(() => {
        if (window.currentView !== "executions") {
          window.switchView("executions");
        }
        window.showExecutionDetails(result.executionId);
      }, 500);
    } else {
      throw new Error(result.error || "Failed to start step-by-step workflow");
    }
  } catch (error) {
    console.error("Failed to start step-by-step workflow:", error);
    window.showNotification(`Failed to start step-by-step workflow: ${error.message}`, "error");
  }
}

// Expose globally
window.runWorkflow = runWorkflow;
window.runWorkflowStepByStep = runWorkflowStepByStep;

