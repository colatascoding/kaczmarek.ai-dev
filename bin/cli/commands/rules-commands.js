/**
 * Rules and onboarding commands
 */

const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const { log, error, loadConfig, buildSummary } = require("../utils");

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

  if (fs.existsSync(agentsMd)) {
    results.agentsMd.exists = true;
  }

  if (fs.existsSync(cursorRules)) {
    results.cursorRules.exists = true;
  }

  log(JSON.stringify(results, null, 2));
}

function cmdOnboard() {
  const cwd = process.cwd();
  const readline = require("readline");
  const { cmdInit, cmdScan, cmdRulesGenerate } = require("./prompt-commands");

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

    log("Step 4: Scanning project structure...");
    log("");
    cmdScan();
    log("");

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

module.exports = {
  cmdRulesCheck,
  cmdOnboard,
  cmdRulesGenerate
};

