/**
 * kad agent start - Start background processor
 */

const { log, error } = require("../../utils");

function cmdAgentStart() {
  const AgentProcessor = require("../../../lib/agent/processor");
  const processor = new AgentProcessor({ cwd: process.cwd() });
  const result = processor.start();
  
  if (result.success) {
    log("Background agent processor started.");
    log("It will automatically process queued tasks.");
    log("Press Ctrl+C to stop.");
    
    // Keep process alive
    process.on("SIGINT", () => {
      processor.stop();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      processor.stop();
      process.exit(0);
    });
    
    // Keep running
    setInterval(() => {}, 1000);
  } else {
    error(result.error || "Failed to start processor");
    process.exitCode = 1;
  }
}

module.exports = cmdAgentStart;



