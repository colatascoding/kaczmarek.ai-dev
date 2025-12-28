/**
 * kad workflow status - Check workflow execution status
 */

const { log, error } = require("../../utils");

function cmdWorkflowStatus(argv) {
  if (argv.length === 0) {
    error("Execution ID required. Usage: kad workflow status <execution-id>");
    process.exitCode = 1;
    return;
  }

  const executionId = argv[0];

  try {
    const WorkflowEngine = require("../../../lib/workflow/engine");
    const engine = new WorkflowEngine();
    const status = engine.getExecutionStatus(executionId);
    engine.close();

    if (!status) {
      error(`Execution not found: ${executionId}`);
      process.exitCode = 1;
      return;
    }

    log(`Execution: ${executionId}`);
    log(`Workflow: ${status.workflow_id}`);
    log(`Status: ${status.status}`);
    log(`Started: ${status.started_at}`);
    if (status.completed_at) {
      log(`Completed: ${status.completed_at}`);
    }
    if (status.current_step) {
      log(`Current Step: ${status.current_step}`);
    }
    if (status.error) {
      log(`Error: ${status.error}`);
    }
    log("");

    if (status.stepExecutions && status.stepExecutions.length > 0) {
      log("Step Executions:");
      status.stepExecutions.forEach((step) => {
        log(`  ${step.step_id} (${step.module}.${step.action}): ${step.status}`);
        if (step.error) {
          log(`    Error: ${step.error}`);
        }
      });
    }
  } catch (e) {
    error(`Failed to get status: ${String(e)}`);
    process.exitCode = 1;
  }
}

module.exports = cmdWorkflowStatus;


