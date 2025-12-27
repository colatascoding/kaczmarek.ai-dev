#!/usr/bin/env node
/**
 * Dashboard library commands
 */

const { log, error, loadConfig } = require("../../utils");
const libraryOps = require("../../../lib/library/file-operations");

function cmdLibraryDashboards(argv) {
  const subcommand = argv[0];

  switch (subcommand) {
    case "list":
      handleList(argv.slice(1));
      break;
    case "show":
      handleShow(argv.slice(1));
      break;
    case "load":
      handleLoad(argv.slice(1));
      break;
    case "--help":
    case undefined:
      log(
        [
          "Dashboard Library Commands",
          "",
          "Usage:",
          "  kad library dashboards list",
          "  kad library dashboards show <id>",
          "  kad library dashboards load <id>",
          "",
          "Examples:",
          "  kad library dashboards list",
          "  kad library dashboards show version-overview",
          "  kad library dashboards load version-overview",
          ""
        ].join("\n")
      );
      break;
    default:
      error(`Unknown command: ${subcommand}`);
      error("Use 'kad library dashboards --help' for usage information.");
      process.exitCode = 1;
  }
}

function handleList(argv) {
  const config = loadConfig(process.cwd());
  const libraryDir = config?.library?.libraryDir || "library";
  
  const items = libraryOps.listLibraryItems("dashboards", null, process.cwd(), libraryDir);
  
  if (items.length === 0) {
    log("No dashboards found in library.");
    return;
  }

  log("\nDashboards:\n");
  
  items.forEach(item => {
    const name = item.metadata?.name || item.name;
    const description = item.metadata?.description || "";
    log(`  ${item.name.padEnd(30)} ${name}${description ? ` - ${description}` : ""}`);
  });
  
  log(`\nTotal: ${items.length} dashboard(s)`);
}

function handleShow(argv) {
  if (!argv[0]) {
    error("Dashboard ID required");
    error("Usage: kad library dashboards show <id>");
    process.exitCode = 1;
    return;
  }

  const dashboardId = argv[0];
  const config = loadConfig(process.cwd());
  const libraryDir = config?.library?.libraryDir || "library";
  
  // Find dashboard
  const items = libraryOps.listLibraryItems("dashboards", null, process.cwd(), libraryDir);
  const item = items.find(i => i.name === dashboardId || i.path.includes(dashboardId));
  
  if (!item) {
    error(`Dashboard not found: ${dashboardId}`);
    process.exitCode = 1;
    return;
  }

  // Display dashboard info
  const metadata = libraryOps.readLibraryMetadata(item.path, process.cwd(), libraryDir);
  const files = libraryOps.getLibraryItemFiles(item.path, process.cwd(), libraryDir);
  
  log(`\nDashboard: ${metadata?.name || item.name}`);
  log(`ID: ${item.name}`);
  log(`Path: ${item.path}`);
  
  if (metadata) {
    if (metadata.description) {
      log(`Description: ${metadata.description}`);
    }
    if (metadata.version) {
      log(`Version: ${metadata.version}`);
    }
    if (metadata.tags && metadata.tags.length > 0) {
      log(`Tags: ${metadata.tags.join(", ")}`);
    }
  }
  
  if (files.length > 0) {
    log(`\nFiles:`);
    files.forEach(file => {
      log(`  ${file.name} (${file.size} bytes)`);
    });
  }
  
  log("");
}

function handleLoad(argv) {
  if (!argv[0]) {
    error("Dashboard ID required");
    error("Usage: kad library dashboards load <id>");
    process.exitCode = 1;
    return;
  }

  const dashboardId = argv[0];
  const config = loadConfig(process.cwd());
  const libraryDir = config?.library?.libraryDir || "library";
  
  // Find dashboard
  const items = libraryOps.listLibraryItems("dashboards", null, process.cwd(), libraryDir);
  const item = items.find(i => i.name === dashboardId || i.path.includes(dashboardId));
  
  if (!item) {
    error(`Dashboard not found: ${dashboardId}`);
    process.exitCode = 1;
    return;
  }

  log(`Loading dashboard: ${item.name}`);
  log(`Note: Dashboard loading is not yet fully implemented.`);
  log(`Dashboard path: ${item.path}`);
  log(`Use the API endpoint /api/library/${item.path} to access dashboard data.`);
}

module.exports = cmdLibraryDashboards;

