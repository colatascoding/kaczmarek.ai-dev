/**
 * kaczmarek.ai-dev Frontend Application
 */

const API_BASE = ""; // Same origin

// State
let currentView = "dashboard";

/**
 * Safely format a date value for display
 */
function formatDateForDisplay(dateValue) {
  if (!dateValue) return "N/A";
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      // Return the original value if it's not a valid date
      return String(dateValue);
    }
    return date.toLocaleString();
  } catch (e) {
    return String(dateValue);
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  loadDashboard();
});

/**
 * Setup navigation
 */
function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

/**
 * Switch view
 */
function switchView(view) {
  currentView = view;
  
  // Update nav
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  
  // Update views
  document.querySelectorAll(".view").forEach(v => {
    v.classList.toggle("active", v.id === `${view}-view`);
  });
  
  // Load view data
  switch (view) {
    case "dashboard":
      loadDashboard();
      break;
    case "workflows":
      loadWorkflows();
      break;
    case "agents":
      loadAgents();
      break;
    case "executions":
      loadExecutions();
      break;
    case "versions":
      loadVersions();
      break;
  }
}

/**
 * API Helper
 */
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

/**
 * Load dashboard
 */
async function loadDashboard() {
  try {
    // Load stats
    const [workflows, agents, executions, versions] = await Promise.all([
      apiCall("/api/workflows"),
      apiCall("/api/agents"),
      apiCall("/api/executions"),
      apiCall("/api/versions")
    ]);
    
    // Update stats
    document.getElementById("workflow-count").textContent = workflows.workflows?.length || 0;
    document.getElementById("agent-count").textContent = agents.agents?.filter(a => a.status !== "completed").length || 0;
    document.getElementById("execution-count").textContent = executions.executions?.length || 0;
    document.getElementById("version-count").textContent = versions.versions?.length || 0;
    
    // Recent executions
    const recentExecutions = executions.executions
      ?.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, 5) || [];
    
    renderExecutions(recentExecutions, "recent-executions");
    
    // Active agents
    const activeAgents = agents.agents
      ?.filter(a => a.status !== "completed")
      .slice(0, 5) || [];
    
    renderAgents(activeAgents, "active-agents");
    
    // Latest version
    const latestVersion = versions.versions?.[0];
    if (latestVersion) {
      renderVersionSummary(latestVersion, "latest-version");
    }
  } catch (error) {
    console.error("Failed to load dashboard:", error);
  }
}

/**
 * Load workflows
 */
async function loadWorkflows() {
  try {
    const data = await apiCall("/api/workflows");
    renderWorkflows(data.workflows || []);
  } catch (error) {
    console.error("Failed to load workflows:", error);
    document.getElementById("workflows-list").innerHTML = 
      `<div class="empty-state"><p>Failed to load workflows: ${error.message}</p></div>`;
  }
}

/**
 * Render workflows
 */
function renderWorkflows(workflows) {
  const container = document.getElementById("workflows-list");
  
  if (workflows.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No workflows found</h3><p>Create workflows in the workflows/ directory</p></div>`;
    return;
  }
  
  container.innerHTML = workflows.map(wf => `
    <div class="list-item" onclick="showWorkflowDetails('${wf.id}')" style="cursor: pointer;">
      <div class="list-item-header">
        <div class="list-item-title">${wf.name}</div>
        <div class="list-item-meta">
          ${wf.versionTag ? `<span class="version-link">${wf.versionTag}</span>` : ""}
          ${wf.executionCount > 0 ? `<span>${wf.executionCount} executions</span>` : ""}
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); runWorkflow('${wf.id}');" style="margin-left: 0.5rem;">
            ▶ Run
          </button>
        </div>
      </div>
      ${wf.description ? `<div class="list-item-summary">${wf.description}</div>` : ""}
      <div class="list-item-body">
        <p><strong>ID:</strong> ${wf.id}</p>
        ${wf.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${wf.versionTag}</span></p>` : ""}
        ${wf.executionCount > 0 ? `<p><strong>Executions:</strong> ${wf.executionCount}</p>` : ""}
      </div>
    </div>
  `).join("");
}

/**
 * Show workflow details
 */
