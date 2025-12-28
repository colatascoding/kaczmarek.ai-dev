/**
 * kad init command - Create kaczmarek-ai.config.json
 */

const { loadConfig, saveConfig } = require("../utils");

function cmdInit(argv) {
  const force = argv.includes("--force");
  const cwd = process.cwd();
  const baseConfig = loadConfig(cwd);
  if (!baseConfig) return;
  saveConfig(cwd, baseConfig, { force });
}

module.exports = cmdInit;


