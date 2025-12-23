/**
 * Prompt generation commands (scan, ai, progress, run, changes, timeline)
 */

const { log, loadConfig, buildSummary, findCurrentReviewAndProgress } = require("../utils");
const path = require("path");

function cmdInit(argv) {
  const { saveConfig, loadConfig } = require("../utils");
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
  const { runGit } = require("../utils");
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
    "You are helping to analyse the most recent code/documentation changes (via git) and compare them against the current review/progress documents, suggesting any needed updates.",
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
    "Recent git changes:",
    "```",
    gitLog,
    "```",
    "",
    "Current git status:",
    "```",
    gitStatus,
    "```",
    "",
    "Git diff stat:",
    "```",
    gitDiffStat,
    "```",
    "",
    "Goals:",
    "- Compare the recent git changes against the current review and progress files.",
    "- Identify any gaps or inconsistencies (e.g., work done but not documented, or documented but not done).",
    "- Propose specific edits to the review and/or progress files to bring them into alignment with the actual codebase state.",
    "- Align any suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
    "",
    "Constraints:",
    "- Prefer small, incremental edits over large rewrites.",
    "- Do not assume the ability to run commands; instead, describe the commands or file edits the user should perform.",
    "- Respect existing project conventions and phrasing in the review/progress documents.",
    "",
    "Output:",
    "- A short analysis of how well the review/progress files reflect the recent changes.",
    "- A concise list of edits (1–5 items) to apply to the review and/or progress files.",
    "- Suggested concrete text snippets or bullet points for those edits where helpful."
  ];

  log(lines.join("\n"));
}

function cmdTimeline() {
  const { runGit } = require("../utils");
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  if (!config) return;

  const summary = buildSummary(cwd, config);
  const pair = findCurrentReviewAndProgress(summary);

  const jsonBlock = JSON.stringify(summary, null, 2);

  const reviewPath = pair && pair.review && pair.review.path;
  const reviewHeading = pair && pair.review && (pair.review.heading || "");

  const timelineInfo = summary.timeline || {};
  const diagramFile = timelineInfo.diagramFile || "docs/TIMELINE.mmd";
  const diagramExists = !!timelineInfo.exists;

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
  if (diagramExists && require("fs").existsSync(absDiagramPath)) {
    try {
      existingDiagram = require("fs").readFileSync(absDiagramPath, "utf8");
    } catch {
      existingDiagram =
        "(timeline file exists but could not be read – please check permissions)";
    }
  }

  const lines = [
    "You are an AI development assistant (kaczmarek.ai-dev style).",
    "",
    "You are helping to create or update a Mermaid timeline diagram that tracks versions/reviews and important tagged commits.",
    "",
    "Your work MUST align with the kaczmarek.ai-dev concept documented in `kaczmarek.ai-dev/docs/concept.md` (or the equivalent concept file in this repository if present).",
    "",
    `Timeline diagram file: ${diagramFile}`,
    `Timeline diagram exists: ${diagramExists ? "yes" : "no"}`,
    reviewPath
      ? `Current review file: ${reviewPath}${reviewHeading ? ` (${reviewHeading})` : ""}`
      : "Current review file: (none found)",
    "",
    "Repository summary (from kad scan):",
    "```json",
    jsonBlock,
    "```",
    "",
    "Git tags:",
    "```",
    tags,
    "```",
    "",
    "Recent git log (decorated):",
    "```",
    decoratedLog,
    "```",
    "",
    "Existing timeline diagram (if any):",
    "```mermaid",
    existingDiagram,
    "```",
    "",
    "Goals:",
    "- Create or update a Mermaid timeline diagram that shows:",
    "  - Version transitions (e.g., version0-1 → version0-2)",
    "  - Important tagged commits",
    "  - Major milestones or releases",
    "- The diagram should be clear, readable, and aligned with the repository's actual history.",
    "- Align any suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
    "",
    "Constraints:",
    "- Use Mermaid syntax for timeline diagrams.",
    "- Do not assume the ability to run commands; instead, describe the commands or file edits the user should perform.",
    "- Respect existing project conventions and naming.",
    "",
    "Output:",
    "- A complete Mermaid timeline diagram (ready to paste into the timeline file).",
    "- Optional: suggestions for how to maintain the timeline as the project evolves."
  ];

  log(lines.join("\n"));
}

module.exports = {
  cmdInit,
  cmdScan,
  cmdAi,
  cmdProgress,
  cmdRun,
  cmdChanges,
  cmdTimeline
};