async function showWorkflowDetails(workflowId) {
  try {
    const data = await apiCall(`/api/workflows/${workflowId}`);
    const wf = data.workflow;
    
    console.log("Workflow data:", { workflowId, hasWorkflow: !!wf, stepsCount: wf?.steps?.length, workflow: wf });
    
    if (!wf) {
      console.error("No workflow data received");
      alert("Failed to load workflow data. Check console for details.");
      return;
    }
    
    const modalBody = document.getElementById("modal-body");
    if (!modalBody) {
      console.error("Modal body element not found");
      return;
    }
    
    // Clear any previous content
    modalBody.innerHTML = "";
    
    // Build the content step by step to avoid template string issues
    let content = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">${wf.name || workflowId}</h2>
        <button class="btn btn-primary" onclick="runWorkflow('${workflowId}')">
          ▶ Run Workflow
        </button>
      </div>
      <p><strong>Version:</strong> ${wf.version || "N/A"}</p>
      ${data.versionTag ? `<p><strong>Version Tag:</strong> <span class="version-link">${data.versionTag}</span></p>` : ""}
      <p><strong>Description:</strong> ${wf.description || "N/A"}</p>
      
      ${data.relatedFiles && data.relatedFiles.length > 0 ? `
        <h3 style="margin-top: 1.5rem;">Related Files (${data.relatedFiles.length})</h3>
        <div class="related-files-list">
          ${data.relatedFiles.map(file => `
            <div class="related-file-item">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="file-type-badge ${file.type}">${file.type}</span>
                <strong>${file.label || file.name}</strong>
                ${file.version ? `<span class="version-link" style="font-size: 0.75rem;">${file.version}</span>` : ""}
              </div>
              <div style="font-size: 0.875rem; color: var(--text-light); margin-top: 0.25rem;">
                ${file.relative}
              </div>
            </div>
          `).join("")}
        </div>
      ` : ""}
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; margin-bottom: 1rem;">
        <h3 style="margin: 0;">Workflow Steps (${wf.steps?.length || 0})</h3>
        <div class="workflow-steps-filter" style="display: flex; gap: 0.5rem; align-items: center;">
          <label style="font-size: 0.875rem; color: var(--text-light);">Filter:</label>
          <button class="filter-btn active" data-filter="all" onclick="filterWorkflowSteps('all', '${workflowId}')" style="padding: 0.375rem 0.75rem; border: 1px solid var(--border); background: var(--card-bg); border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">All</button>
          <button class="filter-btn" data-filter="human" onclick="filterWorkflowSteps('human', '${workflowId}')" style="padding: 0.375rem 0.75rem; border: 1px solid var(--border); background: var(--card-bg); border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">Human</button>
          <button class="filter-btn" data-filter="background-agent" onclick="filterWorkflowSteps('background-agent', '${workflowId}')" style="padding: 0.375rem 0.75rem; border: 1px solid var(--border); background: var(--card-bg); border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">Background Agent</button>
        </div>
      </div>
      ${wf.steps && Array.isArray(wf.steps) && wf.steps.length > 0 ? `
      <div class="workflow-steps-view" id="workflow-steps-container" style="display: block; visibility: visible;">
      </div>
      ` : `<p style="color: var(--text-light); font-style: italic;">No steps defined in this workflow.</p>`}
      
      <details style="margin-top: 1.5rem;">
        <summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Raw Workflow JSON</summary>
        <pre><code>${JSON.stringify(wf.steps || [], null, 2)}</code></pre>
      </details>
      
      <h3 style="margin-top: 1.5rem;">Executions (${data.executions?.length || 0})</h3>
      ${data.executions?.length > 0 ? `
        <ul>
          ${data.executions.map(e => `
            <li>
              <a href="#" onclick="closeModal(); switchView('executions'); showExecutionDetails('${e.executionId}'); return false;">
                ${e.executionId}
              </a>
              - ${e.status} - ${formatDateForDisplay(e.startedAt)}
              ${e.agents?.length > 0 ? ` (${e.agents.length} agents)` : ""}
            </li>
          `).join("")}
        </ul>
      ` : "<p>No executions yet</p>"}
    `;
    
    // Set the content
    modalBody.innerHTML = content;
    console.log("Modal content set, steps count:", wf.steps?.length || 0);
    
    // Render steps using DOM API to avoid template string issues
    const stepsContainer = modalBody.querySelector("#workflow-steps-container");
    if (stepsContainer && wf.steps && Array.isArray(wf.steps) && wf.steps.length > 0) {
      console.log("Rendering", wf.steps.length, "steps using DOM API");
      
      wf.steps.forEach((step, index) => {
        // Define variables outside try block to ensure they're always in scope
        let stepCard, stepId, module, action, description, inputs, outputs, onSuccess, onFailure;
        let executionType, executionTypeLabel;
        
        try {
          stepCard = document.createElement("div");
          stepCard.className = "workflow-step-card";
          
          stepId = step.id || `step-${index}`;
          module = step.module || "unknown";
          action = step.action || "unknown";
          description = step.description || "";
          inputs = step.inputs || {};
          outputs = step.outputs || [];
          onSuccess = step.onSuccess;
          onFailure = step.onFailure || "";
          
          // Determine execution type: "background-agent" if module is "agent", otherwise "human"
          executionType = (module === "agent") ? "background-agent" : "human";
          executionTypeLabel = (executionType === "background-agent") ? "Background Agent" : "Human";
          stepCard.setAttribute("data-execution-type", executionType);
          
          // Build success routing display
          let successDisplay = "";
          if (onSuccess) {
            if (typeof onSuccess === "string") {
              successDisplay = `
                <div class="routing-item">
                  <span class="routing-label">On Success:</span>
                  <span class="routing-arrow">→</span>
                  <span class="routing-target">${onSuccess}</span>
                </div>
              `;
            } else if (typeof onSuccess === "object" && onSuccess.then) {
              successDisplay = `
                <div class="routing-item">
                  <span class="routing-label">On Success:</span>
                  ${onSuccess.condition ? `<span class="routing-condition">${onSuccess.condition}</span>` : ""}
                  <span class="routing-arrow">→</span>
                  <span class="routing-target">${onSuccess.then}</span>
                  ${onSuccess.else ? `<span class="routing-else">else → ${onSuccess.else}</span>` : ""}
                </div>
              `;
            }
          }
          
          // Build inputs section
          let inputsHtml = "";
          if (Object.keys(inputs).length > 0) {
            inputsHtml = `
              <div class="workflow-step-section">
                <strong>Inputs:</strong>
                <pre class="workflow-step-code">${JSON.stringify(inputs, null, 2)}</pre>
              </div>
            `;
          }
          
          // Build outputs section
          let outputsHtml = "";
          if (outputs && outputs.length > 0) {
            const outputsList = outputs.map(o => {
              const name = typeof o === "string" ? o : (o.name || "unknown");
              const type = typeof o === "object" ? (o.type || "any") : "any";
              return `<li><code>${name}</code> (${type})</li>`;
            }).join("");
            outputsHtml = `
              <div class="workflow-step-section">
                <strong>Outputs:</strong>
                <ul class="workflow-step-list">${outputsList}</ul>
              </div>
            `;
          }
          
          // Build failure routing
          let failureHtml = "";
          if (onFailure) {
            failureHtml = `
              <div class="routing-item routing-failure">
                <span class="routing-label">On Failure:</span>
                <span class="routing-arrow">→</span>
                <span class="routing-target">${onFailure}</span>
              </div>
            `;
          }
          
          stepCard.innerHTML = `
            <div class="workflow-step-header">
              <div class="workflow-step-number">${index + 1}</div>
              <div class="workflow-step-info">
                <h4>${stepId}</h4>
                <div class="workflow-step-meta">
                  <span class="module-badge">${module}</span>
                  <span class="action-badge">${action}</span>
                  <span class="execution-type-badge execution-type-${executionType}">${executionTypeLabel}</span>
                </div>
              </div>
            </div>
            ${description ? `<p class="workflow-step-description">${description}</p>` : ""}
            ${inputsHtml}
            ${outputsHtml}
            <div class="workflow-step-routing">
              ${successDisplay}
              ${failureHtml}
            </div>
          `;
          
          stepsContainer.appendChild(stepCard);
        } catch (e) {
          console.error("Error rendering step:", e, step);
          const errorCard = document.createElement("div");
          errorCard.className = "workflow-step-card";
          errorCard.innerHTML = `<p style="color: red;">Error rendering step: ${e.message}</p>`;
          stepsContainer.appendChild(errorCard);
        }
      });
      
      console.log("Steps rendered successfully, container now has", stepsContainer.children.length, "step cards");
      // Ensure visibility
      stepsContainer.style.display = "block";
      stepsContainer.style.visibility = "visible";
    } else if (wf.steps && Array.isArray(wf.steps) && wf.steps.length > 0) {
      console.error("Steps container not found but steps exist!");
    }
    
    // Show the modal
    const modal = document.getElementById("modal");
    if (modal) {
      modal.classList.add("active");
      console.log("Modal opened");
    } else {
      console.error("Modal element not found");
    }
  } catch (error) {
    console.error("Failed to load workflow details:", error);
    alert("Failed to load workflow details. Check console for details.");
  }
}

// Expose showWorkflowDetails globally
window.showWorkflowDetails = showWorkflowDetails;

/**
 * Filter workflow steps by execution type
 */
function filterWorkflowSteps(filterType, workflowId) {
  const stepsContainer = document.getElementById("workflow-steps-container");
  if (!stepsContainer) return;
  
  // Update filter buttons
  const filterButtons = document.querySelectorAll(`.workflow-steps-filter .filter-btn`);
  filterButtons.forEach(btn => {
    if (btn.getAttribute("data-filter") === filterType) {
      btn.classList.add("active");
      btn.style.background = "var(--primary)";
      btn.style.color = "white";
      btn.style.borderColor = "var(--primary)";
    } else {
      btn.classList.remove("active");
      btn.style.background = "var(--card-bg)";
      btn.style.color = "var(--text)";
      btn.style.borderColor = "var(--border)";
    }
  });
  
  // Filter steps
  const stepCards = stepsContainer.querySelectorAll(".workflow-step-card");
  let visibleCount = 0;
  
  stepCards.forEach(card => {
    const executionType = card.getAttribute("data-execution-type");
    
    if (filterType === "all") {
      card.style.display = "block";
      visibleCount++;
    } else if (filterType === executionType) {
      card.style.display = "block";
      visibleCount++;
    } else {
      card.style.display = "none";
    }
  });
  
  // Update step count in header
  const stepsHeader = document.querySelector("h3");
  if (stepsHeader && stepsHeader.textContent.includes("Workflow Steps")) {
    const totalSteps = stepCards.length;
    if (filterType === "all") {
      stepsHeader.textContent = `Workflow Steps (${totalSteps})`;
    } else {
      stepsHeader.textContent = `Workflow Steps (${visibleCount} of ${totalSteps})`;
    }
  }
  
  console.log(`Filtered steps: showing ${visibleCount} of ${stepCards.length} (filter: ${filterType})`);
}

// Expose filterWorkflowSteps globally
window.filterWorkflowSteps = filterWorkflowSteps;

/**
 * Load agents
 */
async function loadAgents() {
  try {
    const data = await apiCall("/api/agents");
    renderAgents(data.agents || [], "agents-list");
  } catch (error) {
    console.error("Failed to load agents:", error);
    document.getElementById("agents-list").innerHTML = 
      `<div class="empty-state"><p>Failed to load agents: ${error.message}</p></div>`;
  }
}

/**
 * Render agents
 */
function renderAgents(agents, containerId) {
  const container = document.getElementById(containerId);
  
  if (agents.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No agent tasks</h3><p>Agent tasks will appear here when workflows are executed</p></div>`;
    return;
  }
  
  container.innerHTML = agents.map(agent => {
    const agentId = agent.id || "";
    const executionId = agent.execution?.executionId || agent.executionId || "";
    const createdAt = agent.createdAt || agent.startedAt || new Date().toISOString();
    
    return `
    <div class="list-item" onclick="showAgentDetails('${agentId}')">
      <div class="list-item-header">
        <div class="list-item-title">${agentId ? agentId.substring(0, 8) + "..." : "Unknown"}</div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="status-badge ${agent.status || "unknown"}">${agent.status || "unknown"}</span>
          ${(agent.status === "ready" || agent.status === "partial") ? `
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); completeAgentTask('${agentId}');" title="Mark task as completed">
              ✓ Complete
            </button>
          ` : ""}
        </div>
      </div>
      <div class="list-item-body">
        <p><strong>Type:</strong> ${agent.type || "unknown"}</p>
        <p><strong>Tasks:</strong> ${agent.tasks?.length || 0}</p>
        <p><strong>Created:</strong> ${formatDateForDisplay(createdAt)}</p>
        ${executionId ? `<p><strong>Execution:</strong> <a href="#" onclick="event.stopPropagation(); switchView('executions'); showExecutionDetails('${executionId}'); return false;">${executionId.substring(0, 8)}...</a></p>` : ""}
        ${agent.workflow ? `<p><strong>Workflow:</strong> ${agent.workflow.name}</p>` : ""}
        ${agent.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${agent.versionTag}</span></p>` : ""}
      </div>
    </div>
  `;
  }).join("");
}

/**
 * Show agent details
 */
async function showAgentDetails(agentId) {
  try {
    const data = await apiCall(`/api/agents/${agentId}`);
    const agent = data.agent;
    
    const modalBody = document.getElementById("modal-body");
    modalBody.innerHTML = `
      <h2>Agent Task: ${agent.id}</h2>
      <p><strong>Status:</strong> <span class="status-badge ${agent.status}">${agent.status}</span></p>
      <p><strong>Type:</strong> ${agent.type}</p>
      ${agent.execution ? `
        <p><strong>Execution:</strong> 
          <a href="#" onclick="closeModal(); switchView('executions'); showExecutionDetails('${agent.execution.executionId}'); return false;">
            ${agent.execution.executionId}
          </a>
        </p>
      ` : ""}
      ${agent.workflow ? `
        <p><strong>Workflow:</strong> 
          <a href="#" onclick="closeModal(); switchView('workflows'); showWorkflowDetails('${agent.workflow.id}'); return false;">
            ${agent.workflow.name}
          </a>
        </p>
        ${agent.workflow.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${agent.workflow.versionTag}</span></p>` : ""}
      ` : ""}
      ${agent.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${agent.versionTag}</span></p>` : ""}
      <p><strong>Created:</strong> ${formatDateForDisplay(agent.startedAt)}</p>
      ${agent.readyAt ? `<p><strong>Ready:</strong> ${formatDateForDisplay(agent.readyAt)}</p>` : ""}
      ${agent.completedAt ? `<p><strong>Completed:</strong> ${formatDateForDisplay(agent.completedAt)}</p>` : ""}
      
      <h3 style="margin-top: 1.5rem;">Prompt</h3>
      <pre><code>${agent.prompt || "N/A"}</code></pre>
      
      <h3 style="margin-top: 1.5rem;">Tasks (${agent.tasks?.length || 0})</h3>
      <pre><code>${JSON.stringify(agent.tasks || [], null, 2)}</code></pre>
      
      ${agent.executionResults ? `
        <h3 style="margin-top: 1.5rem;">Execution Results</h3>
        <pre><code>${JSON.stringify(agent.executionResults, null, 2)}</code></pre>
      ` : ""}
      
      ${agent.status === "ready" || agent.status === "partial" ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: var(--bg); border-radius: 0.5rem; border: 1px solid var(--border);">
          <h4 style="margin-top: 0;">Complete Task</h4>
          <p style="font-size: 0.875rem; color: var(--text-light); margin-bottom: 1rem;">
            Mark this task as completed. This will:
            <ul style="margin: 0.5rem 0; padding-left: 1.5rem; font-size: 0.875rem;">
              <li>Mark the task as completed in the queue</li>
              <li>Update the progress file with completion entry</li>
              <li>Mark related tasks as [x] in the review file</li>
            </ul>
          </p>
          <button class="btn btn-primary" onclick="completeAgentTask('${agent.id}')">
            ✓ Mark as Completed
          </button>
        </div>
      ` : ""}
    `;
    
    document.getElementById("modal").classList.add("active");
  } catch (error) {
    console.error("Failed to load agent details:", error);
  }
}

