/**
 * Home View V2
 * Stage-based home dashboard
 */

/**
 * Check for pending decisions and display them
 */
async function checkAndDisplayDecisions() {
  try {
    // Get all executions
    const executionsData = await window.apiCall("/api/executions").catch(() => ({ executions: [] }));
    const executions = executionsData.executions || [];
    
    // Find waiting executions
    const waitingExecutions = executions.filter(e => e.status === "waiting");
    
    // Load decisions for each waiting execution
    for (const exec of waitingExecutions) {
      if (window.loadPendingDecisions) {
        await window.loadPendingDecisions(exec.executionId);
      }
    }
    
    // Start polling if there are waiting executions
    if (waitingExecutions.length > 0 && window.startDecisionsPolling) {
      // Poll the first waiting execution (or all of them)
      for (const exec of waitingExecutions) {
        window.startDecisionsPolling(exec.executionId);
      }
    }
  } catch (error) {
    console.error("Failed to check for decisions:", error);
  }
}

/**
 * Load home view
 */
async function loadHome() {
  // Check for pending decisions first
  await checkAndDisplayDecisions();
  
  // Load current version
  try {
    const versionData = await window.apiCall("/api/versions");
    const versions = versionData.versions || [];
    const currentVersion = versions[0] || null;
    
    const versionCard = document.getElementById("current-version-card");
    if (versionCard) {
      if (currentVersion) {
        document.getElementById("current-version-title").textContent = `Version ${currentVersion.tag}`;
        document.getElementById("current-version-status").textContent = currentVersion.status || "unknown";
        document.getElementById("current-version-status").className = `status-badge ${(currentVersion.status || "unknown").toLowerCase().replace(/\s+/g, "-")}`;
        
        // Load workstreams for current version
        if (window.loadWorkstreams) {
          await window.loadWorkstreams(currentVersion.tag);
        }
      } else {
        document.getElementById("current-version-title").textContent = "No version found";
        document.getElementById("current-version-status").textContent = "-";
      }
    }
  } catch (error) {
    console.error("Failed to load current version:", error);
  }
  
  // Load recent activity
  let waitingExecutions = [];
  try {
    const activityData = await window.apiCall("/api/executions?limit=10");
    const executions = activityData.executions || [];
    
    const activityContainer = document.getElementById("recent-activity");
    if (activityContainer) {
      if (executions.length === 0) {
        activityContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-light);">
            <p>No recent activity</p>
          </div>
        `;
      } else {
        activityContainer.innerHTML = executions.map(exec => {
          const isWaiting = exec.status === "waiting";
          return `
          <div class="list-item-v2 ${isWaiting ? 'waiting-execution' : ''}" onclick="showExecutionDetails('${exec.executionId}')" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <h4 style="margin: 0 0 0.5rem 0;">${exec.workflow?.name || exec.workflowId || "Unknown Workflow"}</h4>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-light);">
                  ${window.formatDateForDisplay ? window.formatDateForDisplay(exec.startedAt) : exec.startedAt}
                </p>
                ${isWaiting ? `
                  <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--warning);">
                    ⚠️ Waiting for your decision
                  </p>
                ` : ""}
              </div>
              <span class="status-badge ${exec.status}">${exec.status}</span>
            </div>
          </div>
        `;
        }).join("");
        
        // Check for decisions on waiting executions
        waitingExecutions = executions.filter(e => e.status === "waiting");
        for (const exec of waitingExecutions) {
          if (window.loadPendingDecisions) {
            await window.loadPendingDecisions(exec.executionId);
          }
        }
        
        // Set up periodic checking for decisions
        // Use the decisions.js polling mechanism instead of creating a duplicate
        if (window.startDecisionsPolling && waitingExecutions.length > 0) {
          // Poll all waiting executions
          for (const exec of waitingExecutions) {
            window.startDecisionsPolling(exec.executionId);
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to load recent activity:", error);
  }
}

/**
 * Refresh home view
 */
function refreshHome() {
  loadHome();
}

/**
 * Show execution details (redirect to executions view if available)
 */
function showExecutionDetails(executionId) {
  // Try to use the existing execution details function
  if (window.showExecutionDetails) {
    window.showExecutionDetails(executionId);
  } else {
    // Fallback: show notification with execution ID
    window.showNotification(`Execution: ${executionId}`, "info");
  }
}

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
// Use loadHomeView to avoid conflict with app-v2.js's loadHome
window.loadHomeView = loadHome;
window.loadHome = loadHome; // Keep for backward compatibility but prefer loadHomeView
window.refreshHome = refreshHome;
window.showExecutionDetails = showExecutionDetails;
window.loadWorkstreams = loadWorkstreams;
window.showWorkstreamDetail = showWorkstreamDetail;
window.checkAndDisplayDecisions = checkAndDisplayDecisions;
