/**
 * Dashboard widget renderer
 * Renders dashboard widgets with data
 */

const fs = require("fs");
const path = require("path");
const workflowDiscovery = require("../library/workflow-discovery");
const versionOps = require("../versions/file-operations");
const stageOps = require("../versions/stage-management");
const { loadConfig } = require("../../bin/utils");

/**
 * Render dashboard widget
 * @param {object} widget - Widget definition
 * @param {object} context - Rendering context (server, cwd, etc.)
 * @returns {object} - Rendered widget data
 */
async function renderWidget(widget, context) {
  const { server, cwd = process.cwd() } = context;
  
  switch (widget.type) {
    case "workflow-list":
      return await renderWorkflowListWidget(widget, context);
    case "version-status":
      return await renderVersionStatusWidget(widget, context);
    case "execution-summary":
      return await renderExecutionSummaryWidget(widget, context);
    case "agent-status":
      return await renderAgentStatusWidget(widget, context);
    case "stage-progress":
      return await renderStageProgressWidget(widget, context);
    case "metric":
      return await renderMetricWidget(widget, context);
    case "chart":
      return await renderChartWidget(widget, context);
    default:
      return {
        error: `Unknown widget type: ${widget.type}`
      };
  }
}

/**
 * Render workflow list widget
 */
async function renderWorkflowListWidget(widget, context) {
  const { server } = context;
  const options = widget.options || {};
  
  // Get workflows using discovery
  const workflows = server.engine.workflowManager.listWorkflows({
    versionTag: options.versionTag || null
  });
  
  // Filter by source if specified
  let filtered = workflows;
  if (options.source) {
    filtered = filtered.filter(w => w.source === options.source);
  }
  
  // Filter by category if specified
  if (options.category && options.source === "library") {
    filtered = filtered.filter(w => {
      if (!w.libraryItem) return false;
      return w.libraryItem.includes(`/${options.category}/`);
    });
  }
  
  // Limit results
  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }
  
  return {
    type: "workflow-list",
    data: filtered,
    count: filtered.length,
    total: workflows.length
  };
}

/**
 * Render version status widget
 */
async function renderVersionStatusWidget(widget, context) {
  const { cwd = process.cwd() } = context;
  const config = loadConfig(cwd);
  const versionsDir = config?.docs?.versionsDir || "versions";
  const options = widget.options || {};
  
  // Get current version
  const fileOpsV2 = require("../modules/review/file-operations-v2");
  const currentVersion = await fileOpsV2.findCurrentVersion({ cwd, versionsDir }, { logger: console });
  
  if (!currentVersion.found) {
    return {
      type: "version-status",
      error: "No version found"
    };
  }
  
  const versionTag = currentVersion.versionTag;
  const metadata = versionOps.readVersionMetadata(versionTag, cwd, versionsDir);
  const stages = stageOps.getVersionStages(versionTag, cwd, versionsDir);
  
  return {
    type: "version-status",
    version: {
      tag: versionTag,
      metadata: metadata || {},
      stages: stages
    }
  };
}

/**
 * Render execution summary widget
 */
async function renderExecutionSummaryWidget(widget, context) {
  const { server } = context;
  const options = widget.options || {};
  
  // Get recent executions
  let executions = server.db.listExecutions(
    options.limit || 10,
    options.status || null,
    options.versionTag || null
  ) || [];
  
  // Sort by started date (newest first)
  executions.sort((a, b) => {
    const aTime = new Date(a.startedAt || 0).getTime();
    const bTime = new Date(b.startedAt || 0).getTime();
    return bTime - aTime;
  });
  
  return {
    type: "execution-summary",
    data: executions,
    count: executions.length
  };
}

/**
 * Render agent status widget
 */
async function renderAgentStatusWidget(widget, context) {
  const { cwd = process.cwd() } = context;
  const options = widget.options || {};
  
  const agents = [];
  const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
  
  if (fs.existsSync(queueDir)) {
    const fs = require("fs");
    const path = require("path");
    const files = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
    
    for (const file of files) {
      try {
        const task = JSON.parse(fs.readFileSync(path.join(queueDir, file), "utf8"));
        
        // Filter by status if specified
        if (options.status && task.status !== options.status) {
          continue;
        }
        
        // Filter by version if specified
        if (options.versionTag && task.versionTag !== options.versionTag) {
          continue;
        }
        
        agents.push(task);
      } catch (e) {
        // Skip invalid files
      }
    }
  }
  
  // Group by status
  const byStatus = {};
  agents.forEach(agent => {
    const status = agent.status || "unknown";
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(agent);
  });
  
  return {
    type: "agent-status",
    data: agents,
    byStatus: byStatus,
    count: agents.length
  };
}

/**
 * Render stage progress widget
 */
async function renderStageProgressWidget(widget, context) {
  const { cwd = process.cwd() } = context;
  const config = loadConfig(cwd);
  const versionsDir = config?.docs?.versionsDir || "versions";
  const options = widget.options || {};
  
  const versionTag = options.versionTag;
  if (!versionTag) {
    return {
      type: "stage-progress",
      error: "Version tag required"
    };
  }
  
  const stages = stageOps.getVersionStages(versionTag, cwd, versionsDir);
  
  return {
    type: "stage-progress",
    version: versionTag,
    stages: stages
  };
}

/**
 * Render metric widget
 */
async function renderMetricWidget(widget, context) {
  const { server } = context;
  const options = widget.options || {};
  const metricType = options.metric || "count";
  
  let value = 0;
  let label = options.label || "Metric";
  
  switch (metricType) {
    case "workflow-count":
      value = server.engine.workflowManager.listWorkflows().length;
      label = "Total Workflows";
      break;
    case "execution-count":
      value = (server.db.listExecutions() || []).length;
      label = "Total Executions";
      break;
    case "agent-count":
      const fs = require("fs");
      const path = require("path");
      const queueDir = path.join(context.cwd || process.cwd(), ".kaczmarek-ai", "agent-queue");
      if (fs.existsSync(queueDir)) {
        value = fs.readdirSync(queueDir).filter(f => f.endsWith(".json")).length;
      }
      label = "Active Agents";
      break;
    case "version-count":
      const config = loadConfig(context.cwd || process.cwd());
      const versionsDir = config?.docs?.versionsDir || "versions";
      const versionsPath = path.join(context.cwd || process.cwd(), versionsDir);
      if (fs.existsSync(versionsPath)) {
        // Count all version folders
        let count = 0;
        const majorDirs = fs.readdirSync(versionsPath, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && entry.name.startsWith("v"));
        for (const majorDir of majorDirs) {
          const versionDirs = fs.readdirSync(path.join(versionsPath, majorDir.name), { withFileTypes: true })
            .filter(entry => entry.isDirectory() && entry.name.match(/^\d+-\d+$/));
          count += versionDirs.length;
        }
        value = count;
      }
      label = "Versions";
      break;
    default:
      value = 0;
  }
  
  return {
    type: "metric",
    value: value,
    label: label,
    format: options.format || "number"
  };
}

/**
 * Render chart widget (placeholder)
 */
async function renderChartWidget(widget, context) {
  // Chart rendering would require additional data processing
  // For now, return placeholder
  return {
    type: "chart",
    chartType: widget.options?.chartType || "bar",
    data: [],
    message: "Chart rendering not yet implemented"
  };
}

module.exports = {
  renderWidget,
  renderWorkflowListWidget,
  renderVersionStatusWidget,
  renderExecutionSummaryWidget,
  renderAgentStatusWidget,
  renderStageProgressWidget,
  renderMetricWidget,
  renderChartWidget
};

