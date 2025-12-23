/**
 * Agents view module
 */

// Store all agents for filtering/sorting
let allAgents = [];

/**
 * Load agents
 */
async function loadAgents() {
  try {
    const data = await window.apiCall("/api/agents");
    allAgents = data.agents || [];
    
    // Populate workflow filter
    populateWorkflowFilter(allAgents);
    
    // Apply filters and sorting
    filterAndSortAgents();
  } catch (error) {
    console.error("Failed to load agents:", error);
    document.getElementById("agents-list").innerHTML = 
      `<div class="empty-state"><p>Failed to load agents: ${error.message}</p></div>`;
  }
}

/**
 * Populate workflow filter dropdown
 */
function populateWorkflowFilter(agents) {
  const workflowFilter = document.getElementById("agent-workflow-filter");
  if (!workflowFilter) return;
  
  // Get unique workflows
  const workflows = new Map();
  agents.forEach(agent => {
    if (agent.workflow && agent.workflow.name) {
      workflows.set(agent.workflow.id, agent.workflow.name);
    }
  });
  
  // Clear existing options except "All"
  workflowFilter.innerHTML = '<option value="all">All Workflows</option>';
  
  // Add workflow options
  Array.from(workflows.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([id, name]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      workflowFilter.appendChild(option);
    });
}

/**
 * Filter and sort agents
 */
function filterAndSortAgents() {
  if (!allAgents || allAgents.length === 0) {
    renderAgents([], "agents-list");
    return;
  }
  
  let filtered = [...allAgents];
  
  // Apply status filter
  const statusFilter = document.getElementById("agent-status-filter")?.value || "all";
  if (statusFilter !== "all") {
    filtered = filtered.filter(agent => agent.status === statusFilter);
  }
  
  // Apply workflow filter
  const workflowFilter = document.getElementById("agent-workflow-filter")?.value || "all";
  if (workflowFilter !== "all") {
    filtered = filtered.filter(agent => agent.workflow && agent.workflow.id === workflowFilter);
  }
  
  // Apply sorting
  const sortBy = document.getElementById("agent-sort")?.value || "newest";
  filtered.sort((a, b) => {
    switch (sortBy) {
      case "newest":
        const dateA = new Date(a.createdAt || a.startedAt || 0);
        const dateB = new Date(b.createdAt || b.startedAt || 0);
        return dateB - dateA;
      
      case "oldest":
        const dateAOld = new Date(a.createdAt || a.startedAt || 0);
        const dateBOld = new Date(b.createdAt || b.startedAt || 0);
        return dateAOld - dateBOld;
      
      case "name-asc":
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      
      case "name-desc":
        const nameADesc = (a.name || "").toLowerCase();
        const nameBDesc = (b.name || "").toLowerCase();
        return nameBDesc.localeCompare(nameADesc);
      
      case "status":
        return (a.status || "").localeCompare(b.status || "");
      
      case "tasks-asc":
        return (a.tasks?.length || 0) - (b.tasks?.length || 0);
      
      case "tasks-desc":
        return (b.tasks?.length || 0) - (a.tasks?.length || 0);
      
      default:
        return 0;
    }
  });
  
  renderAgents(filtered, "agents-list");
}

/**
 * Render agents
 */
