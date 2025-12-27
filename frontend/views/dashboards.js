/**
 * Dashboards view module
 */

/**
 * Load dashboards list
 */
async function loadDashboards() {
  try {
    const data = await window.apiCall("/api/library/dashboards");
    renderDashboardsList(data.dashboards || []);
  } catch (error) {
    console.error("Failed to load dashboards:", error);
    document.getElementById("dashboards-list").innerHTML = 
      `<div class="empty-state"><p>Failed to load dashboards: ${error.message}</p></div>`;
  }
}

/**
 * Render dashboards list
 */
function renderDashboardsList(dashboards) {
  const container = document.getElementById("dashboards-list");
  
  if (dashboards.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No dashboards found</h3><p>Dashboards are available in the library</p></div>`;
    return;
  }
  
  container.innerHTML = dashboards.map(dashboard => {
    const category = dashboard.category || "other";
    return `
    <div class="list-item" onclick="window.loadDashboardById('${dashboard.id}')" style="cursor: pointer;">
      <div class="list-item-header">
        <div class="list-item-title">${dashboard.name}</div>
        <div class="list-item-meta">
          <span class="badge" style="background: var(--primary-light); color: var(--primary); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">${category}</span>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.loadDashboardById('${dashboard.id}');" style="margin-left: 0.5rem;">
            📊 Load
          </button>
        </div>
      </div>
      ${dashboard.description ? `<div class="list-item-summary">${dashboard.description}</div>` : ""}
    </div>
  `;
  }).join("");
}

/**
 * Load and render a specific dashboard
 */
async function loadDashboardById(dashboardId) {
  if (!dashboardId) {
    window.showNotification("Dashboard ID is required", "error");
    return;
  }
  
  try {
    const data = await window.apiCall(`/api/library/dashboards/${dashboardId}/render`);
    
    if (!data.dashboard || !data.widgets) {
      window.showNotification("Invalid dashboard data", "error");
      return;
    }
    
    // Switch to dashboard content view
    window.switchView("dashboard-content");
    
    // Render dashboard
    renderDashboard(data.dashboard, data.widgets);
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    window.showNotification(`Failed to load dashboard: ${error.message}`, "error");
  }
}

/**
 * Render dashboard with widgets
 */
function renderDashboard(dashboard, widgets) {
  const container = document.getElementById("dashboard-content");
  if (!container) {
    console.error("Dashboard content container not found");
    return;
  }
  
  let html = `
    <div class="dashboard-header" style="margin-bottom: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="margin: 0;">${dashboard.name}</h2>
          ${dashboard.description ? `<p style="margin: 0.5rem 0 0 0; color: var(--text-light);">${dashboard.description}</p>` : ""}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" onclick="window.switchView('dashboards')">
            ← Back to Dashboards
          </button>
          <button class="btn btn-primary" onclick="window.loadDashboardById('${dashboard.id}')">
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
    <div class="dashboard-widgets" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
  `;
  
  widgets.forEach(widget => {
    html += renderWidget(widget);
  });
  
  html += `</div>`;
  
  container.innerHTML = html;
}

/**
 * Render a single widget
 */
function renderWidget(widget) {
  if (widget.error) {
    return `
      <div class="dashboard-widget" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem;">
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">${widget.id}</h3>
        <p style="color: var(--error);">Error: ${widget.error}</p>
      </div>
    `;
  }
  
  let widgetContent = "";
  
  switch (widget.type) {
    case "workflow-list":
      widgetContent = renderWorkflowListWidget(widget);
      break;
    case "version-status":
      widgetContent = renderVersionStatusWidget(widget);
      break;
    case "execution-summary":
      widgetContent = renderExecutionSummaryWidget(widget);
      break;
    case "agent-status":
      widgetContent = renderAgentStatusWidget(widget);
      break;
    case "stage-progress":
      widgetContent = renderStageProgressWidget(widget);
      break;
    case "metric":
      widgetContent = renderMetricWidget(widget);
      break;
    default:
      widgetContent = `<p style="color: var(--text-light);">Widget type "${widget.type}" not yet rendered</p>`;
  }
  
  return `
    <div class="dashboard-widget" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem;">
      <h3 style="margin: 0 0 1rem 0; font-size: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">${widget.id}</h3>
      ${widgetContent}
    </div>
  `;
}

/**
 * Render workflow list widget
 */
function renderWorkflowListWidget(widget) {
  const workflows = widget.data || [];
  const count = widget.count || 0;
  const total = widget.total || 0;
  
  if (workflows.length === 0) {
    return `<p style="color: var(--text-light);">No workflows found</p>`;
  }
  
  return `
    <div>
      <p style="font-size: 0.875rem; color: var(--text-light); margin-bottom: 0.75rem;">
        Showing ${count} of ${total} workflow(s)
      </p>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${workflows.slice(0, 5).map(wf => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
            <strong>${wf.name || wf.id}</strong>
            <span style="font-size: 0.75rem; color: var(--text-light); margin-left: 0.5rem;">${wf.source || "active"}</span>
          </li>
        `).join("")}
      </ul>
      ${workflows.length > 5 ? `<p style="font-size: 0.875rem; color: var(--text-light); margin-top: 0.5rem;">... and ${workflows.length - 5} more</p>` : ""}
    </div>
  `;
}

/**
 * Render version status widget
 */
function renderVersionStatusWidget(widget) {
  if (widget.error) {
    return `<p style="color: var(--error);">${widget.error}</p>`;
  }
  
  const version = widget.version || {};
  const metadata = version.metadata || {};
  const stages = version.stages || [];
  
  return `
    <div>
      <p><strong>Version:</strong> ${version.tag || "N/A"}</p>
      <p><strong>Status:</strong> ${metadata.status || "Unknown"}</p>
      ${stages.length > 0 ? `
        <div style="margin-top: 1rem;">
          <strong>Stages:</strong>
          <ul style="list-style: none; padding: 0; margin: 0.5rem 0 0 0;">
            ${stages.map(stage => `
              <li style="padding: 0.25rem 0;">
                <span style="font-size: 0.875rem;">${stage.name}:</span>
                <span class="badge" style="margin-left: 0.5rem; background: var(--${stage.status === "completed" ? "success" : stage.status === "in-progress" ? "primary" : "bg-secondary"}); padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">${stage.status}</span>
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}
    </div>
  `;
}

/**
 * Render execution summary widget
 */
function renderExecutionSummaryWidget(widget) {
  const executions = widget.data || [];
  const count = widget.count || 0;
  
  if (executions.length === 0) {
    return `<p style="color: var(--text-light);">No executions found</p>`;
  }
  
  return `
    <div>
      <p style="font-size: 0.875rem; color: var(--text-light); margin-bottom: 0.75rem;">
        ${count} execution(s)
      </p>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${executions.slice(0, 5).map(exec => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${exec.workflowId || "Unknown"}</strong>
                <span class="status-badge ${exec.status}" style="margin-left: 0.5rem;">${exec.status}</span>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-light);">
                ${window.formatDateForDisplay(exec.startedAt)}
              </span>
            </div>
          </li>
        `).join("")}
      </ul>
      ${executions.length > 5 ? `<p style="font-size: 0.875rem; color: var(--text-light); margin-top: 0.5rem;">... and ${executions.length - 5} more</p>` : ""}
    </div>
  `;
}

/**
 * Render agent status widget
 */
function renderAgentStatusWidget(widget) {
  const agents = widget.data || [];
  const byStatus = widget.byStatus || {};
  const count = widget.count || 0;
  
  if (agents.length === 0) {
    return `<p style="color: var(--text-light);">No active agents</p>`;
  }
  
  return `
    <div>
      <p style="font-size: 0.875rem; color: var(--text-light); margin-bottom: 0.75rem;">
        ${count} agent(s)
      </p>
      <div>
        ${Object.keys(byStatus).map(status => `
          <div style="margin-bottom: 0.5rem;">
            <span class="status-badge ${status}">${status}</span>
            <span style="font-size: 0.875rem; color: var(--text-light); margin-left: 0.5rem;">${byStatus[status].length}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * Render stage progress widget
 */
function renderStageProgressWidget(widget) {
  if (widget.error) {
    return `<p style="color: var(--error);">${widget.error}</p>`;
  }
  
  const stages = widget.stages || [];
  
  if (stages.length === 0) {
    return `<p style="color: var(--text-light);">No stages found</p>`;
  }
  
  return `
    <div>
      <p><strong>Version:</strong> ${widget.version || "N/A"}</p>
      <div style="margin-top: 1rem;">
        ${stages.map(stage => {
          const statusColor = stage.status === "completed" ? "success" : stage.status === "in-progress" ? "primary" : "bg-secondary";
          return `
            <div style="margin-bottom: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <span style="font-size: 0.875rem;">${stage.name}</span>
                <span class="badge" style="background: var(--${statusColor}); padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">${stage.status}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

/**
 * Render metric widget
 */
function renderMetricWidget(widget) {
  const value = widget.value || 0;
  const label = widget.label || "Metric";
  const format = widget.format || "number";
  
  let formattedValue = value;
  if (format === "number") {
    formattedValue = value.toLocaleString();
  }
  
  return `
    <div style="text-align: center;">
      <div style="font-size: 2rem; font-weight: bold; color: var(--primary); margin-bottom: 0.5rem;">
        ${formattedValue}
      </div>
      <div style="font-size: 0.875rem; color: var(--text-light);">
        ${label}
      </div>
    </div>
  `;
}

// Expose globally
window.loadDashboards = loadDashboards;
window.loadDashboardById = loadDashboardById;
window.renderDashboardsList = renderDashboardsList;

