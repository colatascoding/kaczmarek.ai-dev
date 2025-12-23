/**
 * kad workflow run - Run a workflow
 */

const { log, error } = require("../../utils");

function cmdWorkflowRun(argv) {
  if (argv.length === 0) {
    error("Workflow name required. Usage: kad workflow run <workflow-name>");
    process.exitCode = 1;
    return;
  }

  const workflowName = argv[0];
  const params = {};

  // Parse --key value params
  for (let i = 1; i < argv.length; i += 2) {
    if (argv[i] && argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      let value = argv[i + 1] || "";
      
      // Try to parse as number if it looks like a number
      if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
        value = parseFloat(value);
      }
      
      params[key] = value;
    }
  }

  try {
    const WorkflowEngine = require("../../../lib/workflow/engine");
    const engine = new WorkflowEngine();

    log(`Running workflow: ${workflowName}`);
    if (Object.keys(params).length > 0) {
      log(`Parameters: ${JSON.stringify(params, null, 2)}`);
    }
    log("");

    engine
      .execute(workflowName, params)
      .then((result) => {
        log(`Workflow execution started: ${result.id}`);
        log(`Status: ${result.status}`);
        log("");
        log(`Check status with: kad workflow status ${result.id}`);
        engine.close();
      })
      .catch((err) => {
        error(`Workflow execution failed: ${String(err)}`);
        engine.close();
        process.exitCode = 1;
      });
  } catch (e) {
    error(`Failed to run workflow: ${String(e)}`);
    process.exitCode = 1;
  }
}

module.exports = cmdWorkflowRun;

