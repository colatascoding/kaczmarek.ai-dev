/**
 * kad workflow show - Show workflow details
 */

const { log, error } = require("../../utils");

function cmdWorkflowShow(argv) {
  if (argv.length === 0) {
    error("Workflow name required. Usage: kad workflow show <workflow-name>");
    process.exitCode = 1;
    return;
  }

  const workflowName = argv[0];

  try {
    const WorkflowEngine = require("../../../lib/workflow/engine");
    const engine = new WorkflowEngine();
    const workflow = engine.getWorkflowById(workflowName);
    engine.close();

    if (!workflow) {
      error(`Workflow not found: ${workflowName}`);
      process.exitCode = 1;
      return;
    }

    log(`Workflow: ${workflow.name}`);
    log(`Version: ${workflow.version || "1.0.0"}`);
    if (workflow.description) {
      log(`Description: ${workflow.description}`);
    }
    log("");
    log("Steps:");
    workflow.steps.forEach((step, index) => {
      log(`  ${index + 1}. ${step.id}`);
      log(`     Module: ${step.module}`);
      log(`     Action: ${step.action}`);
      if (step.onSuccess) {
        log(`     On Success: ${typeof step.onSuccess === "string" ? step.onSuccess : step.onSuccess.then}`);
      }
      if (step.onFailure) {
        log(`     On Failure: ${step.onFailure}`);
      }
    });
  } catch (e) {
    error(`Failed to show workflow: ${String(e)}`);
    process.exitCode = 1;
  }
}

module.exports = cmdWorkflowShow;



