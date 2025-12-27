/**
 * Dashboard view module
 */

// Use utilities from window (available globally)
// Note: apiCall and formatDateForDisplay are exposed on window by utils.js

/**
 * Load dashboard
 */
async function loadDashboard() {
  try {
    // Show loading state for repo status
    const repoStatusContainer = document.getElementById("repo-status");
    if (repoStatusContainer) {
      repoStatusContainer.innerHTML = `<div class="repo-status-loading">Loading repository status...</div>`;
    }
    
    // Load stats and repo status
    const [workflows, agents, executions, versions, repoStatus] = await Promise.all([
      window.apiCall("/api/workflows"),
      window.apiCall("/api/agents"),
      window.apiCall("/api/executions"),
      window.apiCall("/api/versions"),
      window.apiCall("/api/repo-status").catch(err => {
        console.error("Failed to load repo status:", err);
        return { hasVersion: false, error: err.message };
      })
    ]);
    
    // Update stats
    document.getElementById("workflow-count").textContent = workflows.workflows?.length || 0;
    document.getElementById("agent-count").textContent = agents.agents?.filter(a => a.status !== "completed").length || 0;
    document.getElementById("execution-count").textContent = executions.executions?.length || 0;
    document.getElementById("version-count").textContent = versions.versions?.length || 0;
    
    // Render repo status
    console.log("Repo status data:", repoStatus);
    renderRepoStatus(repoStatus);
    
    // Recent executions
    const recentExecutions = executions.executions
      ?.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, 5) || [];
    
    if (window.renderExecutions) {
      window.renderExecutions(recentExecutions, "recent-executions");
    }
    
    // Active agents
    const activeAgents = agents.agents
      ?.filter(a => a.status !== "completed")
      .slice(0, 5) || [];
    
    if (window.renderAgents) {
      window.renderAgents(activeAgents, "active-agents");
    }
    
    // Latest version
    const latestVersion = versions.versions?.[0];
    if (latestVersion && window.renderVersionSummary) {
      window.renderVersionSummary(latestVersion, "latest-version");
    }
  } catch (error) {
    console.error("Failed to load dashboard:", error);
  }
}

/**
 * Render repository status overview
 */
function renderRepoStatus(status) {
  const container = document.getElementById("repo-status");
  if (!container) {
    console.warn("Repo status container not found");
    return;
  }

  console.log("Rendering repo status:", status);

  // Handle errors
  if (status && status.error) {
    container.innerHTML = `
      <div class="repo-status-empty">
        <p style="color: var(--error);">Failed to load repository status: ${escapeHtml(status.error)}</p>
        <button class="btn btn-sm" onclick="loadDashboard()">Retry</button>
      </div>
    `;
    return;
  }

  if (!status || !status.hasVersion) {
    container.innerHTML = `
      <div class="repo-status-empty">
        <p>No version files found. Create a review file to get started.</p>
        <button class="btn btn-primary" onclick="switchView('versions')">View Versions</button>
      </div>
    `;
    return;
  }

  const { version, review, nextSteps, activeAgents } = status;
  
  // Status badge color
  const statusColor = review.status === "In Progress" ? "processing" : 
                     review.status === "Completed" ? "completed" : 
                     review.status === "Unknown" ? "queued" : "queued";
  
  let html = `
    <div class="repo-status-card">
      <div class="repo-status-header">
        <div>
          <h4>Version ${version.tag}</h4>
          <span class="status-badge ${statusColor}">${review.status || "Unknown"}</span>
        </div>
      </div>
      
      ${review.summary ? `
        <div class="repo-status-summary">
          <p>${review.summary}</p>
        </div>
      ` : `
        <div class="repo-status-summary">
          <p style="color: var(--text-light); font-style: italic;">No summary available. Edit the review file to add a summary.</p>
        </div>
      `}
      
      <div class="repo-status-details">
        <div class="repo-status-item">
          <strong>Next Steps:</strong>
          <span class="repo-status-value">${nextSteps?.count || 0} ${(nextSteps?.count || 0) === 1 ? 'task' : 'tasks'}</span>
        </div>
        <div class="repo-status-item">
          <strong>Active Agents:</strong>
          <span class="repo-status-value">${activeAgents?.count || 0} ${(activeAgents?.count || 0) === 1 ? 'agent' : 'agents'}</span>
        </div>
      </div>
  `;

  // Show next steps preview
  if (nextSteps?.items && nextSteps.items.length > 0) {
    html += `
      <div class="repo-status-next-steps">
        <h5>Next Steps (${nextSteps.count})</h5>
        <ul class="next-steps-list">
    `;
    nextSteps.items.slice(0, 5).forEach(step => {
      html += `<li>${escapeHtml(step.text || step)}</li>`;
    });
    if (nextSteps.total > 5) {
      html += `<li class="next-steps-more">... and ${nextSteps.total - 5} more</li>`;
    }
    html += `
        </ul>
      </div>
    `;
  } else if (nextSteps?.count === 0) {
    html += `
      <div class="repo-status-next-steps">
        <h5>Next Steps</h5>
        <p style="color: var(--text-light); font-style: italic; padding: 0.5rem 0.75rem;">No uncompleted tasks found. All tasks may be completed, or the review file needs updating.</p>
      </div>
    `;
  }

  // Show active agents
  if (activeAgents?.items && activeAgents.items.length > 0) {
    html += `
      <div class="repo-status-agents">
        <h5>Active Background Agents (${activeAgents.count})</h5>
        <div class="active-agents-list">
    `;
    activeAgents.items.forEach(agent => {
      const statusClass = agent.status || "queued";
      html += `
        <div class="agent-item" onclick="switchView('agents'); setTimeout(() => document.getElementById('agents-list').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)">
          <div class="agent-item-header">
            <span class="agent-name">${escapeHtml(agent.name)}</span>
            <span class="status-badge ${statusClass}">${statusClass}</span>
          </div>
          <div class="agent-item-details">
            <span>${agent.taskCount} ${agent.taskCount === 1 ? 'task' : 'tasks'}</span>
            ${agent.workflow ? `<span>• ${escapeHtml(agent.workflow.name)}</span>` : ""}
          </div>
        </div>
      `;
    });
    html += `
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="repo-status-agents">
        <p class="no-agents">No active background agents</p>
      </div>
    `;
  }

  html += `
      <div class="repo-status-actions">
        <button class="btn btn-sm" onclick="switchView('versions')">View Version Details</button>
        ${(nextSteps?.count || 0) > 0 ? `<button class="btn btn-sm btn-primary" onclick="window.runWorkflow('execute-features')">Execute Features</button>` : ""}
      </div>
    </div>
  `;

  container.innerHTML = html;
  console.log("Repo status rendered successfully");
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Expose globally
window.loadDashboard = loadDashboard;

