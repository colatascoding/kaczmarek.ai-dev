/**
 * Versions View V2
 * Stage-based version management
 */

// Stage renderers are loaded from versions-stage-renderers.js

/**
 * Load versions list
 */
async function loadVersionsV2() {
  try {
    const data = await window.apiCall("/api/versions");
    const versions = data.versions || [];
    
    renderVersionsList(versions);
  } catch (error) {
    console.error("Failed to load versions:", error);
    document.getElementById("versions-list").innerHTML = 
      `<div style="text-align: center; padding: 2rem; color: var(--text-light);">
        <p>Failed to load versions: ${error.message}</p>
      </div>`;
  }
}

/**
 * Render versions list
 */
function renderVersionsList(versions) {
  const container = document.getElementById("versions-list");
  
  if (versions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <h3 style="margin-bottom: 1rem;">No Versions Found</h3>
        <p style="color: var(--text-light); margin-bottom: 1.5rem;">Create your first version to get started</p>
        <button class="btn btn-primary" onclick="openVersionCreationWizard()">Create Version</button>
      </div>
    `;
    return;
  }
  
  // Start polling for versions with active planning agents
  versions.forEach(version => {
    if (version.planningAgent && 
        version.planningAgent.status !== "completed" && 
        version.planningAgent.status !== "failed" &&
        window.startPlanningAgentPolling) {
      window.startPlanningAgentPolling(version.tag, version.planningAgent.id);
    }
  });
  
  container.innerHTML = versions.map(version => {
    const statusClass = window.getStatusClass ? window.getStatusClass(version.status, "pending") : 
                       (version.status || "pending").toLowerCase().replace(/\s+/g, "-");
    const hasActivePlanningAgent = version.planningAgent && 
      version.planningAgent.status !== "completed" && 
      version.planningAgent.status !== "failed";
    
    return `
      <div class="version-card-v2" style="margin-bottom: 1.5rem;">
        <div class="version-card-header">
          <div>
            <h3>Version ${version.tag}</h3>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
              <span class="status-badge ${statusClass}">${version.status || "Unknown"}</span>
              ${hasActivePlanningAgent ? `
                <span class="status-badge processing" style="font-size: 0.75rem;">
                  🤖 Planning Agent Running
                </span>
              ` : ""}
            </div>
          </div>
          <button class="btn btn-primary" data-version-tag="${window.escapeHtml ? window.escapeHtml(version.tag) : version.tag}" data-action="show-version-detail">View Details</button>
        </div>
        
        ${version.description ? `<p style="color: var(--text-light); margin: 1rem 0;">${version.description}</p>` : ""}
        
        <div class="stage-progress-v2" style="margin: 1rem 0;">
          <div class="stage-progress-bar">
            ${renderVersionStageProgress(version)}
          </div>
        </div>
        
        ${version.stages ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
            ${version.stages.map(stage => `
              <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-weight: 500;">${stage.name}</span>
                  <span class="${window.getStatusClass ? window.getStatusClass(stage.status, "pending") : `status-badge ${(stage.status || "pending").toLowerCase().replace(/\s+/g, "-")}`}">${stage.status || "pending"}</span>
                </div>
                <button class="btn btn-sm btn-secondary" data-version-tag="${window.escapeHtml ? window.escapeHtml(version.tag) : version.tag}" data-stage-name="${window.escapeHtml ? window.escapeHtml(stage.name) : stage.name}" data-action="show-stage-wizard" style="width: 100%;">
                  View ${stage.name}
                </button>
              </div>
            `).join("")}
          </div>
        ` : ""}
        
        ${(() => {
          const status = (version.status || "").toLowerCase();
          const canReject = status === "in-progress" || (status !== "completed" && status !== "rejected" && status !== "");
          return canReject ? `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
              <button class="btn btn-danger" data-version-tag="${window.escapeHtml ? window.escapeHtml(version.tag) : version.tag}" data-action="reject-version" style="width: 100%;">
                Reject Version
              </button>
            </div>
          ` : "";
        })()}
      </div>
    `;
  }).join("");
}

