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
 *
 *   kad ai
 *     - Uses the same summary as `kad scan` but wraps it in a ready-to-paste
 *       prompt that you can feed into an AI agent (e.g. Cursor) to adapt
 *       agents/tools/workflows/prompts to the current repository.
 *
 *   kad progress
 *     - Emits a ready-to-paste prompt focused on the *current* review/progress
 *       pair (e.g. `review/version0-11.md` + `progress/version0-11.md`),
 *       aligned with the kaczmarek.ai-dev concept.
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

function buildSummary(cwd, config) {
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

  return {
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
}

function findCurrentReviewAndProgress(summary) {
  const reviewFiles = (summary.docs && summary.docs.reviewFiles) || [];
  const progressFiles = (summary.docs && summary.docs.progressFiles) || [];

  const versionItems = [];

  for (const item of reviewFiles) {
    const relPath = item.path || "";
    const base = path.basename(relPath, path.extname(relPath));
    if (!base.startsWith("version")) continue;
    const rest = base.slice("version".length); // e.g. "0-11" or "0-7-ui-config"
    const match = rest.match(/^(\d+)-(\d+)/);
    if (!match) continue;
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    const canonicalBase = `version${major}-${minor}`;
    versionItems.push({
      path: relPath,
      heading: item.heading || "",
      base,
      major,
      minor,
      isCanonical: base === canonicalBase
    });
  }

  if (versionItems.length === 0) {
    return null;
  }

  // Find highest version by (major, minor).
  let best = versionItems[0];
  for (let i = 1; i < versionItems.length; i += 1) {
    const cur = versionItems[i];
    if (
      cur.major > best.major ||
      (cur.major === best.major && cur.minor > best.minor)
    ) {
      best = cur;
    }
  }

  // Prefer canonical file name for that version if available.
  const sameVersion = versionItems.filter(
    (v) => v.major === best.major && v.minor === best.minor
  );
  const chosen =
    sameVersion.find((v) => v.isCanonical) || sameVersion[0] || best;

  const versionTag = `version${chosen.major}-${chosen.minor}`;

  let progress = null;
  for (const pf of progressFiles) {
    const relPath = pf.path || "";
    const base = path.basename(relPath, path.extname(relPath));
    if (base === versionTag) {
      progress = {
        path: relPath,
        heading: pf.heading || ""
      };
      break;
    }
  }

  return {
    versionTag,
    review: {
      path: chosen.path,
      heading: chosen.heading || ""
    },
    progress
  };
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

  const summary = buildSummary(cwd, config);
  log(JSON.stringify(summary, null, 2));
}

function cmdAi() {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  if (!config) return;

  const summary = buildSummary(cwd, config);
  const jsonBlock = JSON.stringify(summary, null, 2);

  const lines = [
    "You are an AI development assistant (kaczmarek.ai-dev style).",
    "",
    "You are helping adapt AI-related configuration, agents, tools, workflows, and prompts for this repository.",
    "",
    "Your work MUST align with the kaczmarek.ai-dev concept documented in `kaczmarek.ai-dev/docs/concept.md` (or the equivalent concept file in this repository if present).",
    "",
    "Repository summary (from kad scan):",
    "```json",
    jsonBlock,
    "```",
    "",
    "Goals:",
    "- Understand how this repository organises its documentation (`docs`), reviews, and progress logs.",
    "- Understand where AI-related assets live (`agents`, `tools`, `workflows`, `prompts`).",
    "- Align any suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
    "- Propose or refine a small, concrete plan for how AI helpers should interact with this repo.",
    "- Suggest any missing or misaligned files (e.g. workflows, prompts) that would make it easier to use AI safely and effectively here.",
    "",
    "Constraints:",
    "- Prefer small, incremental changes over large rewrites.",
    "- Do not assume the ability to run commands; instead, describe the commands or file edits the user should perform.",
    "- Respect existing project conventions you infer from the summary.",
    "",
    "Output:",
    "- A short high-level analysis of how well the current layout matches the desired AI/dev workflow.",
    "- A concise list of next actions (1–5 items) to improve AI integration for this repository.",
    "- Suggested file additions or edits (with paths) where appropriate."
  ];

  log(lines.join("\n"));
}

function cmdProgress() {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  if (!config) return;

  const summary = buildSummary(cwd, config);
  const pair = findCurrentReviewAndProgress(summary);
  if (!pair) {
    log(
      "No current review file found in the configured review directory. Make sure review/versionX-Y.md exists."
    );
    return;
  }

  const jsonBlock = JSON.stringify(summary, null, 2);

  const reviewPath = pair.review.path;
  const reviewHeading = pair.review.heading || "";
  const progressPath = pair.progress && pair.progress.path;
  const progressHeading = (pair.progress && pair.progress.heading) || "";

  const lines = [
    "You are an AI development assistant (kaczmarek.ai-dev style).",
    "",
    "You are helping maintain the *current* version review and progress log for this repository.",
    "",
    "Your work MUST align with the kaczmarek.ai-dev concept documented in `kaczmarek.ai-dev/docs/concept.md` (or the equivalent concept file in this repository if present).",
    "",
    `Current version tag: ${pair.versionTag}`,
    `Current review file: ${reviewPath}${reviewHeading ? ` (${reviewHeading})` : ""}`,
    progressPath
      ? `Current progress file: ${progressPath}${
          progressHeading ? ` (${progressHeading})` : ""
        }`
      : "Current progress file: (none found – you may want to create one matching the review version).",
    "",
    "Repository summary (from kad scan):",
    "```json",
    jsonBlock,
    "```",
    "",
    "Goals:",
    "- Use the current review file to keep a high-level, curated summary of what changed, risks, and next steps.",
    "- Use the current progress file as a detailed, chronological log of implementation work and verification steps.",
    "- Propose specific edits or additions to these files that keep them consistent with each other and with the underlying codebase.",
    "- Align any suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
    "",
    "Constraints:",
    "- Prefer small, incremental edits over large rewrites of the review/progress files.",
    "- Do not assume the ability to run commands; instead, describe the commands or file edits the user should perform.",
    "- Respect existing project conventions and phrasing in the review/progress documents.",
    "",
    "Output:",
    "- A short high-level analysis of the current review/progress pair and any obvious gaps.",
    "- A concise list of next edits (1–5 items) to apply to the review and/or progress files.",
    "- Suggested concrete text snippets or bullet points for those edits where helpful."
  ];

  log(lines.join("\n"));
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
    case "ai":
      cmdAi();
      return;
    case "progress":
      cmdProgress();
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
          "  kad scan             Print JSON summary of docs/review/progress + AI folders.",
          "  kad ai               Print a ready-to-paste prompt that includes the scan summary.",
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


