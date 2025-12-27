#!/usr/bin/env node
/**
 * Template library commands
 */

const { log, error, loadConfig } = require("../../utils");
const libraryOps = require("../../../lib/library/file-operations");

function cmdLibraryTemplates(argv) {
  const subcommand = argv[0];

  switch (subcommand) {
    case "list":
      handleList(argv.slice(1));
      break;
    case "show":
      handleShow(argv.slice(1));
      break;
    case "--help":
    case undefined:
      log(
        [
          "Template Library Commands",
          "",
          "Usage:",
          "  kad library templates list",
          "  kad library templates show <id>",
          "",
          "Examples:",
          "  kad library templates list",
          "  kad library templates show workflow-template",
          ""
        ].join("\n")
      );
      break;
    default:
      error(`Unknown command: ${subcommand}`);
      error("Use 'kad library templates --help' for usage information.");
      process.exitCode = 1;
  }
}

function handleList(argv) {
  const config = loadConfig(process.cwd());
  const libraryDir = config?.library?.libraryDir || "library";
  
  const items = libraryOps.listLibraryItems("templates", null, process.cwd(), libraryDir);
  
  if (items.length === 0) {
    log("No templates found in library.");
    return;
  }

  log("\nTemplates:\n");
  
  // Group by subcategory
  const byCategory = {};
  items.forEach(item => {
    const cat = item.subcategory || "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  Object.keys(byCategory).sort().forEach(cat => {
    log(`${cat}:`);
    byCategory[cat].forEach(item => {
      const name = item.metadata?.name || item.name;
      log(`  ${item.name.padEnd(30)} ${name}`);
    });
    log("");
  });
  
  log(`Total: ${items.length} template(s)`);
}

function handleShow(argv) {
  if (!argv[0]) {
    error("Template ID required");
    error("Usage: kad library templates show <id>");
    process.exitCode = 1;
    return;
  }

  const templateId = argv[0];
  const config = loadConfig(process.cwd());
  const libraryDir = config?.library?.libraryDir || "library";
  
  // Find template
  const items = libraryOps.listLibraryItems("templates", null, process.cwd(), libraryDir);
  const item = items.find(i => i.name === templateId || i.path.includes(templateId));
  
  if (!item) {
    error(`Template not found: ${templateId}`);
    process.exitCode = 1;
    return;
  }

  // Display template info
  const metadata = libraryOps.readLibraryMetadata(item.path, process.cwd(), libraryDir);
  const files = libraryOps.getLibraryItemFiles(item.path, process.cwd(), libraryDir);
  
  log(`\nTemplate: ${metadata?.name || item.name}`);
  log(`ID: ${item.name}`);
  log(`Category: ${item.subcategory || "other"}`);
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

module.exports = cmdLibraryTemplates;

