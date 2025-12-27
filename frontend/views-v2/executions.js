/**
 * Executions view for v2 UI
 */

/**
 * Load executions view
 */
async function loadExecutionsV2() {
  try {
    const container = document.getElementById("executions-view");
    if (!container) {
      console.error("Executions view container not found");
      return;
    }

    container.innerHTML = `
      <div class="view-header-v2">
        <h2>Executions</h2>
        <button class="btn btn-primary" onclick="loadExecutionsV2()">Refresh</button>
      </div>
      
      <div id="executions-list-v2" style="margin-top: 1.5rem;">
        <div style="text-align: center; padding: 2rem; color: var(--text-light);">
          Loading executions...
        </div>
      </div>
    `;

    // Load executions and agents
    const [executionsResult, agentsResult] = await Promise.allSettled([
      window.apiCall("/api/executions").catch(() => ({ executions: [] })),
      window.apiCall("/api/agents").catch(() => ({ agents: [] }))
    ]);

    const executions = executionsResult.status === "fulfilled" 
      ? (executionsResult.value.executions || []) 
      : [];
    const agents = agentsResult.status === "fulfilled" 
      ? (agentsResult.value.agents || []) 
      : [];

    renderExecutionsV2(executions, agents);
  } catch (error) {
    console.error("Failed to load executions:", error);
    const container = document.getElementById("executions-view");
    if (container) {
      container.innerHTML = `
        <div class="view-header-v2">
          <h2>Executions</h2>
          <button class="btn btn-primary" onclick="loadExecutionsV2()">Refresh</button>
        </div>
        <div style="padding: 2rem; text-align: center; color: var(--error);">
          <p>Failed to load executions: ${error.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Render executions list
 */
function renderExecutionsV2(executions, agents) {
  const container = document.getElementById("executions-list-v2");
  if (!container) return;

  // Group agents by executionId
  const agentsByExecution = {};
  agents.forEach(agent => {
    if (agent.executionId) {
      if (!agentsByExecution[agent.executionId]) {
        agentsByExecution[agent.executionId] = [];
      }
      agentsByExecution[agent.executionId].push(agent);
    }
  });

  if (executions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-light);">
        <h3>No executions</h3>
        <p>Workflow executions will appear here</p>
      </div>
    `;
    return;
  }

  // Sort by most recent first
  const sortedExecutions = [...executions].sort((a, b) => {
    const aTime = new Date(a.startedAt || 0).getTime();
    const bTime = new Date(b.startedAt || 0).getTime();
    return bTime - aTime;
  });

  container.innerHTML = sortedExecutions.map(exec => {
    const execAgents = agentsByExecution[exec.executionId] || [];
    const statusClass = (exec.status || "unknown").toLowerCase().replace(/\s+/g, "-");
    const hasAgents = execAgents.length > 0;
    const hasActiveAgents = execAgents.some(a => 
      a.status === "running" || a.status === "processing" || a.status === "queued"
    );

    return `
      <div class="version-card-v2" style="margin-bottom: 1.5rem; cursor: pointer;" onclick="showExecutionDetailsV2('${exec.executionId}')">
        <div class="version-card-header">
          <div>
            <h3>${exec.workflow?.name || exec.workflowId || "Unknown Workflow"}</h3>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; flex-wrap: wrap;">
              <span class="status-badge ${statusClass}">${exec.status || "unknown"}</span>
              ${exec.versionTag ? `
                <span class="status-badge" style="background: var(--bg-secondary); color: var(--text);">
                  Version ${exec.versionTag}
                </span>
              ` : ""}
              ${hasActiveAgents ? `
                <span class="status-badge processing" style="font-size: 0.75rem;">
                  🤖 ${execAgents.filter(a => a.status === "running" || a.status === "processing").length} Active Agent${execAgents.filter(a => a.status === "running" || a.status === "processing").length !== 1 ? "s" : ""}
                </span>
              ` : ""}
              ${hasAgents && !hasActiveAgents ? `
                <span class="status-badge" style="background: var(--bg-secondary); color: var(--text); font-size: 0.75rem;">
                  ${execAgents.length} Agent${execAgents.length !== 1 ? "s" : ""}
                </span>
              ` : ""}
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); showExecutionDetailsV2('${exec.executionId}')">
            View Details
          </button>
        </div>
        
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.875rem; color: var(--text-light);">
            <div>
              <strong>Execution ID:</strong><br>
              <code style="font-size: 0.75rem;">${exec.executionId.substring(0, 16)}...</code>
            </div>
            <div>
              <strong>Started:</strong><br>
              ${exec.startedAt ? window.formatDateForDisplay(exec.startedAt) : "N/A"}
            </div>
            ${exec.completedAt ? `
              <div>
                <strong>Completed:</strong><br>
                ${window.formatDateForDisplay(exec.completedAt)}
              </div>
            ` : ""}
            ${exec.outcome ? `
              <div>
                <strong>Outcome:</strong><br>
                <span class="status-badge ${exec.outcome.toLowerCase()}">${exec.outcome}</span>
              </div>
            ` : ""}
          </div>
          
          ${hasAgents ? `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
              <strong style="font-size: 0.875rem; color: var(--text-light);">Background Agents:</strong>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
                ${execAgents.map(agent => `
                  <span class="status-badge ${agent.status === "running" || agent.status === "processing" ? "processing" : agent.status === "completed" ? "completed" : ""}" 
                        style="font-size: 0.75rem; cursor: pointer;"
                        onclick="event.stopPropagation(); showAgentDetailsV2('${agent.id}')"
                        title="${agent.name || agent.id} - ${agent.status}">
                    🤖 ${agent.name || agent.id.substring(0, 12)}... (${agent.status})
                  </span>
                `).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

/**
 * Show execution details
 */
async function showExecutionDetailsV2(executionId) {
  try {
    const data = await window.apiCall(`/api/executions/${executionId}`);
    const exec = data.execution;
    
    // Get agents for this execution
    const agentsData = await window.apiCall("/api/agents").catch(() => ({ agents: [] }));
    const execAgents = (agentsData.agents || []).filter(a => a.executionId === executionId);

    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");

    if (!modal || !modalTitle || !modalBody) {
      console.error("Modal elements not found");
      return;
    }

    modalTitle.textContent = `Execution: ${exec.executionId.substring(0, 16)}...`;
    
    modalBody.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap;">
          <span class="status-badge ${(exec.status || "unknown").toLowerCase().replace(/\s+/g, "-")}">${exec.status || "unknown"}</span>
          ${exec.outcome ? `<span class="status-badge ${exec.outcome.toLowerCase()}">${exec.outcome}</span>` : ""}
          ${exec.versionTag ? `<span class="status-badge">Version ${exec.versionTag}</span>` : ""}
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; font-size: 0.875rem;">
          <div>
            <strong>Workflow:</strong><br>
            ${exec.workflow?.name || exec.workflowId || "Unknown"}
          </div>
          <div>
            <strong>Started:</strong><br>
            ${exec.startedAt ? window.formatDateForDisplay(exec.startedAt) : "N/A"}
          </div>
          ${exec.completedAt ? `
            <div>
              <strong>Completed:</strong><br>
              ${window.formatDateForDisplay(exec.completedAt)}
            </div>
          ` : ""}
          <div>
            <strong>Execution ID:</strong><br>
            <code style="font-size: 0.75rem;">${exec.executionId}</code>
          </div>
        </div>
      </div>

      ${execAgents.length > 0 ? `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
          <h4 style="margin: 0 0 0.75rem 0; font-size: 1rem;">Background Agents (${execAgents.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${execAgents.map(agent => `
              <div style="padding: 0.75rem; background: var(--bg); border-radius: var(--radius); border: 1px solid var(--border); cursor: pointer;"
                   onclick="showAgentDetailsV2('${agent.id}')">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                  <div>
                    <strong>${agent.name || agent.id}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.25rem;">
                      ${agent.type || "unknown"} • ${agent.tasksCount || 0} task${(agent.tasksCount || 0) !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span class="status-badge ${agent.status === "running" || agent.status === "processing" ? "processing" : agent.status === "completed" ? "completed" : ""}">
                    ${agent.status}
                  </span>
                </div>
                ${agent.status === "running" || agent.status === "processing" ? `
                  <div style="height: 4px; background: var(--border); border-radius: 2px; margin-top: 0.5rem;">
                    <div style="height: 100%; width: 50%; background: var(--primary); animation: pulse 2s infinite;"></div>
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${exec.summary ? `
        <div style="margin-bottom: 1.5rem;">
          <button class="btn btn-secondary" onclick="showExecutionSummaryV2('${executionId}')">
            📄 View Full Summary
          </button>
        </div>
      ` : ""}

      <div>
        <h4 style="margin-bottom: 0.75rem;">Steps (${exec.steps?.length || 0})</h4>
        <div style="max-height: 400px; overflow-y: auto;">
          ${(exec.steps || []).map((step, idx) => {
            const stepStatusClass = (step.status || "unknown").toLowerCase().replace(/\s+/g, "-");
            return `
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius); border-left: 4px solid ${step.status === "succeeded" ? "var(--success)" : step.status === "failed" ? "var(--error)" : "var(--border)"};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                  <div>
                    <strong>${idx + 1}. ${step.stepId || "Unknown Step"}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.25rem;">
                      ${step.module || ""} • ${step.action || ""}
                    </div>
                  </div>
                  <span class="status-badge ${stepStatusClass}">${step.status || "unknown"}</span>
                </div>
                ${step.error ? `
                  <div style="margin-top: 0.5rem; padding: 0.5rem; background: var(--error-bg, #fee); border-radius: var(--radius); font-size: 0.875rem; color: var(--error);">
                    <strong>Error:</strong> ${step.error}
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    modal.style.display = "block";
  } catch (error) {
    console.error("Failed to load execution details:", error);
    window.showNotification(`Failed to load execution details: ${error.message}`, "error");
  }
}

/**
 * Show agent details
 */
async function showAgentDetailsV2(agentId) {
  try {
    const agentsData = await window.apiCall("/api/agents").catch(() => ({ agents: [] }));
    const agent = (agentsData.agents || []).find(a => a.id === agentId);

    if (!agent) {
      window.showNotification("Agent not found", "error");
      return;
    }

    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");

    if (!modal || !modalTitle || !modalBody) {
      console.error("Modal elements not found");
      return;
    }

    modalTitle.textContent = `Agent: ${agent.name || agent.id}`;
    
    const statusClass = (agent.status || "unknown").toLowerCase().replace(/\s+/g, "-");
    
    modalBody.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap;">
          <span class="status-badge ${statusClass}">${agent.status || "unknown"}</span>
          <span class="status-badge">${agent.type || "unknown"}</span>
          ${agent.versionTag ? `<span class="status-badge">Version ${agent.versionTag}</span>` : ""}
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.875rem;">
          <div>
            <strong>Agent ID:</strong><br>
            <code style="font-size: 0.75rem;">${agent.id}</code>
          </div>
          ${agent.executionId ? `
            <div>
              <strong>Execution:</strong><br>
              <a href="#" onclick="event.preventDefault(); showExecutionDetailsV2('${agent.executionId}'); closeModal();" style="color: var(--primary); text-decoration: underline;">
                ${agent.executionId.substring(0, 16)}...
              </a>
            </div>
          ` : ""}
          <div>
            <strong>Started:</strong><br>
            ${agent.createdAt ? window.formatDateForDisplay(agent.createdAt) : "N/A"}
          </div>
          ${agent.completedAt ? `
            <div>
              <strong>Completed:</strong><br>
              ${window.formatDateForDisplay(agent.completedAt)}
            </div>
          ` : ""}
          <div>
            <strong>Tasks:</strong><br>
            ${agent.tasksCount || 0}
          </div>
        </div>
      </div>

      ${agent.tasks && agent.tasks.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin-bottom: 0.75rem;">Tasks</h4>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${agent.tasks.map((task, idx) => `
              <li style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius);">
                ${idx + 1}. ${task.description || task.text || JSON.stringify(task)}
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}

      ${agent.status === "running" || agent.status === "processing" ? `
        <div style="padding: 1rem; background: var(--primary-light); border-left: 4px solid var(--primary); border-radius: var(--radius);">
          <p style="margin: 0; font-size: 0.875rem; color: var(--text);">
            Agent is currently running. This may take a few minutes...
          </p>
          <div style="height: 4px; background: var(--border); border-radius: 2px; margin-top: 0.75rem;">
            <div style="height: 100%; width: 50%; background: var(--primary); animation: pulse 2s infinite;"></div>
          </div>
        </div>
      ` : ""}
    `;

    modal.style.display = "block";
  } catch (error) {
    console.error("Failed to load agent details:", error);
    window.showNotification(`Failed to load agent details: ${error.message}`, "error");
  }
}

/**
 * Show execution summary
 */
async function showExecutionSummaryV2(executionId) {
  try {
    const data = await window.apiCall(`/api/executions/${executionId}`);
    const exec = data.execution;
    
    if (!exec.summary) {
      window.showNotification("No summary available for this execution", "info");
      return;
    }

    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");

    if (!modal || !modalTitle || !modalBody) {
      console.error("Modal elements not found");
      return;
    }

    modalTitle.textContent = `Execution Summary: ${exec.executionId.substring(0, 16)}...`;
    modalBody.innerHTML = `
      <div style="max-height: 600px; overflow-y: auto; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius); font-family: monospace; font-size: 0.875rem; white-space: pre-wrap;">
        ${exec.summary}
      </div>
      <div style="margin-top: 1rem;">
        <button class="btn btn-primary" onclick="copyExecutionSummaryV2('${executionId}')">
          📋 Copy Summary
        </button>
      </div>
    `;

    modal.style.display = "block";
  } catch (error) {
    console.error("Failed to load execution summary:", error);
    window.showNotification(`Failed to load execution summary: ${error.message}`, "error");
  }
}

/**
 * Copy execution summary
 */
async function copyExecutionSummaryV2(executionId) {
  try {
    const data = await window.apiCall(`/api/executions/${executionId}`);
    const exec = data.execution;
    
    if (!exec.summary) {
      window.showNotification("No summary available", "info");
      return;
    }

    await navigator.clipboard.writeText(exec.summary);
    window.showNotification("Summary copied to clipboard", "success");
  } catch (error) {
    console.error("Failed to copy summary:", error);
    window.showNotification(`Failed to copy summary: ${error.message}`, "error");
  }
}

// Expose globally
window.loadExecutionsV2 = loadExecutionsV2;
window.showExecutionDetailsV2 = showExecutionDetailsV2;
window.showAgentDetailsV2 = showAgentDetailsV2;
window.showExecutionSummaryV2 = showExecutionSummaryV2;
window.copyExecutionSummaryV2 = copyExecutionSummaryV2;

