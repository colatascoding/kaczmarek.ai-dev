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
 *
 *   kad run
 *     - Emits a ready-to-paste prompt that asks an AI agent to implement the
 *       next concrete goals from the current review and keep the review and
 *       progress documents in sync with the actual work, following the
 *       kaczmarek.ai-dev principles.
 *
 *   kad changes
 *     - Emits a ready-to-paste prompt that asks an AI agent to analyse the most
 *       recent code/documentation changes (via git) and compare them against
 *       the current review/progress documents, suggesting any needed updates.
 *
 *   kad timeline
 *     - Emits a ready-to-paste prompt that asks an AI agent to create or update
 *       a Mermaid timeline diagram (referencing review versions and tagged
 *       commits) at the configured timeline file.
 */

const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

const CONFIG_FILENAME = "kaczmarek-ai.config.json";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function error(msg) {
  process.stderr.write(`${msg}\n`);
}

function runGit(args) {
  try {
    const out = child_process.execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return out.trim();
  } catch {
    return null;
  }
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
      },
      timeline: {
        // Default location for a Mermaid timeline diagram that tracks
        // versions/reviews and important tagged commits.
        diagramFile: "docs/TIMELINE.mmd"
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

  // Timeline diagram (Mermaid) – optional.
  const timelinePath = path.join(
    cwd,
    config.timeline?.diagramFile || "docs/TIMELINE.mmd"
  );
  const timelineExists = fs.existsSync(timelinePath);

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
    },
    timeline: {
      diagramFile: path.relative(cwd, timelinePath),
      exists: timelineExists
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

function cmdRun() {
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
    "You are helping to *implement* the next concrete work items from the current version review and keep the review/progress documents aligned with the actual codebase.",
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
    "- Read the current version review file and especially its \"Next Steps\" / plan section (if present).",
    "- Identify 1–3 very small, concrete implementation tasks that move the version forward.",
    "- For each task, specify which files to change, what to change, and how to verify it (tests/commands/manual checks).",
    "- After each task, ensure the progress file gains a clear dated entry and suggest any necessary tweaks to the review file to keep it accurate but concise.",
    "- Align all suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
    "",
    "Constraints:",
    "- Prefer small, incremental tasks over broad refactors.",
    "- Do not assume the ability to run commands; instead, describe the commands or file edits the user should perform.",
    "- Respect existing project conventions, naming, and tone in the review/progress documents.",
    "",
    "Output:",
    "- A short plan listing 1–3 concrete tasks (with file paths and verification steps) derived from the current review.",
    "- For the first task, a more detailed description of the code/doc changes to make and how to reflect them in the progress and (if needed) review files.",
    "- Optional suggestions for how to break further work into additional kad-run sessions."
  ];

  log(lines.join("\n"));
}

function cmdChanges() {
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

  const gitLog =
    runGit(["log", "-5", "--pretty=format:%h %ad %s", "--date=short"]) ||
    "(git log unavailable or repository not initialised)";
  const gitStatus =
    runGit(["status", "--short"]) ||
    "(git status unavailable or repository not initialised)";
  let gitDiffStat =
    runGit(["diff", "--stat", "HEAD~1..HEAD"]) ||
    runGit(["diff", "--stat"]) ||
    "(git diff stat unavailable or no changes)";

  const lines = [
    "You are an AI development assistant (kaczmarek.ai-dev style).",
    "",
    "You are helping to analyse recent changes in this repository and check whether the current version review and progress documents accurately reflect those changes.",
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
    "Recent changes (git summary):",
    "```text",
    "git log -5 --pretty=format:%h %ad %s --date=short",
    gitLog,
    "",
    "git status --short",
    gitStatus,
    "",
    "git diff --stat (last commit or working tree)",
    gitDiffStat,
    "```",
    "",
    "Goals:",
    "- Infer what has changed recently (especially in code and docs) from the git summaries above.",
    "- Check whether the current review and progress documents for this version are consistent with those changes.",
    "- Identify any changes that are missing, under-documented, or no longer accurate in the review/progress pair.",
    "- Align all suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
    "",
    "Constraints:",
    "- Prefer suggesting small, incremental edits to the review/progress files rather than large rewrites.",
    "- Do not assume the ability to run commands; instead, describe the commands or file edits the user should perform.",
    "- Respect existing project conventions, naming, and tone in the review/progress documents.",
    "",
    "Output:",
    "- A short high-level analysis of how well the current review/progress pair reflects the recent changes.",
    "- A concise list of specific inconsistencies or missing entries you notice.",
    "- Suggested concrete updates (bullet points or short paragraphs) to add to the progress and/or review files to bring them back in sync."
  ];

  log(lines.join("\n"));
}

