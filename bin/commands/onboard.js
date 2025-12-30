/**
 * kad onboard command - Interactive onboarding wizard to set up your project
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { loadConfig, log, error } = require("../utils");
const cmdInit = require("./init");
const cmdScan = require("./scan");
const cmdRulesGenerate = require("./rules-generate");

function cmdOnboard() {
  const cwd = process.cwd();

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

module.exports = cmdOnboard;



