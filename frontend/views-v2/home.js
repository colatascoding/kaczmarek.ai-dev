/**
 * Home View V2
 * Stage-based home dashboard
 */

/**
 * Load workstreams for current version
 */
async function loadWorkstreams(versionTag) {
  try {
    const data = await window.apiCall(`/api/workstreams?versionTag=${versionTag}`);
    const workstreams = data.workstreams || [];
    
    renderWorkstreams(workstreams);
    document.getElementById("workstream-count").textContent = workstreams.length;
  } catch (error) {
    console.error("Failed to load workstreams:", error);
    document.getElementById("workstreams-list").innerHTML = 
      `<p style="color: var(--text-light); text-align: center; padding: 2rem;">Failed to load workstreams</p>`;
  }
}

/**
 * Render workstreams
 */
function renderWorkstreams(workstreams) {
  const container = document.getElementById("workstreams-list");
  
  if (workstreams.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-light);">
        <p>No active workstreams</p>
        <button class="btn btn-primary btn-sm" onclick="openWorkstreamWizard()" style="margin-top: 1rem;">
          Create Workstream
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = workstreams.map(ws => {
    const statusClass = ws.status || "active";
    const progress = calculateWorkstreamProgress(ws);
    
    return `
      <div class="workstream-card-v2" onclick="showWorkstreamDetail('${ws.id}')">
        <div class="workstream-card-header">
          <div>
            <h4>${ws.name || ws.id}</h4>
            <span class="status-badge ${statusClass}">${statusClass}</span>
          </div>
        </div>
        ${ws.description ? `<p style="color: var(--text-light); font-size: 0.875rem; margin: 0.5rem 0;">${ws.description}</p>` : ""}
        <div class="workstream-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-light);">
            <span>${progress}% complete</span>
            <span>${ws.metadata?.tasks?.length || 0} tasks</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * Calculate workstream progress
 */
function calculateWorkstreamProgress(workstream) {
  const tasks = workstream.metadata?.tasks || [];
  if (tasks.length === 0) return 0;
  
  const completed = tasks.filter(t => t.completed).length;
  return Math.round((completed / tasks.length) * 100);
}

/**
 * Show workstream detail
 */
function showWorkstreamDetail(workstreamId) {
  // TODO: Implement workstream detail view
  window.showNotification("Workstream detail view coming soon", "info");
}

// Expose globally
window.loadWorkstreams = loadWorkstreams;
window.showWorkstreamDetail = showWorkstreamDetail;

