/**
 * kad workflow list - List all available workflows
 */

const { log, error } = require("../../utils");

function cmdWorkflowList() {
  try {
    const WorkflowEngine = require("../../../lib/workflow/engine");
    const engine = new WorkflowEngine();
    const workflows = engine.listWorkflows();
    engine.close();

    if (workflows.length === 0) {
      log("No workflows found. Create workflows in the 'workflows/' directory.");
      return;
    }

    log("Available workflows:");
    log("");
    workflows.forEach((wf) => {
      log(`  ${wf.id}`);
      log(`    Name: ${wf.name}`);
      log(`    Version: ${wf.version}`);
      if (wf.description) {
        log(`    Description: ${wf.description}`);
      }
      log(`    Path: ${wf.filePath}`);
      log("");
    });
  } catch (e) {
    error(`Failed to list workflows: ${String(e)}`);
    process.exitCode = 1;
  }
}

module.exports = cmdWorkflowList;

