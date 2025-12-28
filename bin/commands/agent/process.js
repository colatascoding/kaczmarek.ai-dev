/**
 * kad agent process - Process an agent task
 */

const path = require("path");
const { log, error } = require("../../utils");

function cmdAgentProcess(rest) {
  const taskId = rest[0];
  if (!taskId) {
    error("Task ID required. Usage: kad agent process <task-id>");
    process.exitCode = 1;
    return;
  }

  const WorkflowEngine = require("../../../lib/workflow/engine");
  const engine = new WorkflowEngine();
  const ModuleLoader = require("../../../lib/modules/module-loader");
  const loader = new ModuleLoader(path.join(__dirname, "..", "..", "..", "lib", "modules"));

  const action = loader.getAction("agent", "process-task");
  action({ taskId, cwd: process.cwd() }, {
    logger: { info: log, error, warn: log },
    executionId: taskId
  }).then(result => {
    if (result.success) {
      log(`Task ${taskId} is now being processed.`);
      log(result.message || "");
    } else {
      error(result.error || "Failed to process task");
      process.exitCode = 1;
    }
    engine.close();
  }).catch(e => {
    error(`Failed to process agent task: ${String(e)}`);
    engine.close();
    process.exitCode = 1;
  });
}

module.exports = cmdAgentProcess;