function cmdTimeline() {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  if (!config) return;

  const summary = buildSummary(cwd, config);
  const pair = findCurrentReviewAndProgress(summary);

  const jsonBlock = JSON.stringify(summary, null, 2);

  const timelineInfo = summary.timeline || {};
  const diagramFile = timelineInfo.diagramFile || "docs/TIMELINE.mmd";
  const diagramExists = !!timelineInfo.exists;

  const reviewPath = pair && pair.review && pair.review.path;
  const reviewHeading = pair && pair.review && (pair.review.heading || "");

  const tags =
    runGit(["tag", "--sort=creatordate"]) ||
    "(no git tags found or git not available)";
  const decoratedLog =
    runGit([
      "log",
      "--decorate",
      "--oneline",
      "--date=short",
      "--max-count=40"
    ]) || "(git log unavailable or repository not initialised)";

  let existingDiagram = "(timeline file does not exist yet)";
  const absDiagramPath = path.join(cwd, diagramFile);
  if (diagramExists && fs.existsSync(absDiagramPath)) {
    try {
      existingDiagram = fs.readFileSync(absDiagramPath, "utf8");
    } catch {
      existingDiagram =
        "(timeline file exists but could not be read – please check permissions)";
    }
  }

  const lines = [
    "You are an AI development assistant (kaczmarek.ai-dev style).",
    "",
    "You are helping to create or update a **Mermaid timeline diagram** that shows the evolution of this project across versions, review stages, and important tagged commits.",
    "",
    "Your work MUST align with the kaczmarek.ai-dev concept documented in `kaczmarek.ai-dev/docs/concept.md` (or the equivalent concept file in this repository if present).",
    "",
    `Timeline diagram file (Mermaid): ${diagramFile} ${
      diagramExists ? "(currently exists)" : "(does not yet exist)"
    }`,
    pair
      ? `Current version (detected from review files): ${pair.versionTag} – ${reviewPath}${
          reviewHeading ? ` (${reviewHeading})` : ""
        }`
      : "Current version: (no review/versionX-Y.md detected)",
    "",
    "Repository summary (from kad scan):",
    "```json",
    jsonBlock,
    "```",
    "",
    "Git tags (sorted by creation date):",
    "```text",
    tags,
    "```",
    "",
    "Recent commits (decorated log):",
    "```text",
    decoratedLog,
    "```",
    "",
    "Existing Mermaid timeline file (if any):",
    "```mermaid",
    existingDiagram,
    "```",
    "",
    "Goals:",
    "- Interpret the review/version documents and git tags as *milestones* along a project timeline (e.g. version0-1, version0-7, version0-11, etc.).",
    "- Design or refine a Mermaid timeline diagram in the configured file that:",
    "  - Shows key versions/reviews in chronological order.",
    "  - References important tagged commits (when tags exist) for major milestones.",
    "  - Uses clear labels so humans and AI can quickly see the project's evolution.",
    "- Keep the diagram concise and focused on meaningful architectural / workflow milestones, not every tiny commit.",
    "",
    "Constraints:",
    "- Prefer adjusting or extending the existing diagram over completely rewriting it, unless it is very small or clearly outdated.",
    "- Use valid Mermaid syntax suitable for a timeline/chronological view (e.g. `timeline` or a suitable alternative supported by your Mermaid tooling).",
    "- Do not assume the ability to run commands; instead, describe the edits to apply to the Mermaid file.",
    "",
    "Output:",
    "- A short explanation of how you interpreted the current history (versions, tags, reviews).",
    "- A proposed updated contents for the Mermaid timeline file (or a diff-style description) that can be applied to the diagram file.",
    "- Any notes on how to maintain this timeline going forward as new versions/tags/reviews are added."
  ];

  log(lines.join("\n"));
}

