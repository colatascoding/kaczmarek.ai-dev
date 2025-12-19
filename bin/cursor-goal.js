#!/usr/bin/env node

/**
 * cursor-goal – Goal-oriented Cursor CLI launcher for kaczmarek.ai-dev
 *
 * Purpose:
 *   Allow you to describe a high-level goal once, then start a Cursor CLI
 *   session that:
 *     - Understands the repository layout via `kad scan`.
 *     - Follows the kaczmarek.ai-dev concept (local-first, Cursor-first,
 *       review+progress pairing, small, test-driven iterations).
 *     - Is explicitly instructed to iterate (run / test / fix / refactor /
 *       redesign) until the goal is achieved or clear limits are reached.
 *
 * Behaviour:
 *   - If a goal string is passed on the command line, use it directly.
 *   - Otherwise, prompt once in the terminal: "Describe your goal for this session:".
 *   - Build an initial instruction message that embeds:
 *       - The goal.
 *       - The JSON summary from `kad scan`.
 *   - Launch `cursor-agent "<initial message>"` in interactive mode with
 *     stdio inherited, so you can continue the conversation directly in the
 *     Cursor CLI.
 *
 * Requirements:
 *   - Node.js available as `node`.
 *   - Cursor CLI installed and available as `cursor-agent`
 *     (see https://docs.cursor.com/de/cli/overview).
 *   - Run this script from the repository root, e.g.:
 *       node ./kaczmarek.ai-dev/bin/cursor-goal.js "Refine shader interactions on the IT Security page"
 */

const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const readline = require("readline");

function log(msg) {
  process.stdout.write(String(msg) + "\n");
}

function error(msg) {
  process.stderr.write(String(msg) + "\n");
}

