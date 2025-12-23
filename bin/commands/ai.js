/**
 * kad ai command - Print ready-to-paste prompt with scan summary
 */

const { loadConfig, buildSummary, log } = require("../utils");

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

module.exports = cmdAi;

