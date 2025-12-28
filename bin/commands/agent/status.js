/**
 * kad agent status - Check status of an agent task
 */

const path = require("path");
const { log, error } = require("../../utils");

function cmdAgentStatus(rest) {
  const taskId = rest[0];
  if (!taskId) {
    error("Task ID required. Usage: kad agent status <task-id>");
    process.exitCode = 1;
    return;
  }

  const WorkflowEngine = require("../../../lib/workflow/engine");
  const engine = new WorkflowEngine();
  const ModuleLoader = require("../../../lib/modules/module-loader");
  const loader = new ModuleLoader(path.join(__dirname, "..", "..", "..", "lib", "modules"));

  const action = loader.getAction("agent", "check-status");
  action({ taskId, cwd: process.cwd() }, {
    logger: { info: log, error, warn: log },
    executionId: taskId
  }).then(result => {
    if (result.success) {
      log(`Agent Task: ${result.task.id}`);
      log(`Status: ${result.task.status}`);
      log(`Type: ${result.task.type}`);
      log(`Tasks: ${result.task.tasksCount}`);
      if (result.task.startedAt) {
        log(`Started: ${result.task.startedAt}`);
      }
      if (result.task.completedAt) {
        log(`Completed: ${result.task.completedAt}`);
      }
    } else {
      error(result.error || "Failed to check status");
      process.exitCode = 1;
    }
    engine.close();
  }).catch(e => {
    error(`Failed to check agent status: ${String(e)}`);
    engine.close();
    process.exitCode = 1;
  });
}

module.exports = cmdAgentStatus;


