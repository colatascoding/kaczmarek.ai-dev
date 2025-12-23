/**
 * Agent helper functions
 */

const path = require("path");
const fs = require("fs");

/**
 * Get agents by execution ID
 */
function getAgentsByExecutionId(cwd, executionId) {
  const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
  const agents = [];
  
  if (!fs.existsSync(queueDir)) {
    return agents;
  }
  
  const files = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    try {
      const task = JSON.parse(fs.readFileSync(path.join(queueDir, file), "utf8"));
      if (task.executionId === executionId) {
        agents.push({
          id: task.id,
          status: task.status,
          type: task.type,
          versionTag: task.versionTag,
          createdAt: task.startedAt,
          readyAt: task.readyAt,
          completedAt: task.completedAt
        });
      }
    } catch (e) {
      // Skip invalid files
    }
  }
  
  return agents;
}

module.exports = {
  getAgentsByExecutionId
};

