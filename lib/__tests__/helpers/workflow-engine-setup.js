/**
 * Test setup helper for workflow engine tests
 */

const WorkflowEngine = require("../../workflow/engine");
const WorkflowDatabase = require("../../db/database");
const ModuleLoader = require("../../modules/module-loader");
const path = require("path");
const fs = require("fs");

/**
 * Create a test workflow engine
 */
function createTestEngine() {
  const cwd = path.join(__dirname, "../../../test-temp");
  if (!fs.existsSync(cwd)) {
    fs.mkdirSync(cwd, { recursive: true });
  }
  
  const testDbPath = path.join(cwd, ".kaczmarek-ai", "test-workflows.db");
  const dbDir = path.dirname(testDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Remove existing test DB
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  const db = new WorkflowDatabase(testDbPath);
  const modulesDir = path.resolve(__dirname, "..", "..", "modules");
  const loader = new ModuleLoader(modulesDir);
  const engine = new WorkflowEngine({ cwd, db, moduleLoader: loader });
  
  return { engine, db, testDbPath, cwd };
}

/**
 * Cleanup test environment
 */
function cleanupTest(testDbPath, cwd) {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (fs.existsSync(cwd)) {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

module.exports = {
  createTestEngine,
  cleanupTest
};



