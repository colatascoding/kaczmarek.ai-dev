/**
 * kad agent list - List all agent tasks
 */

const fs = require("fs");
const path = require("path");
const { log } = require("../../utils");

function cmdAgentList() {
  const queueDir = path.join(process.cwd(), ".kaczmarek-ai", "agent-queue");
  if (!fs.existsSync(queueDir)) {
    log("No agent tasks found.");
    return;
  }

  const files = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    log("No agent tasks found.");
    return;
  }

  log(`Found ${files.length} agent task(s):\n`);
  files.forEach(file => {
    const taskFile = path.join(queueDir, file);
    try {
      const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));
      const statusIcon = task.status === "ready" ? "✓" : task.status === "failed" ? "✗" : task.status === "processing" ? "⟳" : "○";
      log(`  ${statusIcon} ${task.id} - ${task.status} (${task.type}) - ${task.tasks?.length || 0} tasks`);
      if (task.error) {
        log(`      Error: ${task.error.substring(0, 100)}${task.error.length > 100 ? "..." : ""}`);
      }
    } catch (e) {
      log(`  ${file} - (error reading file: ${e.message})`);
    }
  });
}

module.exports = cmdAgentList;



