/**
 * kad scan command - Print JSON summary of docs/review/progress + AI folders
 */

const { loadConfig, buildSummary, log } = require("../utils");

function cmdScan() {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  if (!config) return;

  const summary = buildSummary(cwd, config);
  log(JSON.stringify(summary, null, 2));
}

module.exports = cmdScan;

