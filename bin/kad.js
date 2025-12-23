#!/usr/bin/env node

/**
 * kaczmarek.ai-dev CLI (kad)
 *
 * Main entry point for the CLI. All commands are implemented in separate modules
 * under bin/commands/ to keep files under 500 lines.
 */

const { log, error } = require("./utils");

// Import all command modules
const cmdInit = require("./commands/init");
const cmdScan = require("./commands/scan");
const cmdAi = require("./commands/ai");
const cmdProgress = require("./commands/progress");
const cmdRun = require("./commands/run");
const cmdChanges = require("./commands/changes");
const cmdTimeline = require("./commands/timeline");
const cmdRulesCheck = require("./commands/rules-check");
const cmdRulesGenerate = require("./commands/rules-generate");
const cmdOnboard = require("./commands/onboard");
const cmdWorkflow = require("./commands/workflow");
const cmdApi = require("./commands/api");
const cmdAgent = require("./commands/agent");
const cmdData = require("./commands/data");

function main() {
  const [, , cmd, ...rest] = process.argv;

  switch (cmd) {
    case "init":
      cmdInit(rest);
      return;
    case "scan":
      cmdScan();
      return;
    case "ai":
      cmdAi();
      return;
    case "progress":
      cmdProgress();
      return;
    case "run":
      cmdRun();
      return;
    case "changes":
      cmdChanges();
      return;
    case "timeline":
      cmdTimeline();
      return;
    case "rules-check":
      cmdRulesCheck();
      return;
    case "rules-generate":
      cmdRulesGenerate();
      return;
    case "onboard":
      cmdOnboard();
      return;
    case "workflow":
      cmdWorkflow(rest);
      return;
    case "api":
      cmdApi(rest);
      break;
    case "agent":
      cmdAgent(rest);
      return;
    case "data":
      cmdData(rest);
      return;
    case "-h":
    case "--help":
    case undefined:
      log(
        [
          "kaczmarek.ai-dev CLI (kad)",
          "",
          "Usage:",
          "  kad init [--force]      Create kaczmarek-ai.config.json with defaults.",
          "  kad scan                 Print JSON summary of docs/review/progress + AI folders.",
          "  kad ai                   Print a ready-to-paste prompt that includes the scan summary.",
          "  kad progress             Print prompt for maintaining current review/progress pair.",
          "  kad run                  Print prompt for implementing next goals from review.",
          "  kad changes              Print prompt for analyzing recent git changes vs review/progress.",
          "  kad timeline             Print prompt for creating/updating Mermaid timeline diagram.",
          "  kad rules-check          Check for existing Cursor rules (.cursor/rules, AGENTS.md, .cursorrules).",
          "  kad rules-generate       Launch background task to analyze codebase and interactively create rules.",
          "  kad onboard              Interactive onboarding wizard to set up your project.",
          "  kad workflow             Workflow orchestration commands (list, run, status, validate, show).",
          "  kad agent                Agent management commands (status, list, process).",
          "  kad api [start] [port]    Start web frontend API server (default port: 3000).",
          "  kad data delete [--all|--db|--agents]  Delete data files (database, agent queue, or all).",
          ""
        ].join("\n")
      );
      return;
    default:
      error(`Unknown command: ${cmd}`);
      process.exitCode = 1;
      return;
  }
}

main();
