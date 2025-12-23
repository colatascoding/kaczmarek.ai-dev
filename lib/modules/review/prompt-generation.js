/**
 * Prompt generation for review module
 */

/**
 * Generate review update prompt
 */
async function generateReviewPrompt(inputs, context) {
  const { summary, changes, reviewContent, progressContent, versionTag } = inputs;
  const { logger } = context;

  logger.info("Generating review update prompt...");

  // Ensure we have proper values (not template strings)
  const summaryObj = typeof summary === "object" ? summary : {};
  const changesObj = typeof changes === "object" && !changes.includes ? changes : {};

  const prompt = [
    "You are an AI development assistant (kaczmarek.ai-dev style).",
    "",
    "You are helping maintain the *current* version review and progress log for this repository.",
    "",
    "Your work MUST align with the kaczmarek.ai-dev concept documented in `docs/concept.md`.",
    "",
    `Current version tag: ${versionTag || "unknown"}`,
    "",
    "Repository summary:",
    "```json",
    JSON.stringify(summaryObj, null, 2),
    "```",
    "",
    "Recent changes:",
    "```json",
    JSON.stringify(changesObj, null, 2),
    "```",
    "",
    "Current review file content:",
    "```markdown",
    reviewContent || "(empty or not found)",
    "```",
    "",
    progressContent ? "Current progress file content:" : "",
    progressContent ? "```markdown" : "",
    progressContent || "",
    progressContent ? "```" : "",
    "",
    "Goals:",
    "- Use the current review file to keep a high-level, curated summary of what changed, risks, and next steps.",
    "- Use the current progress file as a detailed, chronological log of implementation work and verification steps.",
    "- Propose specific edits or additions to these files that keep them consistent with each other and with the underlying codebase.",
    "- Align any suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
    "",
    "Output:",
    "- A short high-level analysis of the current review/progress pair and any obvious gaps.",
    "- A concise list of next edits (1–5 items) to apply to the review and/or progress files.",
    "- Suggested concrete text snippets or bullet points for those edits where helpful."
  ].filter(Boolean).join("\n");

  // Also log the prompt for visibility
  logger.info("Generated review prompt:");
  logger.info("=".repeat(80));
  logger.info(prompt);
  logger.info("=".repeat(80));

  return {
    success: true,
    prompt
  };
}

module.exports = {
  generateReviewPrompt
};

