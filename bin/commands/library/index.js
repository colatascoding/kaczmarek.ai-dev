#!/usr/bin/env node
/**
 * Library command handler
 */

const { log, error } = require("../../utils");

function cmdLibrary(argv) {
  const subcommand = argv[0];

  switch (subcommand) {
    case "workflows":
      require("./workflows")(argv.slice(1));
      break;
    case "dashboards":
      require("./dashboards")(argv.slice(1));
      break;
    case "templates":
      require("./templates")(argv.slice(1));
      break;
    case "--help":
    case undefined:
      log(
        [
          "Library Management Commands",
          "",
          "Usage:",
          "  kad library workflows <command>  Manage workflow library",
          "  kad library dashboards <command> Manage dashboard library",
          "  kad library templates <command>  Manage template library",
          "",
          "Workflow Commands:",
          "  kad library workflows list [--category <cat>] [--subcategory <sub>]",
          "  kad library workflows show <id>",
          "  kad library workflows run <id> [options]",
          "  kad library workflows copy <id> [--to <path>]",
          "",
          "Dashboard Commands:",
          "  kad library dashboards list",
          "  kad library dashboards show <id>",
          "  kad library dashboards load <id>",
          "",
          "Template Commands:",
          "  kad library templates list",
          "  kad library templates show <id>",
          ""
        ].join("\n")
      );
      break;
    default:
      error(`Unknown library subcommand: ${subcommand}`);
      error("Use 'kad library --help' for usage information.");
      process.exitCode = 1;
  }
}

module.exports = cmdLibrary;



