/**
 * kad run command - Print prompt for implementing next goals from review
 */

const { loadConfig, buildSummary, findCurrentReviewAndProgress, log } = require("../utils");

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

module.exports = cmdRun;



