/**
 * kaczmarek.ai-dev Frontend Application
 */

const API_BASE = ""; // Same origin

// State
let currentView = "dashboard";

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
    <div class="list-item" onclick="showWorkflowDetails('${wf.id}')">
      <div class="list-item-header">
        <div class="list-item-title">${wf.name}</div>
        <div class="list-item-meta">
          ${wf.versionTag ? `<span class="version-link">${wf.versionTag}</span>` : ""}
          ${wf.executionCount > 0 ? `<span>${wf.executionCount} executions</span>` : ""}
        </div>
      </div>
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
    
    const modalBody = document.getElementById("modal-body");
    modalBody.innerHTML = `
      <h2>${wf.name || workflowId}</h2>
      <p><strong>Version:</strong> ${wf.version || "N/A"}</p>
      ${data.versionTag ? `<p><strong>Version Tag:</strong> <span class="version-link">${data.versionTag}</span></p>` : ""}
      <p><strong>Description:</strong> ${wf.description || "N/A"}</p>
      
      <h3 style="margin-top: 1.5rem;">Steps (${wf.steps?.length || 0})</h3>
      <pre><code>${JSON.stringify(wf.steps || [], null, 2)}</code></pre>
      
      <h3 style="margin-top: 1.5rem;">Executions (${data.executions?.length || 0})</h3>
      ${data.executions?.length > 0 ? `
        <ul>
          ${data.executions.map(e => `
            <li>
              <a href="#" onclick="closeModal(); switchView('executions'); showExecutionDetails('${e.executionId}'); return false;">
                ${e.executionId}
              </a>
              - ${e.status} - ${new Date(e.startedAt).toLocaleString()}
              ${e.agents?.length > 0 ? ` (${e.agents.length} agents)` : ""}
            </li>
          `).join("")}
        </ul>
      ` : "<p>No executions yet</p>"}
    `;
    
    document.getElementById("modal").classList.add("active");
  } catch (error) {
    console.error("Failed to load workflow details:", error);
  }
}

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
  
  container.innerHTML = agents.map(agent => `
    <div class="list-item" onclick="showAgentDetails('${agent.id}')">
      <div class="list-item-header">
        <div class="list-item-title">${agent.id.substring(0, 8)}...</div>
        <span class="status-badge ${agent.status}">${agent.status}</span>
      </div>
      <div class="list-item-body">
        <p><strong>Type:</strong> ${agent.type}</p>
        <p><strong>Tasks:</strong> ${agent.tasks?.length || 0}</p>
        <p><strong>Created:</strong> ${new Date(agent.createdAt).toLocaleString()}</p>
        ${agent.executionId ? `<p><strong>Execution:</strong> <a href="#" onclick="event.stopPropagation(); showExecutionDetails('${agent.executionId}'); return false;">${agent.executionId.substring(0, 8)}...</a></p>` : ""}
        ${agent.workflow ? `<p><strong>Workflow:</strong> ${agent.workflow.name}</p>` : ""}
        ${agent.versionTag ? `<p><strong>Version:</strong> ${agent.versionTag}</p>` : ""}
      </div>
    </div>
  `).join("");
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
      <p><strong>Created:</strong> ${new Date(agent.startedAt).toLocaleString()}</p>
      ${agent.readyAt ? `<p><strong>Ready:</strong> ${new Date(agent.readyAt).toLocaleString()}</p>` : ""}
      ${agent.completedAt ? `<p><strong>Completed:</strong> ${new Date(agent.completedAt).toLocaleString()}</p>` : ""}
      
      <h3 style="margin-top: 1.5rem;">Prompt</h3>
      <pre><code>${agent.prompt || "N/A"}</code></pre>
      
      <h3 style="margin-top: 1.5rem;">Tasks (${agent.tasks?.length || 0})</h3>
      <pre><code>${JSON.stringify(agent.tasks || [], null, 2)}</code></pre>
      
      ${agent.executionResults ? `
        <h3 style="margin-top: 1.5rem;">Execution Results</h3>
        <pre><code>${JSON.stringify(agent.executionResults, null, 2)}</code></pre>
      ` : ""}
    `;
    
    document.getElementById("modal").classList.add("active");
  } catch (error) {
    console.error("Failed to load agent details:", error);
  }
}

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
        <p><strong>Started:</strong> ${new Date(exec.startedAt).toLocaleString()}</p>
        ${exec.completedAt ? `<p><strong>Completed:</strong> ${new Date(exec.completedAt).toLocaleString()}</p>` : ""}
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
      <h2>Execution: ${exec.executionId}</h2>
      <p><strong>Workflow:</strong> ${data.workflow ? `<a href="#" onclick="closeModal(); switchView('workflows'); showWorkflowDetails('${data.workflow.id}'); return false;">${data.workflow.name}</a>` : exec.workflowId || "Unknown"}</p>
      ${data.workflow?.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${data.workflow.versionTag}</span></p>` : ""}
      ${exec.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${exec.versionTag}</span></p>` : ""}
      <p><strong>Status:</strong> <span class="status-badge ${exec.status}">${exec.status}</span></p>
      <p><strong>Started:</strong> ${new Date(exec.startedAt).toLocaleString()}</p>
      ${exec.completedAt ? `<p><strong>Completed:</strong> ${new Date(exec.completedAt).toLocaleString()}</p>` : ""}
      
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
      <pre><code>${JSON.stringify(data.steps || [], null, 2)}</code></pre>
    `;
    
    document.getElementById("modal").classList.add("active");
  } catch (error) {
    console.error("Failed to load execution details:", error);
  }
}

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

// Close modal on outside click
document.getElementById("modal")?.addEventListener("click", (e) => {
  if (e.target.id === "modal") {
    closeModal();
  }
});

// Expose switchView globally for onclick handlers
window.switchView = switchView;

