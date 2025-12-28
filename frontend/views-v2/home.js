/**
 * Home View V2
 * Stage-based home dashboard
 */

/**
 * Check for pending decisions and display them
 */
async function checkAndDisplayDecisions() {
  try {
    // Use cached executions if available from loadHome
    let executionsData;
    if (window._cachedExecutions && Date.now() - window._cachedExecutions.timestamp < 5000) {
      executionsData = window._cachedExecutions.data;
    } else {
      executionsData = await window.apiCall("/api/executions").catch(() => ({ executions: [] }));
      window._cachedExecutions = { data: executionsData, timestamp: Date.now() };
    }
    const executions = executionsData.executions || [];
    
    // Find waiting executions
    const waitingExecutions = executions.filter(e => e.status === "waiting");
    
    // Batch load decisions for all waiting executions
    if (waitingExecutions.length > 0 && window.loadPendingDecisions) {
      await Promise.allSettled(
        waitingExecutions.map(exec => window.loadPendingDecisions(exec.executionId))
      );
    }
    
    // Start polling if there are waiting executions
    if (waitingExecutions.length > 0 && window.startDecisionsPolling) {
      // Start polling for all waiting executions in parallel
      waitingExecutions.forEach(exec => {
        window.startDecisionsPolling(exec.executionId);
      });
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
        document.getElementById("current-version-status").className = window.getStatusClass ? 
          window.getStatusClass(currentVersion.status, "unknown") : 
          `status-badge ${(currentVersion.status || "unknown").toLowerCase().replace(/\s+/g, "-")}`;
        
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
  
  // Load recent activity (reuse cached data if available)
  let waitingExecutions = [];
  try {
    let activityData;
    if (window._cachedExecutions && Date.now() - window._cachedExecutions.timestamp < 5000) {
      activityData = window._cachedExecutions.data;
    } else {
      activityData = await window.apiCall("/api/executions?limit=10");
      window._cachedExecutions = { data: activityData, timestamp: Date.now() };
    }
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
          <div class="list-item-v2 ${isWaiting ? 'waiting-execution' : ''}" data-execution-id="${window.escapeHtml ? window.escapeHtml(exec.executionId) : exec.executionId}" data-action="show-execution-details" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <h4 style="margin: 0 0 0.5rem 0;">${window.escapeHtml ? window.escapeHtml(exec.workflow?.name || exec.workflowId || "Unknown Workflow") : (exec.workflow?.name || exec.workflowId || "Unknown Workflow")}</h4>
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
  
  // Attach event listeners after loading
  attachHomeEventListeners();
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
  if (window.showExecutionDetailsV2) {
    window.showExecutionDetailsV2(executionId);
  } else if (window.showExecutionDetails) {
    window.showExecutionDetails(executionId);
  } else {
    // Fallback: show notification with execution ID
    const safeId = window.escapeHtml ? window.escapeHtml(executionId) : executionId;
    window.showNotification(`Execution: ${safeId}`, "info");
  }
}

/**
 * Attach event listeners for home view actions
 */
function attachHomeEventListeners() {
  // Execution detail clicks
  document.querySelectorAll("[data-action='show-execution-details']").forEach(element => {
    element.addEventListener("click", () => {
      const executionId = element.dataset.executionId;
      if (executionId) {
        showExecutionDetails(executionId);
      }
    });
  });
  
  // Make stage items clickable - navigate to version detail and show that stage
  document.querySelectorAll(".stage-item[data-stage]").forEach(item => {
    // Remove existing listeners to avoid duplicates
    const newItem = item.cloneNode(true);
    item.parentNode?.replaceChild(newItem, item);
    const freshItem = item.parentNode?.querySelector(`.stage-item[data-stage="${item.dataset.stage}"]`) || newItem;
    
    freshItem.style.cursor = "pointer";
    freshItem.title = `Click to view ${item.dataset.stage} stage`;
    freshItem.addEventListener("click", (e) => {
      e.stopPropagation();
      const stage = freshItem.dataset.stage;
      if (!stage) return;
      
      // Get current version
      const versionTag = window.currentVersion || 
        document.getElementById("current-version-title")?.textContent?.replace("Version ", "") ||
        document.getElementById("version-detail-title")?.textContent?.replace("Version ", "");
      
      if (!versionTag) {
        window.showNotification("No version selected", "error");
        return;
      }
      
      // Navigate to version detail view
      if (window.showVersionDetail) {
        window.showVersionDetail(versionTag);
        
        // After a short delay, show the clicked stage
        setTimeout(() => {
          if (window.showStage) {
            window.showStage(stage);
          }
        }, 300);
      } else {
        // Fallback: try to switch view and show stage
        if (window.switchView) {
          window.switchView("version-detail");
          setTimeout(() => {
            if (window.showStage) {
              window.showStage(stage);
            }
          }, 300);
        }
      }
    });
  });
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
  // Check if workstream is already marked as completed
  if (workstream.status === 'completed') {
    return 100;
  }
  
  // Validate tasks array
  const tasks = Array.isArray(workstream.metadata?.tasks) 
    ? workstream.metadata.tasks 
    : [];
  
  if (tasks.length === 0) {
    // If no tasks but workstream has a status, return based on status
    return workstream.status === 'completed' ? 100 : 0;
  }
  
  // Count completed tasks (handle both boolean and string "true")
  const completed = tasks.filter(t => {
    const isCompleted = t.completed === true || 
                       t.completed === 'true' || 
                       t.status === 'completed' ||
                       (typeof t.completed === 'string' && t.completed.toLowerCase() === 'true');
    return isCompleted;
  }).length;
  
  return Math.round((completed / tasks.length) * 100);
}

/**
 * Show workstream detail
 */
async function showWorkstreamDetail(workstreamId) {
  try {
    // Get current version tag
    const versionTag = window.currentVersion || document.getElementById("version-detail-title")?.textContent?.replace("Version ", "");
    if (!versionTag) {
      window.showNotification("No version selected", "error");
      return;
    }
    
    // Fetch workstream details
    const data = await window.apiCall(`/api/workstreams/${versionTag}/${workstreamId}`);
    
    if (data.workstream) {
      const ws = data.workstream;
      const metadata = ws.metadata || {};
      
      // Create modal
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.style.display = "block";
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
          <div class="modal-header">
            <h2>Workstream: ${metadata.name || workstreamId}</h2>
            <button class="btn btn-sm" onclick="this.closest('.modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom: 1rem;">
              <strong>Status:</strong> <span class="status-badge ${metadata.status || 'active'}">${metadata.status || 'active'}</span>
            </div>
            ${metadata.description ? `<div style="margin-bottom: 1rem;"><strong>Description:</strong><p>${metadata.description}</p></div>` : ""}
            ${metadata.progress !== undefined ? `<div style="margin-bottom: 1rem;"><strong>Progress:</strong> ${metadata.progress}%</div>` : ""}
            ${metadata.tasks && metadata.tasks.length > 0 ? `
              <div style="margin-bottom: 1rem;">
                <strong>Tasks:</strong>
                <ul>
                  ${metadata.tasks.map(t => `<li>${t.completed ? '✓' : '○'} ${t.description || t}</li>`).join("")}
                </ul>
              </div>
            ` : ""}
            ${ws.progress ? `<div style="margin-bottom: 1rem;"><strong>Progress Log:</strong><pre style="max-height: 300px; overflow: auto; background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius);">${ws.progress.substring(0, 1000)}${ws.progress.length > 1000 ? '...' : ''}</pre></div>` : ""}
            ${metadata.createdAt ? `<div style="margin-bottom: 1rem;"><strong>Created:</strong> ${new Date(metadata.createdAt).toLocaleDateString()}</div>` : ""}
          </div>
          <div class="modal-footer">
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
      window.showNotification("Workstream not found", "error");
    }
  } catch (error) {
    console.error("Failed to load workstream detail:", error);
    window.showNotification(`Failed to load workstream: ${error.message}`, "error");
  }
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
window.attachHomeEventListeners = attachHomeEventListeners;
