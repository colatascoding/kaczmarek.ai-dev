/**
 * kad agent command - Agent management commands
 */

const { log, error } = require("../../utils");
const cmdAgentStatus = require("./status");
const cmdAgentList = require("./list");
const cmdAgentDebug = require("./debug");
const cmdAgentProcess = require("./process");
const cmdAgentStart = require("./start");
const cmdAgentStop = require("./stop");
const cmdAgentComplete = require("./complete");

function cmdAgent(argv) {
  const [subcmd, ...rest] = argv;

  if (!subcmd) {
    log(
      [
        "Agent commands:",
        "",
        "  kad agent status <task-id>    Check status of an agent task",
        "  kad agent list               List all agent tasks",
        "  kad agent debug <task-id>    Debug a task (show details, errors, history)",
        "  kad agent process <task-id>  Process an agent task",
        "  kad agent complete <task-id> Mark task as complete and update progress/review",
        "  kad agent start              Start background processor",
        "  kad agent stop               Stop background processor",
        ""
      ].join("\n")
    );
    return;
  }

  switch (subcmd) {
    case "status":
      cmdAgentStatus(rest);
      return;
    case "list":
      cmdAgentList();
      return;
    case "debug":
      cmdAgentDebug(rest);
      return;
    case "process":
      cmdAgentProcess(rest);
      return;
    case "start":
      cmdAgentStart();
      return;
    case "stop":
      cmdAgentStop();
      return;
    case "complete":
      cmdAgentComplete(rest);
      return;
    default:
      error(`Unknown agent command: ${subcmd}`);
      process.exitCode = 1;
      return;
  }
}

module.exports = cmdAgent;


