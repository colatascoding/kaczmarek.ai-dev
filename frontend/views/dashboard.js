/**
 * Dashboard view module
 */

// Import utilities (available globally)
const { apiCall, formatDateForDisplay } = window;

/**
 * Load dashboard
 */
async function loadDashboard() {
  try {
    // Load stats
    const [workflows, agents, executions, versions] = await Promise.all([
      apiCall("/api/workflows"),
      apiCall("/api/agents"),
      apiCall("/api/executions"),
      apiCall("/api/versions")
    ]);
    
    // Update stats
    document.getElementById("workflow-count").textContent = workflows.workflows?.length || 0;
    document.getElementById("agent-count").textContent = agents.agents?.filter(a => a.status !== "completed").length || 0;
    document.getElementById("execution-count").textContent = executions.executions?.length || 0;
    document.getElementById("version-count").textContent = versions.versions?.length || 0;
    
    // Recent executions
    const recentExecutions = executions.executions
      ?.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, 5) || [];
    
    if (window.renderExecutions) {
      window.renderExecutions(recentExecutions, "recent-executions");
    }
    
    // Active agents
    const activeAgents = agents.agents
      ?.filter(a => a.status !== "completed")
      .slice(0, 5) || [];
    
    if (window.renderAgents) {
      window.renderAgents(activeAgents, "active-agents");
    }
    
    // Latest version
    const latestVersion = versions.versions?.[0];
    if (latestVersion && window.renderVersionSummary) {
      window.renderVersionSummary(latestVersion, "latest-version");
    }
  } catch (error) {
    console.error("Failed to load dashboard:", error);
  }
}

// Expose globally
window.loadDashboard = loadDashboard;