// Expose showAgentDetails globally
window.showAgentDetails = showAgentDetails;

/**
 * Complete an agent task
 */
async function completeAgentTask(agentId) {
  if (!confirm(`Are you sure you want to mark task ${agentId.substring(0, 8)}... as completed?\n\nThis will update the progress and review files.`)) {
    return;
  }

  try {
    // Show loading state
    const loadingMsg = document.createElement("div");
    loadingMsg.id = "agent-completing-msg";
    loadingMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: var(--primary); color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
    loadingMsg.textContent = `Completing task: ${agentId.substring(0, 8)}...`;
    document.body.appendChild(loadingMsg);
    
    const response = await fetch(`/api/agents/${agentId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    
    const result = await response.json();
    
    // Remove loading message
    document.body.removeChild(loadingMsg);
    
    if (result.success) {
      // Show success message
      const successMsg = document.createElement("div");
      successMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
      successMsg.textContent = `✓ Task completed! Progress and review files updated.`;
      document.body.appendChild(successMsg);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (document.body.contains(successMsg)) {
          document.body.removeChild(successMsg);
        }
      }, 3000);
      
      // Close modal and refresh
      closeModal();
      
      // Refresh agents list
      setTimeout(() => {
        loadAgents();
        if (currentView === "dashboard") {
          loadDashboard();
        }
      }, 500);
    } else {
      throw new Error(result.error || "Failed to complete task");
    }
  } catch (error) {
    // Show error message
    const errorMsg = document.createElement("div");
    errorMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
    errorMsg.textContent = `✗ Error: ${error.message}`;
    document.body.appendChild(errorMsg);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(errorMsg)) {
        document.body.removeChild(errorMsg);
      }
    }, 5000);
    
    console.error("Failed to complete agent task:", error);
  }
}

// Expose completeAgentTask globally
window.completeAgentTask = completeAgentTask;

/**
 * Load executions
 */
async function loadExecutions() {
  try {
    const data = await apiCall("/api/executions");
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
  
  container.innerHTML = executions.map(exec => `
    <div class="list-item" onclick="showExecutionDetails('${exec.executionId}')">
      <div class="list-item-header">
        <div class="list-item-title">${exec.workflow?.name || exec.workflowId || "Unknown"}</div>
        <span class="status-badge ${exec.status}">${exec.status}</span>
      </div>
      <div class="list-item-body">
        <p><strong>Execution ID:</strong> ${exec.executionId}</p>
        <p><strong>Workflow:</strong> ${exec.workflow?.name || exec.workflowId || "Unknown"}</p>
        ${exec.workflow?.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${exec.workflow.versionTag}</span></p>` : ""}
        ${exec.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${exec.versionTag}</span></p>` : ""}
        <p><strong>Started:</strong> ${formatDateForDisplay(exec.startedAt)}</p>
        ${exec.completedAt ? `<p><strong>Completed:</strong> ${formatDateForDisplay(exec.completedAt)}</p>` : ""}
        ${exec.agentCount > 0 ? `<p><strong>Agents:</strong> ${exec.agentCount}</p>` : ""}
      </div>
    </div>
  `).join("");
}

/**
 * Show execution details
 */
async function showExecutionDetails(executionId) {
  try {
    const data = await apiCall(`/api/executions/${executionId}`);
    const exec = data.execution;
    const modalBody = document.getElementById("modal-body");
    modalBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">Execution: ${exec.executionId}</h2>
        <button class="btn btn-primary" onclick="copyExecutionSummary('${executionId}')" title="Copy execution summary to clipboard for debugging">
          📋 Copy Summary
        </button>
      </div>
      <p><strong>Workflow:</strong> ${data.workflow ? `<a href="#" onclick="closeModal(); switchView('workflows'); showWorkflowDetails('${data.workflow.id}'); return false;">${data.workflow.name}</a>` : exec.workflowId || "Unknown"}</p>
      ${data.workflow?.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${data.workflow.versionTag}</span></p>` : ""}
      ${exec.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${exec.versionTag}</span></p>` : ""}
      <p><strong>Status:</strong> <span class="status-badge ${exec.status}">${exec.status}</span></p>
      <p><strong>Started:</strong> ${formatDateForDisplay(exec.startedAt)}</p>
      ${exec.completedAt ? `<p><strong>Completed:</strong> ${formatDateForDisplay(exec.completedAt)}</p>` : ""}
      
      ${data.agents?.length > 0 ? `
        <h3 style="margin-top: 1.5rem;">Agents (${data.agents.length})</h3>
        <ul>
          ${data.agents.map(a => `
            <li>
              <a href="#" onclick="closeModal(); switchView('agents'); showAgentDetails('${a.id}'); return false;">
                ${a.id.substring(0, 8)}...
              </a>
              - ${a.status}
            </li>
          `).join("")}
        </ul>
      ` : ""}
      
      <h3 style="margin-top: 1.5rem;">Steps (${data.steps?.length || 0})</h3>
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
                <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; ${hasError ? 'border-left: 4px solid #ef4444;' : ''}">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: ${hasError ? '0.75rem' : '0'};">
                    <div style="flex: 1;">
                      <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.5rem;">
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
    
    // Store execution data for copying
    window.currentExecutionData = data;
    
    document.getElementById("modal").classList.add("active");
  } catch (error) {
    console.error("Failed to load execution details:", error);
  }
}

// Expose showExecutionDetails globally
window.showExecutionDetails = showExecutionDetails;

/**
 * Copy execution summary to clipboard for debugging
 */
async function copyExecutionSummary(executionId) {
  try {
    const data = window.currentExecutionData;
    if (!data) {
      // Reload if not available
      const response = await fetch(`/api/executions/${executionId}`);
      data = await response.json();
    }
    
    const exec = data.execution;
    const workflow = data.workflow;
    const steps = data.steps || [];
    const agents = data.agents || [];
    
    // Calculate overall return code from steps
    const completedSteps = steps.filter(s => s.status === "completed");
    const failedSteps = steps.filter(s => s.status === "failed");
    const totalSteps = steps.length;
    const successCount = completedSteps.length;
    const failureCount = failedSteps.length;
    const overallReturnCode = failureCount === 0 && totalSteps > 0 ? 0 : failureCount > 0 ? failureCount : null;
    
    // Format execution summary for debugging
    let summary = `# Execution Summary: ${exec.executionId}\n\n`;
    summary += `## Basic Information\n`;
    summary += `- **Execution ID:** ${exec.executionId}\n`;
    summary += `- **Status:** ${exec.status} ${exec.status === "completed" ? "✓" : exec.status === "failed" ? "✗" : ""}\n`;
    summary += `- **Workflow:** ${workflow ? `${workflow.name} (${workflow.id})` : exec.workflowId || "Unknown"}\n`;
    summary += `- **Version Tag:** ${exec.versionTag || data.workflow?.versionTag || "N/A"}\n`;
    summary += `- **Steps Summary:** ${successCount} succeeded, ${failureCount} failed, ${totalSteps} total\n`;
    summary += `- **Overall Return Code:** ${overallReturnCode !== null ? `${overallReturnCode} ${overallReturnCode === 0 ? "✓ Success" : "✗ Failed"}` : "N/A"}\n`;
    
    // Safely format dates
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
    
    // Check if execution is still running
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
    
    // Copy to clipboard
    await navigator.clipboard.writeText(summary);
    
    // Show success message
    const successMsg = document.createElement("div");
    successMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
    successMsg.textContent = "✓ Execution summary copied to clipboard!";
    document.body.appendChild(successMsg);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(successMsg)) {
        document.body.removeChild(successMsg);
      }
    }, 3000);
    
    console.log("Execution summary copied to clipboard");
  } catch (error) {
    console.error("Failed to copy execution summary:", error);
    
    // Show error message
    const errorMsg = document.createElement("div");
    errorMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
    errorMsg.textContent = `✗ Failed to copy: ${error.message}`;
    document.body.appendChild(errorMsg);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(errorMsg)) {
        document.body.removeChild(errorMsg);
      }
    }, 5000);
  }
}

