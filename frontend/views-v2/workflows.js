/**
 * Workflows View V2
 * Enhanced workflow management with summaries and better organization
 */

/**
 * Load workflows
 */
async function loadWorkflowsV2() {
  try {
    const data = await window.apiCall("/api/workflows");
    const workflows = data.workflows || [];
    
    renderWorkflowsListV2(workflows);
  } catch (error) {
    console.error("Failed to load workflows:", error);
    document.getElementById("workflows-list").innerHTML = 
      `<div style="text-align: center; padding: 2rem; color: var(--text-light);">
        <p>Failed to load workflows: ${error.message}</p>
      </div>`;
  }
}

/**
 * Render workflows list
 */
function renderWorkflowsListV2(workflows) {
  const container = document.getElementById("workflows-list");
  
  if (workflows.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <h3 style="margin-bottom: 1rem;">No Workflows Found</h3>
        <p style="color: var(--text-light); margin-bottom: 1.5rem;">Workflows will appear here when available</p>
        <button class="btn btn-primary" onclick="switchView('library')">Browse Library</button>
      </div>
    `;
    return;
  }
  
  // Group workflows by source
  const bySource = {
    active: [],
    library: [],
    "version-specific": []
  };
  
  workflows.forEach(wf => {
    const source = wf.source || "active";
    if (!bySource[source]) {
      bySource[source] = [];
    }
    bySource[source].push(wf);
  });
  
  let html = "";
  
  // Active workflows
  if (bySource.active.length > 0) {
    html += `
      <div class="section-v2" style="margin-bottom: 1.5rem;">
        <div class="section-header-v2">
          <h3>Active Workflows</h3>
          <span class="badge">${bySource.active.length}</span>
        </div>
        <div class="list-v2">
          ${bySource.active.map(wf => renderWorkflowCard(wf)).join("")}
        </div>
      </div>
    `;
  }
  
  // Library workflows
  if (bySource.library.length > 0) {
    html += `
      <div class="section-v2" style="margin-bottom: 1.5rem;">
        <div class="section-header-v2">
          <h3>Library Workflows</h3>
          <span class="badge">${bySource.library.length}</span>
        </div>
        <div class="list-v2">
          ${bySource.library.map(wf => renderWorkflowCard(wf)).join("")}
        </div>
      </div>
    `;
  }
  
  // Version-specific workflows
  if (bySource["version-specific"].length > 0) {
    html += `
      <div class="section-v2" style="margin-bottom: 1.5rem;">
        <div class="section-header-v2">
          <h3>Version-Specific Workflows</h3>
          <span class="badge">${bySource["version-specific"].length}</span>
        </div>
        <div class="list-v2">
          ${bySource["version-specific"].map(wf => renderWorkflowCard(wf)).join("")}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * Render workflow card
 */
function renderWorkflowCard(workflow) {
  const source = workflow.source || "active";
  const sourceBadge = source === "library" ? "Library" : 
                     source === "version-specific" ? "Version" : "Active";
  const sourceColor = source === "library" ? "var(--primary)" : 
                     source === "version-specific" ? "var(--secondary)" : "var(--success)";
  
  // Get execution summary
  const executionCount = workflow.executionCount || 0;
  const lastExecution = workflow.lastExecution || null;
  
  // Get workflow summary/description
  const description = workflow.description || workflow.metadata?.description || "";
  const summary = workflow.summary || "";
  
  return `
    <div class="list-item-v2" onclick="showWorkflowDetailV2('${workflow.id}')">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <h4 style="margin: 0;">${workflow.name || workflow.id}</h4>
            <span class="badge" style="background: ${sourceColor}20; color: ${sourceColor};">
              ${sourceBadge}
            </span>
            ${workflow.automated ? `<span class="badge" style="background: var(--primary-light); color: var(--primary);">🤖 Automated</span>` : ""}
          </div>
          ${description ? `<p style="color: var(--text-light); font-size: 0.875rem; margin: 0 0 0.5rem 0;">${description}</p>` : ""}
          ${summary ? `
            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-sm); margin: 0.5rem 0;">
              <strong style="font-size: 0.875rem; color: var(--text);">Summary:</strong>
              <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: var(--text-light); line-height: 1.5;">
                ${summary.substring(0, 200)}${summary.length > 200 ? "..." : ""}
              </p>
            </div>
          ` : ""}
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); runWorkflowV2('${workflow.id}')">
            Run
          </button>
          ${workflow.executionMode === "step" ? `
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); runWorkflowStepByStepV2('${workflow.id}')">
              Step-by-Step
            </button>
          ` : ""}
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-light); border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.75rem;">
        ${executionCount > 0 ? `
          <div>
            <strong>Executions:</strong> ${executionCount}
          </div>
        ` : ""}
        ${lastExecution ? `
          <div>
            <strong>Last Run:</strong> ${window.formatDateForDisplay ? window.formatDateForDisplay(lastExecution.startedAt) : lastExecution.startedAt}
          </div>
          <div>
            <span class="status-badge ${lastExecution.status}">${lastExecution.status}</span>
          </div>
        ` : ""}
        ${workflow.steps ? `
          <div>
            <strong>Steps:</strong> ${workflow.steps.length || 0}
          </div>
        ` : ""}
        ${workflow.versionTag ? `
          <div>
            <strong>Version:</strong> ${workflow.versionTag}
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

/**
 * Show workflow detail
 */
async function showWorkflowDetailV2(workflowId) {
  try {
    const data = await window.apiCall(`/api/workflows/${workflowId}`);
    const workflow = data.workflow;
    
    if (!workflow) {
      window.showNotification("Workflow not found", "error");
      return;
    }
    
    // Show in modal or navigate to detail view
    const modal = document.getElementById("modal");
    if (modal) {
      const modalBody = document.getElementById("modal-body");
      modalBody.innerHTML = renderWorkflowDetailContent(workflow);
      modal.classList.add("active");
    } else {
      // Fallback: show notification with key info
      window.showNotification(`Workflow: ${workflow.name || workflowId}`, "info");
    }
  } catch (error) {
    console.error("Failed to load workflow detail:", error);
    window.showNotification(`Failed to load workflow: ${error.message}`, "error");
  }
}

/**
 * Render workflow detail content
 */
function renderWorkflowDetailContent(workflow) {
  const steps = workflow.steps || [];
  const source = workflow.source || "active";
  
  return `
    <div style="max-width: 800px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
        <div>
          <h2 style="margin: 0 0 0.5rem 0;">${workflow.name || workflow.id}</h2>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge" style="background: var(--primary-light); color: var(--primary);">
              ${source}
            </span>
            ${workflow.automated ? `<span class="badge">🤖 Automated</span>` : ""}
            ${workflow.executionMode ? `<span class="badge">${workflow.executionMode}</span>` : ""}
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-primary" onclick="runWorkflowV2('${workflow.id}')">Run</button>
          ${workflow.executionMode === "step" ? `
            <button class="btn btn-secondary" onclick="runWorkflowStepByStepV2('${workflow.id}')">Step-by-Step</button>
          ` : ""}
        </div>
      </div>
      
      ${workflow.description ? `
        <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
          <h4 style="margin: 0 0 0.5rem 0;">Description</h4>
          <p style="margin: 0; color: var(--text);">${workflow.description}</p>
        </div>
      ` : ""}
      
      ${workflow.summary ? `
        <div style="background: var(--primary-light); border-left: 4px solid var(--primary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--primary);">Summary</h4>
          <p style="margin: 0; color: var(--text); white-space: pre-wrap;">${workflow.summary}</p>
        </div>
      ` : ""}
      
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin: 0 0 0.75rem 0;">Workflow Steps (${steps.length})</h4>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${steps.map((step, index) => `
            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius); border-left: 4px solid var(--primary);">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <div>
                  <strong>${index + 1}. ${step.id || step.name || "Step"}</strong>
                  <span class="badge" style="margin-left: 0.5rem; font-size: 0.75rem;">
                    ${step.module || "unknown"}.${step.action || "unknown"}
                  </span>
                </div>
              </div>
              ${step.description ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-light);">${step.description}</p>` : ""}
              ${step.condition ? `
                <div style="margin-top: 0.5rem; padding: 0.5rem; background: var(--card-bg); border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--text-light);">
                  <strong>Condition:</strong> ${step.condition}
                </div>
              ` : ""}
            </div>
          `).join("")}
        </div>
      </div>
      
      ${workflow.metadata ? `
        <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius);">
          <h4 style="margin: 0 0 0.5rem 0;">Metadata</h4>
          <pre style="margin: 0; font-size: 0.75rem; color: var(--text-light); overflow-x: auto;">${JSON.stringify(workflow.metadata, null, 2)}</pre>
        </div>
      ` : ""}
    </div>
  `;
}