function runKadScan() {
  const cwd = process.cwd();
  const kadPath = path.join(__dirname, "kad.js");

  if (!fs.existsSync(kadPath)) {
    error(
      `cursor-goal: kad CLI not found at ${kadPath}. Make sure kaczmarek.ai-dev is checked out correctly.`
    );
    process.exitCode = 1;
    return null;
  }

  try {
    const out = child_process.execFileSync(
      process.execPath,
      [kadPath, "scan"],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    return out.trim();
  } catch (e) {
    error(
      `cursor-goal: failed to run "node kaczmarek.ai-dev/bin/kad.js scan": ${String(
        e
      )}`
    );
    process.exitCode = 1;
    return null;
  }
}

function buildInitialMessage(goal, repoSummaryJson) {
  const lines = [];
  // Put the GOAL first so Cursor CLI's preview clearly shows it.
  lines.push(`GOAL: ${goal}`);
  lines.push("");
  lines.push(
    "You are an AI development assistant running inside the Cursor CLI (cursor-agent), following the kaczmarek.ai-dev concept."
  );
  lines.push("");
  lines.push(
    "High-level goal for this session (defined by the human developer):"
  );
  lines.push("");
  lines.push(`GOAL: ${goal}`);
  lines.push("");
  lines.push("Repository summary (from kad scan):");
  lines.push("```json");
  lines.push(repoSummaryJson || "{}");
  lines.push("```");
  lines.push("");
  lines.push("Core principles you MUST follow:");
  lines.push("- Local-first & reproducible: prefer local tools, builds, and tests; every action should map to concrete shell or HTTP calls.");
  lines.push(
    "- Cursor-first workflows: assume you are running as a Cursor agent with the ability to inspect files and run local commands when appropriate."
  );
  lines.push(
    "- Review + progress pairing: treat review/versionX-Y.md as the curated summary, and progress/versionX-Y.md as the detailed log."
  );
  lines.push(
    "- Small, test-driven iterations: plan and execute work in small steps with clear verification (tests or manual checks)."
  );
  lines.push("");
  lines.push("How you should work in this session:");
  lines.push(
    "1. Interpret the GOAL and the repository summary. Identify the smallest next step that moves toward the goal."
  );
  lines.push(
    "2. For each step, follow a tight loop: PLAN → EDIT → RUN/TEST → EVALUATE."
  );
  lines.push(
    "   - PLAN: briefly state what you will change (files, functions, shaders, docs)."
  );
  lines.push(
    "   - EDIT: apply small, focused changes to the codebase or docs."
  );
  lines.push(
    "   - RUN/TEST: run appropriate local commands to verify (builds, tests, static checks, or manual browser verification instructions)."
  );
  lines.push(
    "   - EVALUATE: check whether the changes moved you closer to the GOAL; then decide on the next small step."
  );
  lines.push(
    "3. Keep the current review and progress documents consistent with the implemented work, but avoid large rewrites."
  );
  lines.push(
    "4. Continue iterating until the GOAL is achieved to a reasonable degree of confidence, or you hit clear environment limits (e.g. missing tools, failing tests you cannot fix safely)."
  );
  lines.push("");
  lines.push("Important constraints for this environment:");
  lines.push(
    "- Prefer running local commands that a human can also run manually later."
  );
  lines.push(
    "- When you run commands, be explicit about what you are doing and why."
  );
  lines.push(
    "- Default to narrow, reversible edits rather than broad refactors unless the user explicitly asks for a redesign."
  );
  lines.push(
    "- When you believe the GOAL is achieved (or blocked), summarise: what you changed, how to verify, and any remaining risks or follow-ups."
  );
  lines.push("");
  lines.push(
    "Interaction style (very important):"
  );
  lines.push(
    "- Treat the GOAL as fully specified; do not ask the user to restate or confirm it unless you are truly unsure what it means."
  );
  lines.push(
    "- Default to AUTOPILOT: after each PLAN → EDIT → RUN/TEST → EVALUATE cycle, immediately propose and start the next step instead of asking open-ended follow-up questions."
  );
  lines.push(
    "- Only ask a question when you are genuinely blocked by missing information. When in doubt, state your assumption and proceed, inviting correction."
  );
  lines.push(
    "- Avoid generic prompts such as “Any follow-up?” or “Any other questions?” – keep executing toward the GOAL until the user intervenes or you hit a clear environment limit."
  );
  lines.push("");
  lines.push(
    "Start by briefly restating the GOAL in your own words, summarising what you infer from the repository summary, and then immediately propose and execute your first small step in the PLAN → EDIT → RUN/TEST → EVALUATE loop without waiting for further input."
  );

  return lines.join("\n");
}

function launchCursorAgent(message, options) {
  const opts = options || {};
  const background = !!opts.background;
  const model = opts.model || null;

  // Interactive mode: start a normal cursor-agent session and treat `message`
  // as the first user message.
  // Background/print mode: use `cursor-agent -p "<message>" [--model ...]`
  // so the agent can run to completion without additional user turns.
  const args = [];
  if (background) {
    args.push("-p", message);
    if (model) {
      args.push("--model", model);
    }
  } else {
    args.push(message);
  }

  try {
    const child = child_process.spawn("cursor-agent", args, {
      stdio: "inherit"
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        error(`cursor-goal: cursor-agent terminated with signal ${signal}`);
      } else if (typeof code === "number" && code !== 0) {
        error(`cursor-goal: cursor-agent exited with code ${code}`);
      }
    });
  } catch (e) {
    error(
      'cursor-goal: failed to launch "cursor-agent". Make sure the Cursor CLI is installed and on your PATH (see https://docs.cursor.com/de/cli/overview).'
    );
    error(String(e));
    process.exitCode = 1;
  }
}

function main() {
  const args = process.argv.slice(2);
  const hasDryRun = args.includes("--dry-run");
  const isBackground = args.includes("--background");

  let model = null;
  const modelIndex = args.indexOf("--model");
  if (modelIndex !== -1 && args[modelIndex + 1]) {
    model = args[modelIndex + 1];
  }

  const filteredArgs = args.filter((a, idx) => {
    if (a === "--dry-run" || a === "--background") return false;
    if (idx === modelIndex || idx === modelIndex + 1) return false;
    return true;
  });
  const initialGoal = filteredArgs.join(" ").trim();

  const repoSummaryJson = runKadScan();
  if (repoSummaryJson == null) {
    return;
  }

  function withGoal(goalText) {
    if (!goalText) {
      error("cursor-goal: empty goal, nothing to do.");
      process.exitCode = 1;
      return;
    }

    const message = buildInitialMessage(goalText, repoSummaryJson);

    if (hasDryRun) {
      log("cursor-goal: dry run – this is the initial message that would be sent to cursor-agent:\n");
      log(message);
      return;
    }

    launchCursorAgent(message, { background: isBackground, model });
  }

  if (initialGoal) {
    withGoal(initialGoal);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(
    "cursor-goal: Describe your goal for this session:\n> ",
    (answer) => {
      rl.close();
      const goalText = String(answer || "").trim();
      withGoal(goalText);
    }
  );
}

main();