/**
 * Render version stage progress
 */
function renderVersionStageProgress(version) {
  const stages = version.stages || [];
  const stagesMap = {
    plan: stages.find(s => s.name === "01_plan" || s.name === "plan"),
    implement: stages.find(s => s.name === "02_implement" || s.name === "implement"),
    test: stages.find(s => s.name === "03_test" || s.name === "test"),
    review: stages.find(s => s.name === "04_review" || s.name === "review")
  };
  
  const stageNames = ["plan", "implement", "test", "review"];
  let html = "";
  
  stageNames.forEach((stageName, index) => {
    const stage = stagesMap[stageName];
    const status = stage?.status || "pending";
    const statusClass = status === "completed" ? "completed" : 
                       status === "in-progress" ? "active" : "pending";
    
    html += `
      <div class="stage-item ${statusClass}" data-stage="${stageName}">
        <div class="stage-icon">${statusClass === "completed" ? "✓" : statusClass === "active" ? "→" : "○"}</div>
        <div class="stage-label">${stageName.charAt(0).toUpperCase() + stageName.slice(1)}</div>
      </div>
    `;
    
    if (index < stageNames.length - 1) {
      html += `<div class="stage-connector ${statusClass === "completed" ? "completed" : ""}"></div>`;
    }
  });
  
  return html;
}

/**
 * Load version detail
 */
async function loadVersionDetail(versionTag) {
  try {
    const cleanTag = cleanVersionTagLocal(versionTag);
    // Use cached versions data if available
    let versionsData;
    if (window._cachedVersions && Date.now() - window._cachedVersions.timestamp < 5000) {
      versionsData = window._cachedVersions.data;
    } else {
      versionsData = await window.apiCall(`/api/versions`);
      window._cachedVersions = { data: versionsData, timestamp: Date.now() };
    }
    const version = (versionsData.versions || []).find(v => v.tag === cleanTag);
    
    if (!version) {
      window.showNotification("Version not found", "error");
      return;
    }
    
    const versionData = version;
    const stagesData = version.stages || [];
    
    const displayTag = versionData?.tag || cleanTag;
    document.getElementById("version-detail-title").textContent = `Version ${displayTag}`;
    
    // Store current version tag for later use
    window.currentVersionTag = displayTag;
    
    // Add reject button to header if version is in-progress
    const viewActions = document.querySelector("#version-detail-view .view-actions");
    if (viewActions) {
      const existingRejectBtn = viewActions.querySelector(".btn-reject-version");
      if (existingRejectBtn) {
        existingRejectBtn.remove();
      }
      
      const status = (versionData.status || "").toLowerCase();
      // Show reject button for any status that's not completed or rejected
      if (status !== "completed" && status !== "rejected" && status !== "") {
        const rejectBtn = document.createElement("button");
        rejectBtn.className = "btn btn-danger btn-reject-version";
        rejectBtn.textContent = "🚫 Reject Version";
        rejectBtn.onclick = () => rejectVersion(displayTag);
        viewActions.insertBefore(rejectBtn, viewActions.firstChild);
      }
    }
    
    // Update stage nav statuses
    if (stagesData && Array.isArray(stagesData)) {
      stagesData.forEach(stage => {
        const stageName = stage.name.replace(/^\d+_/, ""); // Remove prefix
        const statusEl = document.getElementById(`stage-status-${stageName}`);
        if (statusEl) {
          statusEl.textContent = stage.status || "pending";
          statusEl.className = `stage-nav-status ${window.getStatusClass ? window.getStatusClass(stage.status, "pending") : `status-badge ${(stage.status || "pending").toLowerCase().replace(/\s+/g, "-")}`}`;
        }
      });
    }
    
    // Load initial stage (implement if available, otherwise first)
    const initialStage = stagesData?.find(s => s.status === "in-progress") || stagesData?.[0];
    if (initialStage) {
      const stageName = initialStage.name.replace(/^\d+_/, "");
      if (window.showStage) {
        window.showStage(stageName);
      }
    } else {
      // Default to implement stage
      if (window.showStage) {
        window.showStage("implement");
      }
    }
  } catch (error) {
    console.error("Failed to load version detail:", error);
    window.showNotification("Failed to load version details", "error");
  }
}

