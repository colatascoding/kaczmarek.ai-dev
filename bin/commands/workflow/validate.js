/**
 * kad workflow validate - Validate a workflow file
 */

const path = require("path");
const { log, error } = require("../../utils");

function cmdWorkflowValidate(argv) {
  if (argv.length === 0) {
    error("Workflow file required. Usage: kad workflow validate <file>");
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(process.cwd(), argv[0]);

  try {
    const WorkflowEngine = require("../../../lib/workflow/engine");
    const engine = new WorkflowEngine();
    const workflow = engine.loadWorkflow(filePath);
    const validation = engine.validateWorkflow(workflow);
    engine.close();

    if (validation.valid) {
      log(`✓ Workflow is valid: ${workflow.name}`);
      log(`  Steps: ${workflow.steps.length}`);
    } else {
      error(`✗ Workflow validation failed:`);
      validation.errors.forEach((err) => {
        error(`  - ${err}`);
      });
      process.exitCode = 1;
    }
  } catch (e) {
    error(`Failed to validate workflow: ${String(e)}`);
    process.exitCode = 1;
  }
}

module.exports = cmdWorkflowValidate;

