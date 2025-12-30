/**
 * kad workflow command - Workflow orchestration commands
 */

const { log, error } = require("../../utils");
const cmdWorkflowList = require("./list");
const cmdWorkflowRun = require("./run");
const cmdWorkflowStatus = require("./status");
const cmdWorkflowValidate = require("./validate");
const cmdWorkflowShow = require("./show");

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

module.exports = cmdWorkflow;