function cmdRulesCheck() {
  const cwd = process.cwd();
  const rulesDir = path.join(cwd, ".cursor", "rules");
  const agentsMd = path.join(cwd, "AGENTS.md");
  const cursorRules = path.join(cwd, ".cursorrules");

  const results = {
    projectRules: {
      exists: false,
      path: rulesDir,
      rules: []
    },
    agentsMd: {
      exists: false,
      path: agentsMd
    },
    cursorRules: {
      exists: false,
      path: cursorRules
    }
  };

  // Check .cursor/rules directory
  if (fs.existsSync(rulesDir)) {
    results.projectRules.exists = true;
    try {
      const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const ruleFile = path.join(rulesDir, entry.name, "RULE.md");
          if (fs.existsSync(ruleFile)) {
            results.projectRules.rules.push({
              name: entry.name,
              path: path.relative(cwd, ruleFile)
            });
          }
        }
      }
    } catch (e) {
      error(`Failed to read .cursor/rules directory: ${String(e)}`);
    }
  }

  // Check AGENTS.md
  if (fs.existsSync(agentsMd)) {
    results.agentsMd.exists = true;
  }

  // Check .cursorrules (legacy)
  if (fs.existsSync(cursorRules)) {
    results.cursorRules.exists = true;
  }

  log(JSON.stringify(results, null, 2));
}

function cmdOnboard() {
  const cwd = process.cwd();
  const readline = require("readline");

  log("Welcome to kaczmarek.ai-dev! 🚀");
  log("");
  log("This interactive onboarding will help you set up your project.");
  log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function question(prompt) {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  }

  async function runOnboarding() {
    // Step 1: Check if config exists
    const configPath = path.join(cwd, "kaczmarek-ai.config.json");
    const hasConfig = fs.existsSync(configPath);

    if (!hasConfig) {
      log("Step 1: Initializing configuration...");
      cmdInit([]);
      log("");
    } else {
      log("✓ Configuration file already exists");
      log("");
    }

    // Step 2: Check project structure
    log("Step 2: Checking project structure...");
    const config = loadConfig(cwd);
    if (!config) {
      error("Failed to load config. Please run 'kad init' first.");
      rl.close();
      return;
    }

    const dirs = [
      { name: "docs", path: path.join(cwd, config.docs?.docsDir || "docs") },
      { name: "review", path: path.join(cwd, config.docs?.reviewDir || "review") },
      { name: "progress", path: path.join(cwd, config.docs?.progressDir || "progress") }
    ];

    const missingDirs = [];
    for (const dir of dirs) {
      if (!fs.existsSync(dir.path)) {
        missingDirs.push(dir.name);
      }
    }

    if (missingDirs.length > 0) {
      log(`⚠ Missing directories: ${missingDirs.join(", ")}`);
      const create = await question("Create them now? (y/n): ");
      if (create.toLowerCase() === "y" || create.toLowerCase() === "yes") {
        for (const dir of dirs) {
          if (missingDirs.includes(dir.name)) {
            fs.mkdirSync(dir.path, { recursive: true });
            log(`✓ Created ${dir.path}`);
          }
        }
      }
    } else {
      log("✓ All recommended directories exist");
    }
    log("");

    // Step 3: Check for rules
    log("Step 3: Checking for Cursor rules...");
    const rulesDir = path.join(cwd, ".cursor", "rules");
    const agentsMd = path.join(cwd, "AGENTS.md");
    const hasRules = fs.existsSync(rulesDir) || fs.existsSync(agentsMd);

    if (!hasRules) {
      log("⚠ No Cursor rules found");
      const generate = await question("Generate rules interactively? (y/n): ");
      if (generate.toLowerCase() === "y" || generate.toLowerCase() === "yes") {
        log("");
        log("Launching rules generator...");
        log("");
        rl.close();
        cmdRulesGenerate();
        return;
      }
    } else {
      log("✓ Cursor rules found");
    }
    log("");

    // Step 4: Scan project
    log("Step 4: Scanning project structure...");
    log("");
    cmdScan();
    log("");

    // Step 5: Next steps
    log("Step 5: Next steps");
    log("");
    log("You're all set! Here are some useful commands:");
    log("");
    log("  • kad scan          - View project structure summary");
    log("  • kad ai            - Get AI prompt with project context");
    log("  • kad progress      - Maintain review/progress documents");
    log("  • kad run           - Implement next tasks from review");
    log("  • kad changes       - Analyze recent git changes");
    log("  • kad rules-check   - Check for Cursor rules");
    log("  • kad rules-generate - Create Cursor rules interactively");
    log("");
    log("For more information:");
    log("  • Read docs/GETTING_STARTED.md for detailed guide");
    log("  • Read docs/concept.md for the full philosophy");
    log("  • Run 'kad --help' for all commands");
    log("");

    rl.close();
  }

  runOnboarding().catch((e) => {
    error(`Onboarding error: ${String(e)}`);
    rl.close();
    process.exitCode = 1;
  });
}