/**
 * Load version stages
 */
async function loadVersionStages(versionTag) {
  try {
    // Remove "version" prefix if present
    const cleanTag = cleanVersionTagLocal(versionTag);
    // Use cached versions data if available and recent (< 5 seconds)
    let data;
    if (window._cachedVersions && Date.now() - window._cachedVersions.timestamp < 5000) {
      data = window._cachedVersions.data;
    } else {
      data = await window.apiCall(`/api/versions`);
      window._cachedVersions = { data: data, timestamp: Date.now() };
    }
    const version = (data.versions || []).find(v => v.tag === cleanTag || v.tag === versionTag);
    return version?.stages || [];
  } catch (error) {
    console.error("Failed to load version stages:", error);
    return [];
  }
}

/**
 * Helper: Get current version tag from DOM or window state
 * @returns {string|null} Current version tag or null
 */
function getCurrentVersionTag() {
  return window.currentVersionTag || 
         document.getElementById("version-detail-title")?.textContent?.replace("Version ", "") || 
         null;
}

/**
 * Helper: Clean version tag (remove "version" prefix)
 * Uses centralized helper from utils.js if available
 * @param {string} versionTag - Version tag to clean
 * @returns {string} Cleaned version tag
 */
function cleanVersionTagLocal(versionTag) {
  return window.cleanVersionTag ? window.cleanVersionTag(versionTag) : versionTag.replace(/^version/, "");
}

/**
 * Load stage content
 */
async function loadStageContent(versionTag, stage) {
  const container = document.getElementById("stage-content");
  container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-light);">Loading ${stage} stage...</div>`;
  
  try {
    // Remove "version" prefix if present
    const cleanTag = cleanVersionTagLocal(versionTag);
    
    // Map stage names
    const stageMap = {
      plan: "01_plan",
      implement: "02_implement",
      test: "03_test",
      review: "04_review"
    };
    
    // stageFolder is for future use
    // const stageFolder = stageMap[stage] || stage;
    
    // Load stage-specific content using renderers from versions-stage-renderers.js
    // These are the enhanced versions with technical details, sync history, etc.
    switch (stage) {
      case "plan":
        if (window.renderPlanStage) {
          await window.renderPlanStage(cleanTag, container);
        } else {
          container.innerHTML = `<p style="color: var(--error);">Plan stage renderer not available. Please refresh the page.</p>`;
        }
        break;
      case "implement":
        if (window.renderImplementStage) {
          await window.renderImplementStage(cleanTag, container);
        } else {
          container.innerHTML = `<p style="color: var(--error);">Implement stage renderer not available. Please refresh the page.</p>`;
        }
        break;
      case "test":
        if (window.renderTestStage) {
          await window.renderTestStage(cleanTag, container);
        } else {
          container.innerHTML = `<p style="color: var(--error);">Test stage renderer not available. Please refresh the page.</p>`;
        }
        break;
      case "review":
        if (window.renderReviewStage) {
          await window.renderReviewStage(cleanTag, container);
        } else {
          container.innerHTML = `<p style="color: var(--error);">Review stage renderer not available. Please refresh the page.</p>`;
        }
        break;
      default:
        container.innerHTML = `<p>Unknown stage: ${stage}</p>`;
    }
  } catch (error) {
    console.error("Failed to load stage content:", error);
    container.innerHTML = `<p style="color: var(--error);">Failed to load stage content: ${error.message}</p>`;
  }
}