// Expose copyExecutionSummary globally
window.copyExecutionSummary = copyExecutionSummary;

/**
 * Load versions
 */
async function loadVersions() {
  try {
    const data = await apiCall("/api/versions");
    renderVersions(data.versions || []);
  } catch (error) {
    console.error("Failed to load versions:", error);
    document.getElementById("versions-list").innerHTML = 
      `<div class="empty-state"><p>Failed to load versions: ${error.message}</p></div>`;
  }
}

/**
 * Render versions
 */
function renderVersions(versions) {
  const container = document.getElementById("versions-list");
  
  if (versions.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No versions found</h3><p>Create review files in the review/ directory</p></div>`;
    return;
  }
  
  container.innerHTML = versions.map(v => `
    <div class="list-item">
      <div class="list-item-header">
        <div class="list-item-title">${v.tag}</div>
        <span class="status-badge ${v.status.toLowerCase().replace(/\s+/g, "-")}">${v.status}</span>
      </div>
      ${v.summary ? `<div class="list-item-summary">${v.summary}</div>` : ""}
      <div class="list-item-body">
        <p><strong>Review:</strong> ${v.hasReview ? "✓" : "✗"}</p>
        <p><strong>Progress:</strong> ${v.hasProgress ? "✓" : "✗"}</p>
        ${v.started ? `<p><strong>Started:</strong> ${v.started}</p>` : ""}
        ${v.completed ? `<p><strong>Completed:</strong> ${v.completed}</p>` : ""}
        ${v.nextStepsCount > 0 ? `<p><strong>Tasks:</strong> ${v.completedStepsCount}/${v.nextStepsCount} completed</p>` : ""}
      </div>
    </div>
  `).join("");
}

/**
 * Render version summary (for dashboard)
 */
function renderVersionSummary(version, containerId) {
  const container = document.getElementById(containerId);
  
  if (!version) {
    container.innerHTML = `<div class="empty-state"><p>No version information available</p></div>`;
    return;
  }
  
  const progressPercent = version.nextStepsCount > 0 
    ? Math.round((version.completedStepsCount / version.nextStepsCount) * 100)
    : 0;
  
  container.innerHTML = `
    <div class="version-summary-card">
      <div class="version-summary-header">
        <h4>${version.tag}</h4>
        <span class="status-badge ${version.status.toLowerCase().replace(/\s+/g, "-")}">${version.status}</span>
      </div>
      ${version.summary ? `<p class="version-summary-text">${version.summary}</p>` : ""}
      <div class="version-summary-meta">
        ${version.started ? `<span>Started: ${version.started}</span>` : ""}
        ${version.completed ? `<span>Completed: ${version.completed}</span>` : ""}
        ${version.nextStepsCount > 0 ? `
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
            <span class="progress-text">${version.completedStepsCount}/${version.nextStepsCount} tasks</span>
          </div>
        ` : ""}
        ${version.executionsCount > 0 ? `<span><strong>Executions:</strong> ${version.executionsCount}</span>` : ""}
        ${version.agentsCount > 0 ? `<span><strong>Agents:</strong> ${version.agentsCount}</span>` : ""}
      </div>
    </div>
  `;
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById("modal").classList.remove("active");
}

// Expose functions globally for onclick handlers
window.closeModal = closeModal;

// Close modal on outside click
document.getElementById("modal")?.addEventListener("click", (e) => {
  if (e.target.id === "modal") {
    closeModal();
  }
});

// Expose switchView globally for onclick handlers
window.switchView = switchView;

/**
 * Run a workflow
 */
async function runWorkflow(workflowId, params = {}) {
  try {
    // Show confirmation dialog for parameters if needed
    let workflowParams = params;
    
    if (Object.keys(params).length === 0) {
      // Try to get workflow details to see if it needs parameters
      try {
        const workflowData = await apiCall(`/api/workflows/${workflowId}`);
        // For now, just run with empty params - can enhance later with parameter input
      } catch (e) {
        // Ignore
      }
    }
    
    // Show loading state
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
    
    // Remove loading message
    document.body.removeChild(loadingMsg);
    
    if (result.success) {
      // Show success message
      const successMsg = document.createElement("div");
      successMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
      successMsg.textContent = `✓ Workflow started! Execution ID: ${result.executionId.substring(0, 8)}...`;
      document.body.appendChild(successMsg);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (document.body.contains(successMsg)) {
          document.body.removeChild(successMsg);
        }
      }, 3000);
      
      // Refresh executions and dashboard
      setTimeout(() => {
        if (currentView === "dashboard") {
          loadDashboard();
        } else if (currentView === "executions") {
          loadExecutions();
        }
      }, 1000);
      
      // Close modal if open
      closeModal();
      
      // Optionally switch to executions view
      if (currentView !== "executions") {
        setTimeout(() => {
          switchView("executions");
          showExecutionDetails(result.executionId);
        }, 500);
      }
    } else {
      throw new Error(result.error || "Failed to run workflow");
    }
  } catch (error) {
    // Show error message
    const errorMsg = document.createElement("div");
    errorMsg.style.cssText = "position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;";
    errorMsg.textContent = `✗ Error: ${error.message}`;
    document.body.appendChild(errorMsg);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(errorMsg)) {
        document.body.removeChild(errorMsg);
      }
    }, 5000);
    
    console.error("Failed to run workflow:", error);
  }
}

// Expose runWorkflow globally
window.runWorkflow = runWorkflow;

