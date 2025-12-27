/**
 * kaczmarek.ai-dev V2 Application
 * Redesigned with stage-based navigation
 */

// State
let currentView = "home";
let currentVersion = null;
let currentStage = null;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  loadHome();
});

/**
 * Setup navigation
 */
function setupNavigation() {
  document.querySelectorAll(".nav-btn-v2").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

/**
 * Switch view
 */
async function switchView(viewName) {
  currentView = viewName;
  
  // Hide all views
  document.querySelectorAll(".view-v2").forEach(view => {
    view.classList.remove("active");
  });
  
  // Show selected view
  const view = document.getElementById(`${viewName}-view`);
  if (view) {
    view.classList.add("active");
  }
  
  // Update nav buttons
  document.querySelectorAll(".nav-btn-v2").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  
  // Load view-specific data
  switch (viewName) {
    case "home":
      await loadHome();
      // Check for pending decisions on home view
      if (window.checkAndDisplayDecisions) {
        await window.checkAndDisplayDecisions();
      }
      break;
    case "versions":
      if (window.loadVersionsV2) await window.loadVersionsV2();
      break;
    case "workflows":
      if (window.loadWorkflowsV2) await window.loadWorkflowsV2();
      break;
    case "library":
      if (window.loadLibraryV2) await window.loadLibraryV2();
      break;
    case "executions":
      if (window.loadExecutionsV2) await window.loadExecutionsV2();
      break;
  }
}

/**
 * Show version detail
 */
function showVersionDetail(versionTag) {
  // Remove "version" prefix if present
  const cleanTag = versionTag.replace(/^version/, "");
  currentVersion = cleanTag;
  switchView("version-detail");
  if (window.loadVersionDetail) {
    window.loadVersionDetail(cleanTag);
  }
}

/**
 * Show stage
 */
function showStage(stage) {
  currentStage = stage;
  
  // Update stage nav buttons
  document.querySelectorAll(".stage-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.stage === stage);
  });
  
  // Load stage content
  if (window.loadStageContent) {
    window.loadStageContent(currentVersion, stage);
  }
}

/**
 * Refresh home
 */
function refreshHome() {
  loadHome();
}

/**
 * Load home view (delegates to home.js)
 * Note: We use a different name to avoid circular reference
 */
async function loadHome() {
  // Use the home.js implementation if available, otherwise use fallback
  if (window.loadHomeView) {
    await window.loadHomeView();
  } else {
    // Fallback implementation
    try {
      const versionsData = await window.apiCall("/api/versions");
      const versions = versionsData.versions || [];
      
      if (versions.length > 0) {
        const current = versions[0];
        currentVersion = current.tag;
      }
      
      // Check for pending decisions
      if (window.checkAndDisplayDecisions) {
        await window.checkAndDisplayDecisions();
      }
    } catch (error) {
      console.error("Failed to load home:", error);
    }
  }
}

/**
 * Render current version card
 */
async function renderCurrentVersion(version) {
  const card = document.getElementById("current-version-card");
  const title = document.getElementById("current-version-title");
  const status = document.getElementById("current-version-status");
  
  title.textContent = `Version ${version.tag}`;
  status.textContent = version.status || "Unknown";
  status.className = `status-badge ${(version.status || "pending").toLowerCase().replace(/\s+/g, "-")}`;
  
  // Load stage statuses
  if (window.loadVersionStages) {
    const stages = await window.loadVersionStages(version.tag);
    renderStageProgress(stages);
  }
}

/**
 * Render stage progress
 */
function renderStageProgress(stages) {
  const stagesMap = {
    plan: stages.find(s => s.name === "01_plan" || s.name === "plan"),
    implement: stages.find(s => s.name === "02_implement" || s.name === "implement"),
    test: stages.find(s => s.name === "03_test" || s.name === "test"),
    review: stages.find(s => s.name === "04_review" || s.name === "review")
  };
  
  ["plan", "implement", "test", "review"].forEach(stageName => {
    const stage = stagesMap[stageName];
    const item = document.querySelector(`.stage-item[data-stage="${stageName}"]`);
    
    if (item && stage) {
      item.className = `stage-item ${stage.status || "pending"}`;
    }
  });
}

/**
 * Render no version state
 */
function renderNoVersion() {
  const card = document.getElementById("current-version-card");
  card.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <h3 style="margin-bottom: 1rem;">No Version Found</h3>
      <p style="color: var(--text-light); margin-bottom: 1.5rem;">Create your first version to get started</p>
      <button class="btn btn-primary" onclick="openVersionCreationWizard()">Create Version</button>
    </div>
  `;
}

/**
 * Load recent activity
 */
async function loadRecentActivity() {
  try {
    const [executions, agents] = await Promise.all([
      window.apiCall("/api/executions").catch(() => ({ executions: [] })),
      window.apiCall("/api/agents").catch(() => ({ agents: [] }))
    ]);
    
    const activities = [];
    
    // Add recent executions
    (executions.executions || []).slice(0, 3).forEach(exec => {
      activities.push({
        type: "execution",
        icon: "⚡",
        text: `Workflow "${exec.workflowId}" ${exec.status}`,
        time: exec.startedAt
      });
    });
    
    // Add recent agents
    (agents.agents || []).filter(a => a.status !== "completed").slice(0, 2).forEach(agent => {
      activities.push({
        type: "agent",
        icon: "🤖",
        text: `Agent "${agent.name}" ${agent.status}`,
        time: agent.createdAt
      });
    });
    
    // Sort by time and render
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    renderActivityList(activities.slice(0, 5));
  } catch (error) {
    console.error("Failed to load activity:", error);
  }
}

/**
 * Render activity list
 */
function renderActivityList(activities) {
  const container = document.getElementById("recent-activity");
  
  if (activities.length === 0) {
    container.innerHTML = `<p style="color: var(--text-light); text-align: center; padding: 2rem;">No recent activity</p>`;
    return;
  }
  
  container.innerHTML = activities.map(activity => `
    <div class="activity-item-v2">
      <span class="activity-icon">${activity.icon}</span>
      <div class="activity-content">${activity.text}</div>
      <div class="activity-time">${window.formatDateForDisplay ? window.formatDateForDisplay(activity.time) : activity.time}</div>
    </div>
  `).join("");
}

/**
 * Switch library tab
 */
function switchLibraryTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  
  if (window.loadLibraryTab) {
    window.loadLibraryTab(tab);
  }
}

// Expose globally
window.switchView = switchView;
window.showVersionDetail = showVersionDetail;
window.showStage = showStage;
window.refreshHome = refreshHome;
window.switchLibraryTab = switchLibraryTab;
window.currentVersion = currentVersion;

