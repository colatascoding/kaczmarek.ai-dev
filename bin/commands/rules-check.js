/**
 * kad rules-check command - Check for existing Cursor rules
 */

const path = require("path");
const fs = require("fs");
const { log, error } = require("../utils");

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

  // Check .cursor/rules directory
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

  // Check AGENTS.md
  if (fs.existsSync(agentsMd)) {
    results.agentsMd.exists = true;
  }

  // Check .cursorrules (legacy)
  if (fs.existsSync(cursorRules)) {
    results.cursorRules.exists = true;
  }

  log(JSON.stringify(results, null, 2));
}

module.exports = cmdRulesCheck;