/**
 * NOTE: All stage render functions (renderPlanStage, renderImplementStage, renderTestStage, renderReviewStage)
 * have been moved to versions-stage-renderers.js to avoid duplication.
 * 
 * The enhanced versions with technical details, sync history, and branch merging are now in:
 * frontend/views-v2/versions-stage-renderers.js
 * 
 * This file (versions.js) now focuses on:
 * - Version list management (loadVersionsV2, renderVersionsList)
 * - Version detail navigation (loadVersionDetail, loadVersionStages)
 * - Stage content loading (loadStageContent - delegates to renderers)
 * - Planning agent polling (startPlanningAgentPolling)
 * - Version rejection (rejectVersion)
 */

/**
 * Planning agent polling
 */
const planningAgentIntervals = new Map();
// Track which agents we've already notified about to prevent duplicate notifications
const notifiedAgents = new Set();

// Polling constants
const DEFAULT_POLL_INTERVAL = 15000; // 15 seconds
const MAX_POLL_INTERVAL = 120000; // 2 minutes max
const MAX_CONSECUTIVE_ERRORS = 5;

function startPlanningAgentPolling(versionTag, _agentTaskId) {
  // Stop existing polling for this version if any
  if (planningAgentIntervals.has(versionTag)) {
    clearTimeout(planningAgentIntervals.get(versionTag));
  }
  
  // Dynamic polling interval - starts at 15s, increases if rate limited
  let pollInterval = DEFAULT_POLL_INTERVAL;
  let consecutiveErrors = 0;
  let lastKnownStatus = null; // Track last known status to detect changes
  
  const poll = async () => {
    // Check if polling was stopped
    if (!planningAgentIntervals.has(versionTag)) {
      return;
    }
    
    try {
      const agentData = await window.apiCall(`/api/versions/${versionTag}/planning-agent-status`);
      
      if (agentData.hasAgent) {
        const agent = agentData.agent;
        const currentStatus = agent.status?.toLowerCase();
        
        // Reset error counter on success
        consecutiveErrors = 0;
        pollInterval = DEFAULT_POLL_INTERVAL;
        
        // Always refresh plan stage if we're viewing it to show real-time sync status
        const currentVersionTag = getCurrentVersionTag();
        if (currentVersionTag && (currentVersionTag === versionTag || currentVersionTag === `version${versionTag}`)) {
          const stageContent = document.getElementById("stage-content");
          if (stageContent && document.querySelector(".stage-nav-btn[data-stage='plan']")?.classList.contains("active")) {
            // Use the renderer from versions-stage-renderers.js which has sync history
            if (window.renderPlanStage) {
              await window.renderPlanStage(versionTag, stageContent);
            } else {
              // Fallback: show error message if renderer not available
              stageContent.innerHTML = `<p style="color: var(--error);">Plan stage renderer not available. Please refresh the page.</p>`;
            }
          }
        }
        
        // If rate limited, increase polling interval with exponential backoff
        if (agent.rateLimited) {
          consecutiveErrors++;
          pollInterval = Math.min(DEFAULT_POLL_INTERVAL * Math.pow(2, consecutiveErrors), MAX_POLL_INTERVAL);
          console.log(`[Planning Agent] Rate limited for ${versionTag}, backing off to ${pollInterval / 1000}s interval`);
          
          // Schedule next poll with backoff
          const timeoutId = setTimeout(poll, pollInterval);
          planningAgentIntervals.set(versionTag, timeoutId);
          return;
        }
        
        // Stop polling if agent completed or failed
        // Only show notification if status changed from running to completed/failed
        if (currentStatus === "completed" || currentStatus === "failed") {
          stopPlanningAgentPolling(versionTag);
          
          // Only show notification if:
          // 1. We were tracking a running agent (lastKnownStatus was set to running/creating/processing)
          // 2. Status changed from running to completed/failed
          // 3. We haven't already notified about this agent
          const notificationKey = `${versionTag}-${agent.id || versionTag}`;
          const wasTrackingRunningAgent = lastKnownStatus !== null && 
                                         (lastKnownStatus === "running" || lastKnownStatus === "creating" || lastKnownStatus === "processing");
          const statusChanged = wasTrackingRunningAgent && lastKnownStatus !== currentStatus;
          
          // Don't notify if agent was already completed when we started polling (lastKnownStatus is null)
          if (statusChanged && !notifiedAgents.has(notificationKey)) {
            // Show notification
            if (currentStatus === "completed") {
              window.showNotification(`Planning agent completed for version ${versionTag}. Goals have been generated.`, "success");
            } else {
              window.showNotification(`Planning agent failed for version ${versionTag}: ${agent.error || "Unknown error"}`, "error");
            }
            
            // Mark as notified
            notifiedAgents.add(notificationKey);
          }
          
          // Refresh versions list
          if (window.loadVersionsV2) {
            await window.loadVersionsV2();
          }
          return;
        }
        
        // Update last known status (only if agent is still running)
        // This ensures we only track status changes for agents that were running when we started polling
        if (currentStatus === "running" || currentStatus === "creating" || currentStatus === "processing") {
          lastKnownStatus = currentStatus;
        }
      } else {
        // Agent not found, stop polling
        stopPlanningAgentPolling(versionTag);
        return;
      }
      
      // Schedule next poll
      const timeoutId = setTimeout(poll, pollInterval);
      planningAgentIntervals.set(versionTag, timeoutId);
    } catch (error) {
      console.error(`Failed to poll planning agent status for ${versionTag}:`, error);
      consecutiveErrors++;
      
      // Exponential backoff on errors
      pollInterval = Math.min(DEFAULT_POLL_INTERVAL * Math.pow(2, consecutiveErrors), MAX_POLL_INTERVAL);
      
      // If too many errors, stop polling
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn(`[Planning Agent] Too many errors for ${versionTag}, stopping polling`);
        stopPlanningAgentPolling(versionTag);
        return;
      }
      
      // Schedule next poll with backoff
      const timeoutId = setTimeout(poll, pollInterval);
      planningAgentIntervals.set(versionTag, timeoutId);
    }
  };
  
  // Start polling
  const timeoutId = setTimeout(poll, pollInterval);
  planningAgentIntervals.set(versionTag, timeoutId);
}

