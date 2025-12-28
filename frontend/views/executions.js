/**
 * Executions view module
 */

/**
 * Load executions
 */
async function loadExecutions() {
  try {
    const data = await window.apiCall("/api/executions");
    renderExecutions(data.executions || [], "executions-list");
  } catch (error) {
    console.error("Failed to load executions:", error);
    document.getElementById("executions-list").innerHTML = 
      `<div class="empty-state"><p>Failed to load executions: ${error.message}</p></div>`;
  }
}

/**
 * Render executions
 */
function renderExecutions(executions, containerId) {
  const container = document.getElementById(containerId);
  
  if (executions.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No executions</h3><p>Workflow executions will appear here</p></div>`;
    return;
  }
  
  container.innerHTML = executions.map(exec => {
    const executionId = window.escapeHtml(exec.executionId || "");
    const workflowName = window.escapeHtml(exec.workflow?.name || exec.workflowId || "Unknown");
    const workflowId = exec.workflow?.id ? window.escapeHtml(exec.workflow.id) : "";
    const status = window.escapeHtml(exec.status || "unknown");
    const versionTag = (exec.workflow?.versionTag || exec.versionTag) 
      ? window.escapeHtml(window.normalizeVersionTag ? window.normalizeVersionTag(exec.workflow?.versionTag || exec.versionTag) : (exec.workflow?.versionTag || exec.versionTag))
      : "";
    
    return `
    <div class="list-item" data-execution-id="${executionId}" data-action="show-details" style="cursor: pointer;">
      <div class="list-item-header">
        <div class="list-item-title">${workflowName}</div>
        <span class="status-badge ${status}">${status}</span>
      </div>
      <div class="list-item-body">
        <p><strong>Execution ID:</strong> ${executionId}</p>
        <p><strong>Workflow:</strong> ${workflowName}</p>
        ${versionTag ? `<p><strong>Version:</strong> <span class="version-link">${versionTag}</span></p>` : ""}
        <p><strong>Started:</strong> ${window.formatDateForDisplay(exec.startedAt)}</p>
        ${exec.completedAt ? `<p><strong>Completed:</strong> ${window.formatDateForDisplay(exec.completedAt)}</p>` : ""}
        ${exec.agentCount > 0 ? `<p><strong>Agents:</strong> ${exec.agentCount}</p>` : ""}
      </div>
    </div>
  `;
  }).join("");
  
  // Attach event listeners
  container.querySelectorAll('[data-action="show-details"]').forEach(el => {
    el.addEventListener('click', () => {
      const executionId = el.dataset.executionId;
      if (executionId) showExecutionDetails(executionId);
    });
  });
}

/**
 * Show execution details
 */
/**
 * Check for pending decisions when showing execution details
 */
async function checkExecutionDecisions(executionId) {
  if (window.loadPendingDecisions) {
    await window.loadPendingDecisions(executionId);
    // Start polling if there are pending decisions
    const decisions = await window.apiCall(`/api/executions/${executionId}/decisions`).catch(() => ({ decisions: [] }));
    if (decisions.decisions && decisions.decisions.length > 0) {
      if (window.startDecisionsPolling) {
        window.startDecisionsPolling(executionId);
      }
    }
  }
}

async function showExecutionDetails(executionId) {
  // Check for pending decisions
  await checkExecutionDecisions(executionId);
  try {
    const data = await window.apiCall(`/api/executions/${executionId}`);
    const exec = data.execution;
    
    console.log("Execution details:", {
      executionId: exec.executionId,
      status: exec.status,
      outcome: exec.outcome,
      followUpSuggestions: exec.followUpSuggestions,
      hasFollowUps: exec.followUpSuggestions && Array.isArray(exec.followUpSuggestions) && exec.followUpSuggestions.length > 0
    });
    
    if (!exec) {
      window.showNotification("Execution not found", "error");
      return;
    }
    
    const modalBody = document.getElementById("modal-body");
    const executionIdEscaped = window.escapeHtml(executionId);
    const execIdEscaped = window.escapeHtml(exec.executionId || executionId);
    const workflowName = data.workflow?.name ? window.escapeHtml(data.workflow.name) : window.escapeHtml(exec.workflowId || "Unknown");
    const workflowId = data.workflow?.id ? window.escapeHtml(data.workflow.id) : "";
    const status = window.escapeHtml(exec.status || "unknown");
    const versionTag = (data.workflow?.versionTag || exec.versionTag) 
      ? window.escapeHtml(window.normalizeVersionTag ? window.normalizeVersionTag(data.workflow?.versionTag || exec.versionTag) : (data.workflow?.versionTag || exec.versionTag))
      : "";
    const summary = exec.summary ? window.escapeHtml(exec.summary.substring(0, 500)) + (exec.summary.length > 500 ? '...' : '') : "";
    const executionMode = exec.executionMode === "step" ? "Step-by-step" : "Automatic";
    
    modalBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">Execution: ${execIdEscaped}</h2>
        <div style="display: flex; gap: 0.5rem;">
          ${!exec.outcome && exec.status === "completed" ? `
            <button class="btn btn-secondary" data-action="recalculate-outcome" data-execution-id="${executionIdEscaped}" title="Recalculate outcome and follow-up suggestions">
              🔄 Recalculate Outcome
            </button>
          ` : ""}
          <button class="btn btn-primary" data-action="copy-execution-summary" data-execution-id="${executionIdEscaped}" title="Copy execution summary to clipboard for debugging">
            📋 Copy Summary
          </button>
          ${exec.summary ? `
            <button class="btn btn-secondary" data-action="show-execution-summary" data-execution-id="${executionIdEscaped}" title="View execution summary">
              📄 View Summary
            </button>
          ` : ""}
        </div>
      </div>
      
      ${exec.summary ? `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h3 style="margin: 0; font-size: 1rem;">Execution Summary</h3>
            <button class="btn btn-sm btn-secondary" data-action="show-execution-summary" data-execution-id="${executionIdEscaped}" title="View full summary">
              View Full
            </button>
          </div>
          <pre style="margin: 0; padding: 0.75rem; background: white; border-radius: 0.375rem; font-size: 0.8125rem; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word;">${summary}</pre>
        </div>
      ` : ""}
      <p><strong>Workflow:</strong> ${data.workflow && workflowId ? `<a href="#" data-action="show-workflow-modal" data-workflow-id="${workflowId}" style="color: var(--primary); text-decoration: underline;">${workflowName}</a>` : workflowName}</p>
      ${versionTag ? `<p><strong>Version:</strong> <span class="version-link">${versionTag}</span></p>` : ""}
      <p><strong>Status:</strong> <span class="status-badge ${status}">${status}</span></p>
      <p><strong>Execution Mode:</strong> ${executionMode}</p>
      ${exec.outcome ? `<p><strong>Outcome:</strong> <span style="padding: 0.25rem 0.5rem; background: var(--bg); border-radius: 0.25rem; font-size: 0.875rem;">${window.escapeHtml(exec.outcome)}</span></p>` : ""}
      <p><strong>Started:</strong> ${window.formatDateForDisplay(exec.startedAt)}</p>
      ${exec.completedAt ? `<p><strong>Completed:</strong> ${window.formatDateForDisplay(exec.completedAt)}</p>` : ""}
      ${exec.executionMode === "step" && exec.status === "paused" ? `
        <div style="margin: 1rem 0; padding: 0.75rem; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 0.5rem;">
          <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem;"><strong>Step-by-step mode:</strong> Execution is paused after the last step. Use the controls below to continue.</p>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-primary btn-sm" data-action="run-next-step" data-execution-id="${executionIdEscaped}">
              ▶ Run next step
            </button>
          </div>
        </div>
      ` : ""}
      
      ${exec.followUpSuggestions && Array.isArray(exec.followUpSuggestions) && exec.followUpSuggestions.length > 0 ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: #dbeafe; border: 1px solid #3b82f6; border-radius: 0.5rem;">
          <h3 style="margin-top: 0; color: #1e40af;">Suggested Follow-Up Actions</h3>
          <p style="font-size: 0.875rem; color: #1e3a8a; margin-bottom: 1rem;">
            Based on the workflow outcome, here are suggested next steps:
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${exec.followUpSuggestions.map((suggestion, idx) => {
              const suggestionName = window.escapeHtml(suggestion.name || suggestion.workflowId || "");
              const suggestionDesc = window.escapeHtml(suggestion.description || "");
              const suggestionReason = suggestion.reason ? window.escapeHtml(suggestion.reason) : "";
              const suggestionWorkflowId = window.escapeHtml(suggestion.workflowId || "");
              return `
              <div style="padding: 0.75rem; background: white; border-radius: 0.375rem; border: 1px solid #93c5fd;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                  <div>
                    <strong style="color: #1e40af;">${suggestionName}</strong>
                    ${suggestionDesc ? `<p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: #1e3a8a;">${suggestionDesc}</p>` : ""}
                    ${suggestionReason ? `<p style="margin: 0.25rem 0 0 0; font-size: 0.8125rem; color: #64748b; font-style: italic;">${suggestionReason}</p>` : ""}
                  </div>
                  <button class="btn btn-primary btn-sm" data-action="run-followup-workflow" data-workflow-id="${suggestionWorkflowId}" data-execution-id="${executionIdEscaped}" title="Run this follow-up workflow">
                    ▶ Run
                  </button>
                </div>
              </div>
            `;
            }).join("")}
          </div>
        </div>
      ` : ""}
      
      ${data.agents?.length > 0 ? `
        <h3 style="margin-top: 1.5rem;">Agents (${data.agents.length})</h3>
        <ul>
          ${data.agents.map(a => {
            const agentId = window.escapeHtml(a.id || "");
            const agentStatus = window.escapeHtml(a.status || "unknown");
            return `
            <li>
              <a href="#" data-action="show-agent-modal" data-agent-id="${agentId}" style="color: var(--primary); text-decoration: underline;">
                ${agentId.substring(0, 8)}...
              </a>
              - ${agentStatus}
            </li>
          `;
          }).join("")}
        </ul>
      ` : ""}
      
      <h3 style="margin-top: 1.5rem;">Step-by-step run (Steps ${data.steps?.length || 0})</h3>
      ${data.steps && data.steps.length > 0 ? `
        <div style="margin-bottom: 1rem;">
          ${(() => {
            const completed = data.steps.filter(s => s.status === "completed").length;
            const failed = data.steps.filter(s => s.status === "failed").length;
            const total = data.steps.length;
            return `
              <div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
                <span><strong>Success:</strong> <span style="color: #10b981;">${completed} ✓</span></span>
                <span><strong>Failed:</strong> <span style="color: #ef4444;">${failed} ✗</span></span>
                <span><strong>Total:</strong> ${total}</span>
              </div>
              <div><strong>Overall:</strong> ${failed === 0 && total > 0 ? '<span style="color: #10b981;">✓ Success (Return Code: 0)</span>' : failed > 0 ? `<span style="color: #ef4444;">✗ Failed (Return Code: ${failed})</span>` : "N/A"}</div>
            `;
          })()}
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${data.steps.map((step, idx) => {
              const returnCode = step.return_code !== undefined && step.return_code !== null 
                ? step.return_code 
                : (step.status === "completed" ? 0 : step.status === "failed" ? 1 : null);
              const statusColor = step.status === "completed" ? "#10b981" : step.status === "failed" ? "#ef4444" : "#f59e0b";
              const returnCodeColor = returnCode === 0 ? "#10b981" : returnCode > 0 ? "#ef4444" : "var(--text-light)";
              const hasError = step.error && step.error.trim().length > 0;
              
              return `
                <div class="workflow-step-card" style="${hasError ? 'border-left: 4px solid #ef4444;' : ''}">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: ${hasError ? '0.75rem' : '0'};">
                    <div style="flex: 1;">
                      <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; font-size: 0.8rem; color: var(--text-light);">Step ${idx + 1} of ${data.steps.length}</span>
                        <code style="background: var(--bg); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600;">${step.step_id || step.id || `step-${idx}`}</code>
                        <span style="color: ${statusColor}; font-weight: 600; font-size: 0.875rem;">${step.status || "unknown"}</span>
                        <span style="color: ${returnCodeColor}; font-weight: 600; font-family: monospace; font-size: 0.875rem;">
                          ${returnCode !== null ? `Return Code: ${returnCode} ${returnCode === 0 ? "✓" : "✗"}` : ""}
                        </span>
                      </div>
                      <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem; color: var(--text-light);">
                        <span><strong>Module:</strong> ${step.module || "N/A"}</span>
                        <span><strong>Action:</strong> ${step.action || "N/A"}</span>
                        ${step.duration ? `<span><strong>Duration:</strong> ${step.duration}ms</span>` : ""}
                      </div>
                    </div>
                  </div>
                  ${hasError ? `
                    <div style="margin-top: 0.75rem; padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.375rem;">
                      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span style="color: #dc2626; font-weight: 600;">✗ Error</span>
                      </div>
                      <pre style="margin: 0; padding: 0.5rem; background: white; border-radius: 0.25rem; font-size: 0.8125rem; color: #991b1b; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;">${step.error}</pre>
                    </div>
                  ` : ""}
                  ${step.inputs && Object.keys(step.inputs).length > 0 ? `
                    <details style="margin-top: 0.5rem;">
                      <summary style="cursor: pointer; font-size: 0.875rem; color: var(--text-light); font-weight: 600;">View Inputs</summary>
                      <pre style="margin-top: 0.5rem; padding: 0.5rem; background: var(--bg); border-radius: 0.25rem; font-size: 0.75rem; overflow-x: auto;"><code>${JSON.stringify(step.inputs, null, 2)}</code></pre>
                    </details>
                  ` : ""}
                  ${step.outputs && Object.keys(step.outputs).length > 0 ? `
                    <details style="margin-top: 0.5rem;">
                      <summary style="cursor: pointer; font-size: 0.875rem; color: var(--text-light); font-weight: 600;">View Outputs</summary>
                      <pre style="margin-top: 0.5rem; padding: 0.5rem; background: var(--bg); border-radius: 0.25rem; font-size: 0.75rem; overflow-x: auto;"><code>${JSON.stringify(step.outputs, null, 2)}</code></pre>
                    </details>
                  ` : ""}
                </div>
              `;
            }).join("")}
          </div>
        </div>
        <details style="margin-top: 1rem;">
          <summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Full Step Details (JSON)</summary>
          <pre style="max-height: 300px; overflow-y: auto;"><code>${JSON.stringify(data.steps || [], null, 2)}</code></pre>
        </details>
      ` : "<p>No steps executed yet</p>"}
    `;
    
    window.currentExecutionData = data;
    
    // Attach event listeners
    modalBody.querySelector('[data-action="recalculate-outcome"]')?.addEventListener('click', () => {
      recalculateOutcome(executionId);
    });
    
    modalBody.querySelector('[data-action="copy-execution-summary"]')?.addEventListener('click', () => {
      copyExecutionSummary(executionId);
    });
    
    modalBody.querySelectorAll('[data-action="show-execution-summary"]').forEach(btn => {
      btn.addEventListener('click', () => {
        showExecutionSummary(executionId);
      });
    });
    
    modalBody.querySelector('[data-action="run-next-step"]')?.addEventListener('click', () => {
      runNextStep(executionId);
    });
    
    modalBody.querySelectorAll('[data-action="run-followup-workflow"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const workflowId = btn.dataset.workflowId;
        runFollowUpWorkflow(workflowId, executionId);
      });
    });
    
    modalBody.querySelector('[data-action="show-workflow-modal"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      const workflowId = e.target.dataset.workflowId;
      if (workflowId && window.closeModal && window.switchView && window.showWorkflowDetails) {
        window.closeModal();
        window.switchView('workflows');
        window.showWorkflowDetails(workflowId);
      }
    });
    
    modalBody.querySelectorAll('[data-action="show-agent-modal"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const agentId = link.dataset.agentId;
        if (agentId && window.closeModal && window.switchView && window.showAgentDetails) {
          window.closeModal();
          window.switchView('agents');
          window.showAgentDetails(agentId);
        }
      });
    });
    
    document.getElementById("modal").classList.add("active");
  } catch (error) {
    console.error("Failed to load execution details:", error);
    window.showNotification(`Failed to load execution: ${error.message}`, "error");
  }
}

/**
 * Recalculate outcome for an execution
 */
async function recalculateOutcome(executionId) {
  try {
    window.showNotification("Recalculating outcome and follow-up suggestions...", "info");
    
    const currentData = await window.apiCall(`/api/executions/${executionId}`);
    const data = await window.apiCall(`/api/executions/${executionId}?_recalculate=true`);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await showExecutionDetails(executionId);
    
    const exec = data.execution;
    if (exec.followUpSuggestions && exec.followUpSuggestions.length > 0) {
      window.showNotification(`Outcome recalculated! Found ${exec.followUpSuggestions.length} follow-up suggestion(s).`, "success");
    } else {
      window.showNotification("Outcome recalculated, but no follow-up suggestions found.", "info");
    }
  } catch (error) {
    console.error("Failed to recalculate outcome:", error);
    window.showNotification(`Failed to recalculate: ${error.message}`, "error");
  }
}

/**
 * Run a follow-up workflow
 */
async function runFollowUpWorkflow(workflowId, parentExecutionId) {
  if (!confirm(`Run follow-up workflow "${workflowId}"?\n\nThis will start a new workflow execution.`)) {
    return;
  }
  
  try {
    window.showNotification("Starting follow-up workflow...", "info");
    
    const response = await fetch(`/api/workflows/${workflowId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        parentExecutionId: parentExecutionId
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to run workflow");
    }
    
    const data = await response.json();
    window.showNotification(`Follow-up workflow started! Execution ID: ${data.executionId.substring(0, 8)}...`, "success");
    
    window.closeModal();
    if (window.currentView === "executions") {
      loadExecutions();
    } else {
      window.switchView("executions");
    }
  } catch (error) {
    console.error("Failed to run follow-up workflow:", error);
    window.showNotification(`Failed to run workflow: ${error.message}`, "error");
  }
}

