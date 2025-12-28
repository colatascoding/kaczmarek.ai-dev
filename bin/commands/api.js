/**
 * kad api command - Start web frontend API server
 */

const { log, error } = require("../utils");

function cmdApi(rest) {
  const subcommand = rest[0] || "start";
  
  switch (subcommand) {
    case "start": {
      const port = parseInt(rest[1]) || 3100;
      log(`Starting API server on port ${port}...`);
      log(`Open http://localhost:${port} in your browser`);
      
      try {
        const APIServer = require("../../lib/api/server");
        const server = new APIServer({ 
          port,
          cwd: process.cwd()
        });
        
        server.start();
        
        // Keep process alive
        process.on("SIGINT", () => {
          log("\nShutting down API server...");
          server.stop();
          process.exit(0);
        });
        
        // Handle server errors
        server.server.on("error", (err) => {
          if (err.code === "EADDRINUSE") {
            error(`Port ${port} is already in use. Try a different port.`);
            process.exitCode = 1;
            process.exit(1);
          } else {
            error(`Server error: ${err.message}`);
            process.exitCode = 1;
            process.exit(1);
          }
        });
      } catch (err) {
        // Handle API key validation errors and other startup errors
        if (err.message && err.message.includes("Missing required API keys")) {
          // Error message already printed by validateApiKeys()
          process.exitCode = 1;
          process.exit(1);
        } else {
          error(`Failed to start API server: ${err.message || String(err)}`);
          process.exitCode = 1;
          process.exit(1);
        }
      }
      
      break;
    }
    default:
      error(`Unknown API command: ${subcommand}`);
      error("Usage: kad api [start] [port]");
      process.exitCode = 1;
  }
}

module.exports = cmdApi;

