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

// Expose globally
window.loadVersions = loadVersions;
window.renderVersions = renderVersions;
window.renderVersionSummary = renderVersionSummary;