/**
 * Run the next step for a step-by-step execution
 */
async function runNextStep(executionId) {
  try {
    window.showNotification("Running next step...", "info");
    
    const response = await fetch(`/api/executions/${executionId}/next-step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Failed to run next step");
    }
    
    window.showNotification(result.done ? "Workflow completed." : "Step completed. Execution paused.", "success");
    
    showExecutionDetails(executionId);
    
    if (window.currentView === "executions") {
      loadExecutions();
    } else if (window.currentView === "dashboard") {
      window.loadDashboard();
    }
  } catch (error) {
    console.error("Failed to run next step:", error);
    window.showNotification(`Failed to run next step: ${error.message}`, "error");
  }
}

/**
 * Copy execution summary to clipboard for debugging
 */
async function copyExecutionSummary(executionId) {
  try {
    const data = await window.apiCall(`/api/executions/${executionId}`);
    const exec = data.execution;
    
    let summary = exec.summary;
    
    if (!summary) {
      const workflow = data.workflow;
      const steps = data.steps || [];
      const agents = data.agents || [];
      
      const completedSteps = steps.filter(s => s.status === "completed");
      const failedSteps = steps.filter(s => s.status === "failed");
      const totalSteps = steps.length;
      const successCount = completedSteps.length;
      const failureCount = failedSteps.length;
      const overallReturnCode = failureCount === 0 && totalSteps > 0 ? 0 : failureCount > 0 ? failureCount : null;
      
      summary = `# Execution Summary: ${exec.executionId}\n\n`;
      summary += `## Basic Information\n`;
      summary += `- **Execution ID:** ${exec.executionId}\n`;
      summary += `- **Status:** ${exec.status} ${exec.status === "completed" ? "✓" : exec.status === "failed" ? "✗" : ""}\n`;
      summary += `- **Workflow:** ${workflow ? `${workflow.name} (${workflow.id})` : exec.workflowId || "Unknown"}\n`;
      summary += `- **Version Tag:** ${exec.versionTag || data.workflow?.versionTag || "N/A"}\n`;
      summary += `- **Steps Summary:** ${successCount} succeeded, ${failureCount} failed, ${totalSteps} total\n`;
      summary += `- **Overall Return Code:** ${overallReturnCode !== null ? `${overallReturnCode} ${overallReturnCode === 0 ? "✓ Success" : "✗ Failed"}` : "N/A"}\n`;
      
      const formatDate = (dateValue) => {
        if (!dateValue) return "N/A";
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return "Invalid date";
          return date.toISOString();
        } catch (e) {
          return String(dateValue);
        }
      };
      
      const isRunning = exec.status === "running" || exec.status === "pending" || !exec.completedAt;
      
      summary += `- **Started:** ${formatDate(exec.startedAt)}\n`;
      if (exec.completedAt && !isNaN(new Date(exec.completedAt).getTime())) {
        summary += `- **Completed:** ${formatDate(exec.completedAt)}\n`;
        try {
          const startDate = new Date(exec.startedAt);
          const endDate = new Date(exec.completedAt);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const duration = endDate - startDate;
            summary += `- **Duration:** ${Math.round(duration / 1000)}s\n`;
          }
        } catch (e) {
          // Skip duration if dates are invalid
        }
      } else {
        summary += `- **Completed:** ${isRunning ? "Still running" : "N/A"}\n`;
      }
      
      if (exec.error) {
        summary += `\n## Error\n\`\`\`\n${exec.error}\n\`\`\`\n`;
      }
      
      if (agents.length > 0) {
        summary += `\n## Agents (${agents.length})\n\n`;
        agents.forEach((agent, index) => {
          summary += `### Agent ${index + 1}: ${agent.id.substring(0, 8)}...\n`;
          summary += `- **Status:** ${agent.status}\n`;
          summary += `- **Type:** ${agent.type}\n`;
          if (agent.createdAt) {
            summary += `- **Created:** ${formatDate(agent.createdAt)}\n`;
          }
          if (agent.readyAt) {
            summary += `- **Ready:** ${formatDate(agent.readyAt)}\n`;
          }
          if (agent.completedAt) {
            summary += `- **Completed:** ${formatDate(agent.completedAt)}\n`;
          }
          summary += `\n`;
        });
      }
      
      if (steps.length > 0) {
        summary += `\n## Step Executions (${steps.length})\n\n`;
        steps.forEach((step, index) => {
          summary += `### Step ${index + 1}: ${step.step_id || step.id || "unknown"}\n`;
          summary += `- **Module:** ${step.module || "N/A"}\n`;
          summary += `- **Action:** ${step.action || "N/A"}\n`;
          summary += `- **Status:** ${step.status || "unknown"}\n`;
          summary += `- **Return Code:** ${step.return_code !== undefined && step.return_code !== null ? step.return_code : (step.status === "completed" ? "0" : (step.status === "failed" ? "1" : "N/A"))} ${step.return_code === 0 ? "✓" : step.return_code > 0 ? "✗" : ""}\n`;
          if (step.started_at) {
            summary += `- **Started:** ${formatDate(step.started_at)}\n`;
          }
          if (step.completed_at) {
            summary += `- **Completed:** ${formatDate(step.completed_at)}\n`;
          }
          if (step.duration) {
            summary += `- **Duration:** ${step.duration}ms\n`;
          }
          if (step.inputs) {
            try {
              const inputs = typeof step.inputs === "string" ? JSON.parse(step.inputs) : step.inputs;
              summary += `- **Inputs:**\n\`\`\`json\n${JSON.stringify(inputs, null, 2)}\n\`\`\`\n`;
            } catch (e) {
              summary += `- **Inputs:** ${step.inputs}\n`;
            }
          }
          if (step.outputs) {
            try {
              const outputs = typeof step.outputs === "string" ? JSON.parse(step.outputs) : step.outputs;
              summary += `- **Outputs:**\n\`\`\`json\n${JSON.stringify(outputs, null, 2)}\n\`\`\`\n`;
            } catch (e) {
              summary += `- **Outputs:** ${step.outputs}\n`;
            }
          }
          if (step.error) {
            summary += `- **Error:**\n\`\`\`\n${step.error}\n\`\`\`\n`;
          }
          summary += `\n`;
        });
      }
      
      summary += `\n---\n`;
      summary += `*Generated from kaczmarek.ai-dev execution ${exec.executionId}*\n`;
    }
    
    await navigator.clipboard.writeText(summary);
    window.showNotification("Execution summary copied to clipboard!", "success");
  } catch (error) {
    console.error("Failed to copy execution summary:", error);
    window.showNotification(`Failed to copy: ${error.message}`, "error");
  }
}

// Expose globally
window.loadExecutions = loadExecutions;
window.renderExecutions = renderExecutions;
window.showExecutionDetails = showExecutionDetails;
window.recalculateOutcome = recalculateOutcome;
window.runFollowUpWorkflow = runFollowUpWorkflow;
window.runNextStep = runNextStep;
window.copyExecutionSummary = copyExecutionSummary;

