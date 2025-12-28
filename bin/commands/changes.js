/**
 * kad changes command - Print prompt for analyzing recent git changes vs review/progress
 */

const { loadConfig, buildSummary, findCurrentReviewAndProgress, runGit, log } = require("../utils");

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

module.exports = cmdChanges;


