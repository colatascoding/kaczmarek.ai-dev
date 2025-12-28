/**
 * Versions view module
 */

/**
 * Load versions
 */
async function loadVersions() {
  try {
    const data = await window.apiCall("/api/versions");
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
  
  container.innerHTML = versions.map(v => {
    const tag = window.escapeHtml(v.tag || "");
    const status = window.escapeHtml(v.status || "");
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");
    const summary = v.summary ? window.escapeHtml(v.summary) : "";
    const started = v.started ? window.escapeHtml(v.started) : "";
    const completed = v.completed ? window.escapeHtml(v.completed) : "";
    
    return `
    <div class="list-item">
      <div class="list-item-header">
        <div class="list-item-title">${tag}</div>
        <span class="status-badge ${statusClass}">${status}</span>
      </div>
      ${summary ? `<div class="list-item-summary">${summary}</div>` : ""}
      <div class="list-item-body">
        <p><strong>Review:</strong> ${v.hasReview ? "✓" : "✗"}</p>
        <p><strong>Progress:</strong> ${v.hasProgress ? "✓" : "✗"}</p>
        ${started ? `<p><strong>Started:</strong> ${started}</p>` : ""}
        ${completed ? `<p><strong>Completed:</strong> ${completed}</p>` : ""}
        ${v.nextStepsCount > 0 ? `<p><strong>Tasks:</strong> ${v.completedStepsCount}/${v.nextStepsCount} completed</p>` : ""}
      </div>
    </div>
  `;
  }).join("");
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
  
  const tag = window.escapeHtml(version.tag || "");
  const status = window.escapeHtml(version.status || "");
  const statusClass = status.toLowerCase().replace(/\s+/g, "-");
  const summary = version.summary ? window.escapeHtml(version.summary) : "";
  const started = version.started ? window.escapeHtml(version.started) : "";
  const completed = version.completed ? window.escapeHtml(version.completed) : "";
  
  container.innerHTML = `
    <div class="version-summary-card">
      <div class="version-summary-header">
        <h4>${tag}</h4>
        <span class="status-badge ${statusClass}">${status}</span>
      </div>
      ${summary ? `<p class="version-summary-text">${summary}</p>` : ""}
      <div class="version-summary-meta">
        ${started ? `<span>Started: ${started}</span>` : ""}
        ${completed ? `<span>Completed: ${completed}</span>` : ""}
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

// Expose globally
window.loadVersions = loadVersions;
window.renderVersions = renderVersions;
window.renderVersionSummary = renderVersionSummary;


