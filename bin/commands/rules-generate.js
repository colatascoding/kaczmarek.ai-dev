/**
 * kad rules-generate command - Launch background task to analyze codebase and interactively create rules
 */

const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const { loadConfig, buildSummary, log, error } = require("../utils");

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
            } catch (_e) {
              // Ignore parse errors
            }
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

module.exports = cmdRulesGenerate;