function stopPlanningAgentPolling(versionTag) {
  if (planningAgentIntervals.has(versionTag)) {
    clearTimeout(planningAgentIntervals.get(versionTag));
    planningAgentIntervals.delete(versionTag);
  }
}

/**
 * Refresh plan stage (reloads content and agent status)
 * Uses the enhanced renderer from versions-stage-renderers.js
 */
async function refreshPlanStage(versionTag) {
  const container = document.getElementById("stage-content");
  if (container && window.renderPlanStage) {
    await window.renderPlanStage(versionTag, container);
  } else if (container) {
    container.innerHTML = `<p style="color: var(--error);">Plan stage renderer not available. Please refresh the page.</p>`;
  }
}

/**
 * Refresh version detail view
 */
async function refreshVersionDetail(versionTag) {
  if (window.loadVersionDetail) {
    await window.loadVersionDetail(versionTag);
  } else {
    // Fallback: reload the version detail
    const cleanTag = cleanVersionTagLocal(versionTag);
    await loadVersionDetail(cleanTag);
  }
}

// Expose globally
window.loadVersionsV2 = loadVersionsV2;
// showVersionDetail is already defined above, just expose it
window.loadVersionDetail = loadVersionDetail;
window.loadVersionStages = loadVersionStages;
window.loadStageContent = loadStageContent;
window.refreshVersionDetail = refreshVersionDetail;
window.rejectVersion = rejectVersion;
window.startPlanningAgentPolling = startPlanningAgentPolling;
window.stopPlanningAgentPolling = stopPlanningAgentPolling;
window.refreshPlanStage = refreshPlanStage;
window.getCurrentVersionTag = getCurrentVersionTag; // Helper for other modules
window.attachVersionEventListeners = attachVersionEventListeners;

