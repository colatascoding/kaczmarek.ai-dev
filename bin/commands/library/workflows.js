#!/usr/bin/env node
/**
 * Workflow library commands
 */

const { log, error, loadConfig } = require("../../utils");
const libraryOps = require("../../../lib/library/file-operations");
const workflowDiscovery = require("../../../lib/library/workflow-discovery");
const path = require("path");
const fs = require("fs");

function cmdLibraryWorkflows(argv) {
  const subcommand = argv[0];

  switch (subcommand) {
    case "list":
      handleList(argv.slice(1));
      break;
    case "show":
      handleShow(argv.slice(1));
      break;
    case "run":
      handleRun(argv.slice(1));
      break;
    case "copy":
      handleCopy(argv.slice(1));
      break;
    case "--help":
    case undefined:
      log(
        [
          "Workflow Library Commands",
          "",
          "Usage:",
          "  kad library workflows list [--category <cat>] [--subcategory <sub>]",
          "  kad library workflows show <id>",
          "  kad library workflows run <id> [options]",
          "  kad library workflows copy <id> [--to <path>]",
          "",
          "Examples:",
          "  kad library workflows list",
          "  kad library workflows list --category implementation",
          "  kad library workflows show execute-features",
          "  kad library workflows run execute-features",
          "  kad library workflows copy execute-features --to workflows/",
          ""
        ].join("\n")
      );
      break;
    default:
      error(`Unknown command: ${subcommand}`);
      error("Use 'kad library workflows --help' for usage information.");
      process.exitCode = 1;
  }
}

function handleList(argv) {
  const config = loadConfig(process.cwd());
  const libraryDir = config?.library?.libraryDir || "library";
  
  // Parse options
  let category = null;
  let subcategory = null;
  
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--category" && argv[i + 1]) {
      category = argv[i + 1];
      i++;
    } else if (argv[i] === "--subcategory" && argv[i + 1]) {
      subcategory = argv[i + 1];
      i++;
    }
  }

  // Discover all workflows
  const workflows = workflowDiscovery.discoverWorkflows(process.cwd());
  
  // Filter by category/subcategory if specified
  let filtered = workflows;
  if (category) {
    filtered = filtered.filter(w => {
      if (!w.libraryItem) return false;
      return w.libraryItem.startsWith(`workflows/${category}`);
    });
  }
  if (subcategory) {
    filtered = filtered.filter(w => {
      if (!w.libraryItem) return false;
      return w.libraryItem.includes(`/${subcategory}/`);
    });
  }

  // Group by source
  const bySource = {
    active: [],
    "version-specific": [],
    library: []
  };

  filtered.forEach(w => {
    const source = w.source || "active";
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(w);
  });

  // Display
  log("\nWorkflows:\n");

  if (bySource.active.length > 0) {
    log("Active Workflows:");
    bySource.active.forEach(w => {
      log(`  ${w.id.padEnd(30)} ${w.name} (${w.version || "1.0.0"})`);
    });
    log("");
  }

  if (bySource["version-specific"].length > 0) {
    log("Version-Specific Workflows:");
    bySource["version-specific"].forEach(w => {
      log(`  ${w.id.padEnd(30)} ${w.name} (v${w.versionTag || "?"})`);
    });
    log("");
  }

  if (bySource.library.length > 0) {
    log("Library Workflows:");
    bySource.library.forEach(w => {
      const category = w.libraryItem ? w.libraryItem.split("/")[1] : "?";
      log(`  ${w.id.padEnd(30)} ${w.name} [${category}]`);
    });
    log("");
  }

  if (filtered.length === 0) {
    log("No workflows found.");
  } else {
    log(`Total: ${filtered.length} workflow(s)`);
  }
}

function handleShow(argv) {
  if (!argv[0]) {
    error("Workflow ID required");
    error("Usage: kad library workflows show <id>");
    process.exitCode = 1;
    return;
  }

  const workflowId = argv[0];
  const config = loadConfig(process.cwd());
  
  // Get workflow
  const workflow = workflowDiscovery.getWorkflowById(workflowId, process.cwd());
  
  if (!workflow) {
    error(`Workflow not found: ${workflowId}`);
    process.exitCode = 1;
    return;
  }

  // Display workflow info
  log(`\nWorkflow: ${workflow.name || workflowId}`);
  log(`ID: ${workflow.id}`);
  log(`Version: ${workflow.version || "1.0.0"}`);
  log(`Source: ${workflow.source}`);
  log(`Path: ${workflow.sourcePath}`);
  
  if (workflow.description) {
    log(`Description: ${workflow.description}`);
  }
  
  if (workflow.versionTag) {
    log(`Version Tag: ${workflow.versionTag}`);
  }
  
  if (workflow.libraryItem) {
    log(`Library Item: ${workflow.libraryItem}`);
    
    // Load metadata
    const libraryDir = config?.library?.libraryDir || "library";
    const metadata = libraryOps.readLibraryMetadata(workflow.libraryItem, process.cwd(), libraryDir);
    if (metadata) {
      log(`Category: ${metadata.category || "?"}`);
      if (metadata.tags && metadata.tags.length > 0) {
        log(`Tags: ${metadata.tags.join(", ")}`);
      }
    }
  }
  
  log("");
}

function handleRun(argv) {
  if (!argv[0]) {
    error("Workflow ID required");
    error("Usage: kad library workflows run <id> [options]");
    process.exitCode = 1;
    return;
  }

  const workflowId = argv[0];
  
  // Delegate to workflow run command
  const workflowRun = require("../workflow/run");
  workflowRun([workflowId, ...argv.slice(1)]);
}

function handleCopy(argv) {
  if (!argv[0]) {
    error("Workflow ID required");
    error("Usage: kad library workflows copy <id> [--to <path>]");
    process.exitCode = 1;
    return;
  }

  const workflowId = argv[0];
  const config = loadConfig(process.cwd());
  const libraryDir = config?.library?.libraryDir || "library";
  const workflowsDir = config?.workflows?.activeDir || "workflows";
  
  // Parse options
  let targetPath = null;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--to" && argv[i + 1]) {
      targetPath = argv[i + 1];
      i++;
    }
  }

  // Get workflow
  const workflow = workflowDiscovery.getWorkflowById(workflowId, process.cwd());
  
  if (!workflow) {
    error(`Workflow not found: ${workflowId}`);
    process.exitCode = 1;
    return;
  }

  // Determine target path
  if (!targetPath) {
    targetPath = path.join(workflowsDir, `${workflowId}.yaml`);
  }

  // Copy workflow file
  try {
    const targetFullPath = path.resolve(process.cwd(), targetPath);
    const targetDir = path.dirname(targetFullPath);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(workflow.sourcePath, targetFullPath);
    log(`Copied workflow to: ${targetFullPath}`);
  } catch (e) {
    error(`Failed to copy workflow: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = cmdLibraryWorkflows;