/**
 * Run workflow
 */
async function runWorkflowV2(workflowId) {
  try {
    // Use the workflow execution API
    const result = await window.apiCall(`/api/workflows/${workflowId}/run`, {
      method: "POST",
      body: JSON.stringify({})
    });
    
    if (result.success) {
      window.showNotification(`Workflow started: ${result.executionId}`, "success");
      
      // Check for decisions after a short delay (workflow might reach decision point quickly)
      setTimeout(async () => {
        if (window.loadPendingDecisions) {
          await window.loadPendingDecisions(result.executionId);
        }
        // Start polling for decisions
        if (window.startDecisionsPolling) {
          window.startDecisionsPolling(result.executionId);
        }
      }, 2000);
      
      // Refresh workflows list to show updated execution count
      if (window.loadWorkflowsV2) {
        setTimeout(() => window.loadWorkflowsV2(), 1000);
      }
    } else {
      window.showNotification("Failed to start workflow", "error");
    }
  } catch (error) {
    console.error("Failed to run workflow:", error);
    window.showNotification(`Failed to run workflow: ${error.message}`, "error");
  }
}

/**
 * Run workflow step by step
 */
async function runWorkflowStepByStepV2(workflowId) {
  try {
    if (window.runWorkflowStepByStep) {
      await window.runWorkflowStepByStep(workflowId);
    } else {
      window.showNotification("Step-by-step execution not available", "error");
    }
  } catch (error) {
    console.error("Failed to run workflow step-by-step:", error);
    window.showNotification(`Failed to run workflow: ${error.message}`, "error");
  }
}

/**
 * Refresh workflows
 */
function refreshWorkflows() {
  loadWorkflowsV2();
}

// Expose globally
window.loadWorkflowsV2 = loadWorkflowsV2;
window.showWorkflowDetailV2 = showWorkflowDetailV2;
window.runWorkflowV2 = runWorkflowV2;
window.runWorkflowStepByStepV2 = runWorkflowStepByStepV2;
window.refreshWorkflows = refreshWorkflows;

