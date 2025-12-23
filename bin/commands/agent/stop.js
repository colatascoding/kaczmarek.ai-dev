/**
 * kad agent stop - Stop background processor
 */

const fs = require("fs");
const path = require("path");
const { log, error } = require("../../utils");

function cmdAgentStop() {
  const pidFile = path.join(process.cwd(), ".kaczmarek-ai", "agent-processor.pid");
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, "utf8"), 10);
    try {
      process.kill(pid, "SIGTERM");
      fs.unlinkSync(pidFile);
      log("Background agent processor stopped.");
    } catch (e) {
      error(`Failed to stop processor: ${e.message}`);
      process.exitCode = 1;
    }
  } else {
    log("No background processor is running.");
  }
}

module.exports = cmdAgentStop;

