/**
 * kaczmarek.ai-dev Frontend Application
 * Main entry point and navigation
 */

// State
let currentView = "dashboard";
window.currentView = currentView; // Expose globally

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  // Wait a bit for all scripts to load, then load dashboard
  setTimeout(() => {
    if (window.loadDashboard) {
      window.loadDashboard();
    } else {
      console.warn("loadDashboard not available yet, retrying...");
      setTimeout(() => {
        if (window.loadDashboard) {
          window.loadDashboard();
        } else {
          console.error("loadDashboard still not available after retry");
        }
      }, 100);
    }
  }, 0);
});

/**
 * Setup navigation
 */
function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

/**
 * Switch view
 */
function switchView(view) {
  currentView = view;
  window.currentView = view;
  
  // Update nav
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  
  // Update views
  document.querySelectorAll(".view").forEach(v => {
    // Handle special case for dashboard-content view
    if (view === "dashboard-content") {
      v.classList.toggle("active", v.id === "dashboard-content-view");
    } else {
      v.classList.toggle("active", v.id === `${view}-view`);
    }
  });
  
  // Load view data
  switch (view) {
    case "dashboard":
      if (window.loadDashboard) window.loadDashboard();
      break;
    case "dashboards":
      if (window.loadDashboards) window.loadDashboards();
      break;
    case "dashboard-content":
      // Dashboard content is loaded via loadDashboard() function
      break;
    case "workflows":
      if (window.loadWorkflows) window.loadWorkflows();
      break;
    case "agents":
      if (window.loadAgents) window.loadAgents();
      break;
    case "executions":
      if (window.loadExecutions) window.loadExecutions();
      break;
    case "versions":
      if (window.loadVersions) window.loadVersions();
      break;
  }
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById("modal").classList.remove("active");
}

/**
 * Show execution summary in modal
 */
async function showExecutionSummary(executionId) {
  try {
    const data = await window.apiCall(`/api/executions/${executionId}`);
    const exec = data.execution;
    
    if (!exec.summary) {
      window.showNotification("No summary available for this execution.", "info");
      return;
    }
    
    const modalBody = document.getElementById("modal-body");
    modalBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">Execution Summary: ${exec.executionId}</h2>
        <button class="btn btn-primary" onclick="copyTextToClipboard(\`${exec.summary.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">📋 Copy</button>
      </div>
      <pre style="max-height: 70vh; overflow-y: auto; padding: 1rem; background: var(--bg); border-radius: 0.5rem; white-space: pre-wrap; word-wrap: break-word;">${exec.summary}</pre>
    `;
    
    document.getElementById("modal").classList.add("active");
  } catch (error) {
    console.error("Failed to load execution summary:", error);
    window.showNotification(`Failed to load summary: ${error.message}`, "error");
  }
}

/**
 * Copy text to clipboard
 */
async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    window.showNotification("Copied to clipboard!", "success");
  } catch (error) {
    console.error("Failed to copy:", error);
    window.showNotification(`Failed to copy: ${error.message}`, "error");
  }
}

// Expose globally
window.switchView = switchView;
window.currentView = currentView;
window.closeModal = closeModal;
window.showExecutionSummary = showExecutionSummary;
window.copyTextToClipboard = copyTextToClipboard;
