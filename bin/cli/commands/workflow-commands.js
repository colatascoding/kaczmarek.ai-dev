/**
 * Workflow management commands
 */

const path = require("path");
const { log, error } = require("../utils");

function cmdWorkflow(argv) {
  const [subcommand, ...rest] = argv;

  if (!subcommand) {
    error("Workflow subcommand required. Use 'kad workflow --help' for usage.");
    process.exitCode = 1;
    return;
  }

  switch (subcommand) {
    case "list":
      cmdWorkflowList();
      return;
    case "run":
      cmdWorkflowRun(rest);
      return;
    case "status":
      cmdWorkflowStatus(rest);
      return;
    case "validate":
      cmdWorkflowValidate(rest);
      return;
    case "show":
      cmdWorkflowShow(rest);
      return;
    case "--help":
    case "-h":
      log(
        [
          "Workflow commands:",
          "",
          "  kad workflow list                    List all available workflows",
          "  kad workflow run <name> [--params]   Run a workflow",
          "  kad workflow status <execution-id>   Check workflow execution status",
          "  kad workflow validate <file>         Validate a workflow file",
          "  kad workflow show <name>             Show workflow details",
          ""
        ].join("\n")
      );
      return;
    default:
      error(`Unknown workflow subcommand: ${subcommand}`);
      error("Use 'kad workflow --help' for usage.");
      process.exitCode = 1;
      return;
  }
}

function cmdWorkflowList() {
  try {
    const WorkflowEngine = require("../../lib/workflow/engine");
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

function cmdWorkflowRun(argv) {
  if (argv.length === 0) {
    error("Workflow name required. Usage: kad workflow run <workflow-name>");
    process.exitCode = 1;
    return;
  }

  const workflowName = argv[0];
  const params = {};

  for (let i = 1; i < argv.length; i += 2) {
    if (argv[i] && argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      let value = argv[i + 1] || "";
      
      if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
        value = parseFloat(value);
      }
      
      params[key] = value;
    }
  }

  try {
    const WorkflowEngine = require("../../lib/workflow/engine");
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

function cmdWorkflowStatus(argv) {
  if (argv.length === 0) {
    error("Execution ID required. Usage: kad workflow status <execution-id>");
    process.exitCode = 1;
    return;
  }

  const executionId = argv[0];

  try {
    const WorkflowEngine = require("../../lib/workflow/engine");
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

function cmdWorkflowValidate(argv) {
  if (argv.length === 0) {
    error("Workflow file required. Usage: kad workflow validate <file>");
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(process.cwd(), argv[0]);

  try {
    const WorkflowEngine = require("../../lib/workflow/engine");
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

function cmdWorkflowShow(argv) {
  if (argv.length === 0) {
    error("Workflow name required. Usage: kad workflow show <workflow-name>");
    process.exitCode = 1;
    return;
  }

  const workflowName = argv[0];

  try {
    const WorkflowEngine = require("../../lib/workflow/engine");
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

module.exports = {
  cmdWorkflow
};