function cmdRulesGenerate() {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  if (!config) return;

  const summary = buildSummary(cwd, config);
  const jsonBlock = JSON.stringify(summary, null, 2);

  // Analyze codebase structure
  const fileExtensions = {};
  const directories = {};
  const packageManagers = [];

  function analyzeDirectory(dir, maxDepth, currentDepth = 0) {
    if (!fs.existsSync(dir) || currentDepth > maxDepth) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(cwd, fullPath);

        // Skip common ignore patterns
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === "dist" ||
          entry.name === "build"
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          if (!directories[relPath]) {
            directories[relPath] = { type: "directory", depth: currentDepth };
          }
          analyzeDirectory(fullPath, maxDepth, currentDepth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (ext) {
            fileExtensions[ext] = (fileExtensions[ext] || 0) + 1;
          }

          // Check for package managers
          if (entry.name === "package.json") {
            packageManagers.push("npm");
            try {
              const pkg = JSON.parse(fs.readFileSync(fullPath, "utf8"));
              if (pkg.workspaces) packageManagers.push("workspaces");
            } catch {}
          } else if (entry.name === "yarn.lock") {
            packageManagers.push("yarn");
          } else if (entry.name === "pnpm-lock.yaml") {
            packageManagers.push("pnpm");
          } else if (entry.name === "Cargo.toml") {
            packageManagers.push("cargo");
          } else if (entry.name === "requirements.txt" || entry.name === "pyproject.toml") {
            packageManagers.push("python");
          } else if (entry.name === "go.mod") {
            packageManagers.push("go");
          }
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }

  analyzeDirectory(cwd, 3);

  // Check for existing rules
  const rulesDir = path.join(cwd, ".cursor", "rules");
  const agentsMd = path.join(cwd, "AGENTS.md");
  const existingRules = {
    projectRules: fs.existsSync(rulesDir),
    agentsMd: fs.existsSync(agentsMd)
  };

  const analysis = {
    fileExtensions: Object.keys(fileExtensions)
      .sort((a, b) => fileExtensions[b] - fileExtensions[a])
      .slice(0, 10)
      .map((ext) => ({ extension: ext, count: fileExtensions[ext] })),
    packageManagers: [...new Set(packageManagers)],
    topDirectories: Object.keys(directories)
      .filter((d) => directories[d].depth <= 1)
      .slice(0, 15),
    existingRules
  };

  const analysisJson = JSON.stringify(analysis, null, 2);

  // Build the prompt for interactive rule generation
  const lines = [
    "You are an AI development assistant helping to create Cursor rules for this codebase.",
    "",
    "GOAL: Analyze this codebase and interactively help create appropriate Cursor rules (.cursor/rules or AGENTS.md).",
    "",
    "Repository summary (from kad scan):",
    "```json",
    jsonBlock,
    "```",
    "",
    "Codebase analysis:",
    "```json",
    analysisJson,
    "```",
    "",
    "Existing rules status:",
    `- Project Rules (.cursor/rules): ${existingRules.projectRules ? "EXISTS" : "NOT FOUND"}`,
    `- AGENTS.md: ${existingRules.agentsMd ? "EXISTS" : "NOT FOUND"}`,
    "",
    "Your task:",
    "1. Analyze the codebase structure, file types, and patterns.",
    "2. Identify key conventions, frameworks, and architectural patterns.",
    "3. Propose specific, actionable rules that would help AI assistants work effectively with this codebase.",
    "4. For each proposed rule, ask the user if they want to create it.",
    "5. When the user confirms, create the rule file(s) following Cursor's rules format:",
    "   - For Project Rules: Create `.cursor/rules/<rule-name>/RULE.md` with frontmatter and content",
    "   - For AGENTS.md: Create or append to `AGENTS.md` in the project root",
    "",
    "Rule creation guidelines:",
    "- Keep rules focused and under 500 lines",
    "- Provide concrete examples",
    "- Use appropriate rule types:",
    "  - 'Always Apply' for critical standards",
    "  - 'Apply Intelligently' for context-aware rules",
    "  - 'Apply to Specific Files' for file-pattern-based rules",
    "  - 'Apply Manually' for optional workflows",
    "",
    "Start by:",
    "1. Summarizing what you found about the codebase structure",
    "2. Proposing 3-5 specific rules that would be most valuable",
    "3. Asking which rules the user wants to create",
    "4. Creating the rules interactively based on user feedback"
  ];

  // Launch as background task using cursor-agent
  const message = lines.join("\n");

  try {
    const child = child_process.spawn("cursor-agent", ["-p", message], {
      stdio: "inherit",
      cwd: cwd
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        error(`kad rules-generate: cursor-agent terminated with signal ${signal}`);
      } else if (typeof code === "number" && code !== 0) {
        error(`kad rules-generate: cursor-agent exited with code ${code}`);
      } else {
        log("\nkad rules-generate: Rule generation task completed.");
      }
    });
  } catch (e) {
    error(
      'kad rules-generate: failed to launch "cursor-agent". Make sure the Cursor CLI is installed and on your PATH (see https://docs.cursor.com/de/cli/overview).'
    );
    error(`Alternatively, you can paste this prompt into Cursor Chat manually:\n`);
    log("\n" + "=".repeat(80) + "\n");
    log(message);
    log("\n" + "=".repeat(80) + "\n");
    process.exitCode = 1;
  }
}

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
    const WorkflowEngine = require("../lib/workflow/engine");
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

  // Parse --key value params
  for (let i = 1; i < argv.length; i += 2) {
    if (argv[i] && argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      let value = argv[i + 1] || "";
      
      // Try to parse as number if it looks like a number
      if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
        value = parseFloat(value);
      }
      
      params[key] = value;
    }
  }

  try {
    const WorkflowEngine = require("../lib/workflow/engine");
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
    const WorkflowEngine = require("../lib/workflow/engine");
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
    const WorkflowEngine = require("../lib/workflow/engine");
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
    const WorkflowEngine = require("../lib/workflow/engine");
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