function renderAgents(agents, containerId) {
  const container = document.getElementById(containerId);
  
  // Show count if filtered
  const totalCount = allAgents.length;
  const filteredCount = agents.length;
  const isFiltered = filteredCount !== totalCount;
  
  if (agents.length === 0) {
    if (isFiltered) {
      container.innerHTML = `<div class="empty-state"><h3>No agents match the current filters</h3><p>Showing 0 of ${totalCount} agents</p></div>`;
    } else {
      container.innerHTML = `<div class="empty-state"><h3>No agent tasks</h3><p>Agent tasks will appear here when workflows are executed</p></div>`;
    }
    return;
  }
  
  // Add count display before the list
  const countDisplay = isFiltered 
    ? `<div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg); border-radius: 0.5rem; font-size: 0.875rem; color: var(--text-light);">
         Showing ${filteredCount} of ${totalCount} agents
       </div>`
    : `<div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg); border-radius: 0.5rem; font-size: 0.875rem; color: var(--text-light);">
         ${totalCount} ${totalCount === 1 ? 'agent' : 'agents'}
       </div>`;
  
  container.innerHTML = countDisplay + agents.map(agent => {
    const agentId = agent.id || "";
    const executionId = agent.execution?.executionId || agent.executionId || "";
    const createdAt = agent.createdAt || agent.startedAt || new Date().toISOString();
    const agentName = agent.name || (agentId ? agentId.substring(0, 8) + "..." : "Unknown Agent");
    
    return `
    <div class="list-item" onclick="showAgentDetails('${agentId}')">
      <div class="list-item-header">
        <div class="list-item-title">${agentName}</div>
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
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem;">
          ${agent.workflow ? `
            <div>
              <strong>Workflow:</strong> 
              <a href="#" onclick="event.stopPropagation(); closeModal(); switchView('workflows'); showWorkflowDetails('${agent.workflow.id}'); return false;" style="color: var(--primary); text-decoration: underline;">
                ${agent.workflow.name}
              </a>
            </div>
          ` : ""}
          ${executionId ? `
            <div>
              <strong>Execution:</strong> 
              <a href="#" onclick="event.stopPropagation(); closeModal(); switchView('executions'); showExecutionDetails('${executionId}'); return false;" style="color: var(--primary); text-decoration: underline;">
                ${executionId.substring(0, 8)}...
              </a>
            </div>
          ` : ""}
          ${agent.versionTag ? `
            <div>
              <strong>Version:</strong> 
              <span class="version-link">${agent.versionTag}</span>
            </div>
          ` : ""}
          <div><strong>Tasks:</strong> ${agent.tasks?.length || 0}</div>
          <div><strong>Created:</strong> ${window.formatDateForDisplay(createdAt)}</div>
        </div>
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
    const data = await window.apiCall(`/api/agents/${agentId}`);
    const agent = data.agent;
    
    const modalBody = document.getElementById("modal-body");
    const agentName = agent.name || agent.id || "Unknown Agent";
    modalBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">${agentName}</h2>
        <button class="btn btn-secondary" onclick="copyAgentSummary('${agent.id}')" title="Copy agent summary to clipboard for debugging">
          📋 Copy Summary
        </button>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: var(--bg); border-radius: 0.5rem;">
        <div><strong>Status:</strong> <span class="status-badge ${agent.status}">${agent.status}</span></div>
        <div><strong>Type:</strong> ${agent.type || "unknown"}</div>
        <div><strong>Tasks:</strong> ${agent.tasks?.length || 0}</div>
        ${agent.workflow ? `
          <div>
            <strong>Workflow:</strong> 
            <a href="#" onclick="closeModal(); switchView('workflows'); showWorkflowDetails('${agent.workflow.id}'); return false;" style="color: var(--primary); text-decoration: underline;">
              ${agent.workflow.name}
            </a>
          </div>
        ` : ""}
        ${agent.execution ? `
          <div>
            <strong>Execution:</strong> 
            <a href="#" onclick="closeModal(); switchView('executions'); showExecutionDetails('${agent.execution.executionId || agent.execution.id}'); return false;" style="color: var(--primary); text-decoration: underline;">
              ${(agent.execution.executionId || agent.execution.id || "").substring(0, 8)}...
            </a>
          </div>
        ` : ""}
        ${agent.versionTag || agent.workflow?.versionTag ? `
          <div>
            <strong>Version:</strong> 
            <span class="version-link">${agent.versionTag || agent.workflow.versionTag}</span>
          </div>
        ` : ""}
      </div>
      ${agent.autoCompleted ? `
        <div style="margin-bottom: 1rem; padding: 1rem; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 0.5rem;">
          <strong>Auto-Completed:</strong> ${agent.autoCompletedReason || "No tasks to implement"}
          <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-light);">
            This agent task was automatically completed because there were no tasks to implement. This typically happens when all tasks in the review file are already completed.
          </p>
        </div>
      ` : ""}
      <p><strong>Created:</strong> ${window.formatDateForDisplay(agent.startedAt)}</p>
      ${agent.readyAt ? `<p><strong>Ready:</strong> ${window.formatDateForDisplay(agent.readyAt)}</p>` : ""}
      ${agent.completedAt ? `<p><strong>Completed:</strong> ${window.formatDateForDisplay(agent.completedAt)}</p>` : ""}
      
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

/**
 * Copy agent summary to clipboard
 */
async function copyAgentSummary(agentId) {
  try {
    const data = await window.apiCall(`/api/agents/${agentId}`);
    const agent = data.agent;
    
    if (!agent) {
      throw new Error("Agent data not found.");
    }
    
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
    
    let summary = `# Agent Task Summary: ${agent.id}\n\n`;
    summary += `## Basic Information\n`;
    summary += `- **Agent ID:** ${agent.id}\n`;
    summary += `- **Name:** ${agent.name || "N/A"}\n`;
    summary += `- **Status:** ${agent.status} ${agent.status === "completed" ? "✓" : agent.status === "failed" ? "✗" : ""}\n`;
    summary += `- **Type:** ${agent.type || "unknown"}\n`;
    summary += `- **Tasks Count:** ${agent.tasks?.length || 0}\n`;
    
    if (agent.workflow) {
      summary += `- **Workflow:** ${agent.workflow.name} (${agent.workflow.id})\n`;
    }
    if (agent.execution) {
      summary += `- **Execution:** ${agent.execution.executionId || agent.execution.id || "N/A"}\n`;
    }
    if (agent.versionTag) {
      summary += `- **Version Tag:** ${agent.versionTag}\n`;
    }
    
    summary += `- **Created:** ${formatDate(agent.startedAt || agent.createdAt)}\n`;
    if (agent.readyAt) {
      summary += `- **Ready:** ${formatDate(agent.readyAt)}\n`;
    }
    if (agent.completedAt) {
      summary += `- **Completed:** ${formatDate(agent.completedAt)}\n`;
    }
    if (agent.processingStartedAt) {
      summary += `- **Processing Started:** ${formatDate(agent.processingStartedAt)}\n`;
    }
    
    if (agent.autoCompleted) {
      summary += `\n## Auto-Completion\n`;
      summary += `- **Auto-Completed:** Yes\n`;
      summary += `- **Reason:** ${agent.autoCompletedReason || "No tasks to implement"}\n`;
    }
    
    if (agent.error) {
      summary += `\n## Error\n\`\`\`\n${agent.error}\n\`\`\`\n`;
    }
    
    if (agent.prompt) {
      summary += `\n## Prompt\n\`\`\`\n${agent.prompt}\n\`\`\`\n`;
    }
    
    if (agent.tasks && agent.tasks.length > 0) {
      summary += `\n## Tasks (${agent.tasks.length})\n\n`;
      agent.tasks.forEach((task, index) => {
        summary += `### Task ${index + 1}\n`;
        if (task.description) {
          summary += `- **Description:** ${task.description}\n`;
        }
        if (task.text) {
          summary += `- **Text:** ${task.text}\n`;
        }
        if (task.line) {
          summary += `- **Line:** ${task.line}\n`;
        }
        summary += `\n`;
      });
    } else {
      summary += `\n## Tasks\n`;
      summary += `No tasks to implement. This agent was likely auto-completed.\n\n`;
    }
    
    if (agent.executionResults) {
      summary += `\n## Execution Results\n\n`;
      if (agent.executionResults.executed && agent.executionResults.executed.length > 0) {
        summary += `### Executed (${agent.executionResults.executed.length})\n`;
        agent.executionResults.executed.forEach((item, idx) => {
          summary += `${idx + 1}. ${item.task.description || item.task.text || "Task"}\n`;
        });
        summary += `\n`;
      }
      if (agent.executionResults.failed && agent.executionResults.failed.length > 0) {
        summary += `### Failed (${agent.executionResults.failed.length})\n`;
        agent.executionResults.failed.forEach((item, idx) => {
          summary += `${idx + 1}. ${item.task.description || item.task.text || "Task"}\n`;
          if (item.error) {
            summary += `   Error: ${item.error}\n`;
          }
        });
        summary += `\n`;
      }
      if (agent.executionResults.skipped && agent.executionResults.skipped.length > 0) {
        summary += `### Skipped (${agent.executionResults.skipped.length})\n`;
        agent.executionResults.skipped.forEach((item, idx) => {
          summary += `${idx + 1}. ${item.task.description || item.task.text || "Task"}\n`;
        });
        summary += `\n`;
      }
    }
    
    summary += `\n---\n`;
    summary += `*Generated from kaczmarek.ai-dev agent task ${agent.id}*\n`;
    
    await navigator.clipboard.writeText(summary);
    
    window.showNotification("Agent summary copied to clipboard!", "success");
  } catch (error) {
    console.error("Failed to copy agent summary:", error);
    window.showNotification(`Failed to copy: ${error.message}`, "error");
  }
}

/**
 * Complete an agent task
 */
async function completeAgentTask(agentId) {
  if (!confirm(`Are you sure you want to mark task ${agentId.substring(0, 8)}... as completed?\n\nThis will update the progress and review files.`)) {
    return;
  }

  try {
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
    
    document.body.removeChild(loadingMsg);
    
    if (result.success) {
      window.showNotification("Task completed! Progress and review files updated.", "success");
      
      window.closeModal();
      
      setTimeout(() => {
        loadAgents();
        if (window.currentView === "dashboard") {
          window.loadDashboard();
        }
      }, 500);
    } else {
      throw new Error(result.error || "Failed to complete task");
    }
  } catch (error) {
    console.error("Failed to complete agent task:", error);
    window.showNotification(`Error: ${error.message}`, "error");
  }
}

// Expose globally
window.loadAgents = loadAgents;
window.renderAgents = renderAgents;
window.showAgentDetails = showAgentDetails;
window.copyAgentSummary = copyAgentSummary;
window.completeAgentTask = completeAgentTask;
window.populateWorkflowFilter = populateWorkflowFilter;
window.filterAndSortAgents = filterAndSortAgents;

