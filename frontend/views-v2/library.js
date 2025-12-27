/**
 * Library View V2
 * Browse workflows, dashboards, and templates
 */

// currentLibraryTab is managed by switchLibraryTab function
// let currentLibraryTab = "workflows";

/**
 * Load library view
 */
async function loadLibraryV2() {
  if (window.switchLibraryTab) {
    window.switchLibraryTab("workflows");
  }
}

/**
 * Load library tab
 */
async function loadLibraryTab(tab) {
  currentLibraryTab = tab;
  const container = document.getElementById("library-content");
  
  container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-light);">Loading ${tab}...</div>`;
  
  try {
    switch (tab) {
      case "workflows":
        await loadLibraryWorkflows(container);
        break;
      case "dashboards":
        await loadLibraryDashboards(container);
        break;
      case "templates":
        await loadLibraryTemplates(container);
        break;
      default:
        container.innerHTML = `<p>Unknown tab: ${tab}</p>`;
    }
  } catch (error) {
    console.error(`Failed to load library ${tab}:`, error);
    container.innerHTML = `<p style="color: var(--error);">Failed to load: ${error.message}</p>`;
  }
}

/**
 * Load library workflows
 */
async function loadLibraryWorkflows(container) {
  try {
    const data = await window.apiCall("/api/library/workflows");
    const workflows = data.workflows || [];
    
    if (workflows.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
          <h3 style="margin-bottom: 1rem;">No Workflows Found</h3>
          <p style="color: var(--text-light);">Workflows will appear here when added to the library</p>
        </div>
      `;
      return;
    }
    
    // Group by category
    const byCategory = {};
    workflows.forEach(wf => {
      const category = wf.category || "other";
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(wf);
    });
    
    container.innerHTML = Object.keys(byCategory).map(category => {
      const categoryWorkflows = byCategory[category];
      return `
        <div class="section-v2" style="margin-bottom: 1.5rem;">
          <div class="section-header-v2">
            <h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>
            <span class="badge">${categoryWorkflows.length}</span>
          </div>
          <div class="list-v2">
            ${categoryWorkflows.map(wf => `
              <div class="list-item-v2" onclick="showWorkflowDetail('${wf.id}')">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <div style="flex: 1;">
                    <h4 style="margin: 0 0 0.5rem 0;">${wf.name || wf.id}</h4>
                    ${wf.description ? `<p style="color: var(--text-light); font-size: 0.875rem; margin: 0;">${wf.description}</p>` : ""}
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                      <span class="badge" style="background: var(--primary-light); color: var(--primary);">
                        ${wf.source || "active"}
                      </span>
                      ${wf.libraryItem ? `<span class="badge">Library</span>` : ""}
                    </div>
                  </div>
                  <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); runWorkflow('${wf.id}')">
                    Run
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");
  } catch (error) {
    container.innerHTML = `<p style="color: var(--error);">Failed to load workflows: ${error.message}</p>`;
  }
}

/**
 * Load library dashboards
 */
async function loadLibraryDashboards(container) {
  try {
    const data = await window.apiCall("/api/library/dashboards");
    const dashboards = data.dashboards || [];
    
    if (dashboards.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
          <h3 style="margin-bottom: 1rem;">No Dashboards Found</h3>
          <p style="color: var(--text-light);">Dashboards will appear here when added to the library</p>
        </div>
      `;
      return;
    }
    
    // Group by category
    const byCategory = {};
    dashboards.forEach(db => {
      const category = db.category || "other";
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(db);
    });
    
    container.innerHTML = Object.keys(byCategory).map(category => {
      const categoryDashboards = byCategory[category];
      return `
        <div class="section-v2" style="margin-bottom: 1.5rem;">
          <div class="section-header-v2">
            <h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>
            <span class="badge">${categoryDashboards.length}</span>
          </div>
          <div class="workstreams-grid-v2">
            ${categoryDashboards.map(db => `
              <div class="workstream-card-v2" onclick="window.loadDashboardById('${db.id}')">
                <div class="workstream-card-header">
                  <h4 style="margin: 0;">${db.name}</h4>
                </div>
                ${db.description ? `<p style="color: var(--text-light); font-size: 0.875rem; margin: 0.5rem 0;">${db.description}</p>` : ""}
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.loadDashboardById('${db.id}')" style="width: 100%; margin-top: 0.5rem;">
                  Load Dashboard
                </button>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");
  } catch (error) {
    container.innerHTML = `<p style="color: var(--error);">Failed to load dashboards: ${error.message}</p>`;
  }
}

/**
 * Load library templates
 */
async function loadLibraryTemplates(container) {
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem;">
      <h3 style="margin-bottom: 1rem;">Templates Coming Soon</h3>
      <p style="color: var(--text-light);">Template library will be available in a future update</p>
    </div>
  `;
}

/**
 * Show workflow detail
 */
async function showWorkflowDetail(workflowId) {
  try {
    // Fetch workflow details
    const data = await window.apiCall(`/api/workflows/${workflowId}`);
    
    if (data.workflow) {
      const wf = data.workflow;
      
      // Create modal
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.style.display = "block";
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
          <div class="modal-header">
            <h2>${wf.name || workflowId}</h2>
            <button class="btn btn-sm" onclick="this.closest('.modal').remove()">×</button>
          </div>
          <div class="modal-body">
            ${wf.description ? `<p style="margin-bottom: 1rem; color: var(--text-light);">${wf.description}</p>` : ""}
            <div style="margin-bottom: 1rem;">
              <strong>Version:</strong> ${wf.version || "N/A"} | 
              <strong>Source:</strong> ${wf.source || "unknown"} |
              ${wf.category ? `<strong>Category:</strong> ${wf.category}` : ""}
            </div>
            ${wf.steps && wf.steps.length > 0 ? `
              <div style="margin-bottom: 1rem;">
                <strong>Steps (${wf.steps.length}):</strong>
                <ol style="margin-left: 1.5rem; margin-top: 0.5rem;">
                  ${wf.steps.map((step, idx) => `
                    <li style="margin-bottom: 0.5rem;">
                      <strong>${step.id || `Step ${idx + 1}`}</strong>
                      ${step.module && step.action ? `(${step.module}.${step.action})` : ""}
                      ${step.description ? `<br><span style="color: var(--text-light); font-size: 0.9em;">${step.description}</span>` : ""}
                    </li>
                  `).join("")}
                </ol>
              </div>
            ` : ""}
            ${wf.summary ? `
              <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
                <strong>Summary:</strong>
                <div style="margin-top: 0.5rem; white-space: pre-wrap;">${wf.summary}</div>
              </div>
            ` : ""}
            ${wf.executions !== undefined ? `
              <div style="margin-bottom: 1rem;">
                <strong>Executions:</strong> ${wf.executions} |
                <strong>Last Run:</strong> ${wf.lastRun ? new Date(wf.lastRun).toLocaleString() : "Never"}
              </div>
            ` : ""}
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="window.runWorkflow && window.runWorkflow('${workflowId}'); this.closest('.modal').remove();">Run Workflow</button>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Close on background click
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } else {
      window.showNotification("Workflow not found", "error");
    }
  } catch (error) {
    console.error("Failed to load workflow detail:", error);
    window.showNotification(`Failed to load workflow: ${error.message}`, "error");
  }
}

// Expose globally
window.loadLibraryV2 = loadLibraryV2;
window.loadLibraryTab = loadLibraryTab;
window.showWorkflowDetail = showWorkflowDetail;

