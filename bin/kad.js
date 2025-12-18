#!/usr/bin/env node

/**
 * kaczmarek.ai-dev CLI (kad)
 *
 * First generic solution: repository bootstrap & documentation scan.
 *
 * This CLI is intentionally dependency-free so it can run in almost any Node
 * environment. It is designed to help AI tools (and humans) understand a
 * repository's structure and key documentation entry points.
 *
 * Commands:
 *
 *   kad init
 *     - Creates a `kaczmarek-ai.config.json` with sensible defaults for the
 *       current repository (docs/review/progress directories).
 *
 *   kad scan
 *     - Reads `kaczmarek-ai.config.json` if present (or uses defaults) and
 *       prints a JSON summary of key documentation files and their first
 *       headings. This is intended to be pasted into an AI prompt or used
 *       by higher-level tooling.
 */

const fs = require("fs");
const path = require("path");

const CONFIG_FILENAME = "kaczmarek-ai.config.json";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function error(msg) {
  process.stderr.write(`${msg}\n`);
}

function loadConfig(cwd) {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    return {
      version: 1,
      projectName: path.basename(cwd),
      docs: {
        docsDir: "docs",
        reviewDir: "review",
        progressDir: "progress"
      },
      ai: {
        agentsDir: "agents",
        toolsDir: "tools",
        workflowsDir: "workflows",
        promptsDir: "prompts"
      }
    };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    error(`Failed to read/parse ${CONFIG_FILENAME}: ${String(e)}`);
    process.exitCode = 1;
    return null;
  }
}

function saveConfig(cwd, config, { force = false } = {}) {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  if (fs.existsSync(configPath) && !force) {
    error(
      `${CONFIG_FILENAME} already exists. Use --force to overwrite if you really want to.`
    );
    process.exitCode = 1;
    return;
  }
  const data = JSON.stringify(config, null, 2) + "\n";
  fs.writeFileSync(configPath, data, "utf8");
  log(`Wrote ${CONFIG_FILENAME} in ${cwd}`);
}

function listMarkdownFiles(dir, maxDepth, currentDepth = 0) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (currentDepth < maxDepth) {
        result.push(...listMarkdownFiles(full, maxDepth, currentDepth + 1));
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      result.push(full);
    }
  }
  return result;
}

function readFirstHeading(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        return trimmed;
      }
    }
  } catch {
    // ignore read errors, just return empty
  }
  return "";
}

function cmdInit(argv) {
  const force = argv.includes("--force");
  const cwd = process.cwd();
  const baseConfig = loadConfig(cwd);
  if (!baseConfig) return;
  saveConfig(cwd, baseConfig, { force });
}

function cmdScan() {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  if (!config) return;

  const docsDir = path.join(cwd, config.docs?.docsDir || "docs");
  const reviewDir = path.join(cwd, config.docs?.reviewDir || "review");
  const progressDir = path.join(cwd, config.docs?.progressDir || "progress");

  // AI-related dirs (agents, tools, workflows, prompts) – optional.
  const agentsDir = path.join(cwd, config.ai?.agentsDir || "agents");
  const toolsDir = path.join(cwd, config.ai?.toolsDir || "tools");
  const workflowsDir = path.join(cwd, config.ai?.workflowsDir || "workflows");
  const promptsDir = path.join(cwd, config.ai?.promptsDir || "prompts");

  const docsFiles = listMarkdownFiles(docsDir, 2);
  const reviewFiles = listMarkdownFiles(reviewDir, 1);
  const progressFiles = listMarkdownFiles(progressDir, 1);

  const agentsFiles = listMarkdownFiles(agentsDir, 2);
  const toolsFiles = listMarkdownFiles(toolsDir, 2);
  const workflowsFiles = listMarkdownFiles(workflowsDir, 2);
  const promptsFiles = listMarkdownFiles(promptsDir, 2);

  function toSummary(files) {
    return files.map((f) => {
      const rel = path.relative(cwd, f);
      const heading = readFirstHeading(f);
      return { path: rel, heading };
    });
  }

  const summary = {
    projectName: config.projectName || path.basename(cwd),
    configFile: CONFIG_FILENAME,
    docs: {
      docsDir: path.relative(cwd, docsDir),
      reviewDir: path.relative(cwd, reviewDir),
      progressDir: path.relative(cwd, progressDir),
      docsFiles: toSummary(docsFiles),
      reviewFiles: toSummary(reviewFiles),
      progressFiles: toSummary(progressFiles)
    },
    ai: {
      agentsDir: path.relative(cwd, agentsDir),
      toolsDir: path.relative(cwd, toolsDir),
      workflowsDir: path.relative(cwd, workflowsDir),
      promptsDir: path.relative(cwd, promptsDir),
      agentsFiles: toSummary(agentsFiles),
      toolsFiles: toSummary(toolsFiles),
      workflowsFiles: toSummary(workflowsFiles),
      promptsFiles: toSummary(promptsFiles)
    }
  };

  log(JSON.stringify(summary, null, 2));
}

function main() {
  const [, , cmd, ...rest] = process.argv;

  switch (cmd) {
    case "init":
      cmdInit(rest);
      return;
    case "scan":
      cmdScan();
      return;
    case "-h":
    case "--help":
    case undefined:
      log(
        [
          "kaczmarek.ai-dev CLI (kad)",
          "",
          "Usage:",
          "  kad init [--force]   Create kaczmarek-ai.config.json with defaults.",
          "  kad scan             Print JSON summary of docs/review/progress files.",
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


