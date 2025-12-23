/**
 * kad timeline command - Print prompt for creating/updating Mermaid timeline diagram
 */

const fs = require("fs");
const path = require("path");
const { loadConfig, buildSummary, findCurrentReviewAndProgress, runGit, log } = require("../utils");

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

module.exports = cmdTimeline;

