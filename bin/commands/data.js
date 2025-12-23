/**
 * kad data command - Delete data files (database, agent queue, or all)
 */

const fs = require("fs");
const path = require("path");
const { log, error } = require("../utils");

function cmdData(argv) {
  const [subcmd] = argv;
  const cwd = process.cwd();
  const dataDir = path.join(cwd, ".kaczmarek-ai");
  const dbPath = path.join(dataDir, "workflows.db");
  const agentQueueDir = path.join(dataDir, "agent-queue");

  if (!subcmd) {
    error("Usage: kad data <command>");
    error("");
    error("Commands:");
    error("  delete [--all|--db|--agents]  Delete data files");
    error("    --all     Delete all data (.kaczmarek-ai directory)");
    error("    --db      Delete only the database (workflows.db)");
    error("    --agents  Delete only agent queue files");
    error("");
    error("Examples:");
    error("  kad data delete --all     Delete everything");
    error("  kad data delete --db      Delete only database");
    error("  kad data delete --agents  Delete only agent queue");
    process.exitCode = 1;
    return;
  }

  if (subcmd === "delete") {
    const flag = argv[1];
    
    if (flag === "--all") {
      if (!fs.existsSync(dataDir)) {
        log("No data directory found. Nothing to delete.");
        return;
      }
      
      log("Deleting all data (.kaczmarek-ai directory)...");
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
        log("✓ All data deleted successfully.");
      } catch (e) {
        error(`Failed to delete data: ${e.message}`);
        process.exitCode = 1;
      }
      return;
    }
    
    if (flag === "--db") {
      if (!fs.existsSync(dbPath)) {
        log("No database found. Nothing to delete.");
        return;
      }
      
      log("Deleting database (workflows.db)...");
      try {
        fs.unlinkSync(dbPath);
        log("✓ Database deleted successfully.");
        log("Note: Database will be recreated with new schema on next use.");
      } catch (e) {
        error(`Failed to delete database: ${e.message}`);
        process.exitCode = 1;
      }
      return;
    }
    
    if (flag === "--agents") {
      if (!fs.existsSync(agentQueueDir)) {
        log("No agent queue directory found. Nothing to delete.");
        return;
      }
      
      log("Deleting agent queue files...");
      try {
        const files = fs.readdirSync(agentQueueDir);
        let deleted = 0;
        for (const file of files) {
          if (file.endsWith(".json")) {
            fs.unlinkSync(path.join(agentQueueDir, file));
            deleted++;
          }
        }
        log(`✓ Deleted ${deleted} agent task file(s).`);
      } catch (e) {
        error(`Failed to delete agent queue: ${e.message}`);
        process.exitCode = 1;
      }
      return;
    }
    
    // Default: show help
    error("Please specify what to delete: --all, --db, or --agents");
    process.exitCode = 1;
    return;
  }

  error(`Unknown data command: ${subcmd}`);
  process.exitCode = 1;
}

module.exports = cmdData;

