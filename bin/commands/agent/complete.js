/**
 * kad agent complete - Mark task as complete and update progress/review
 */

const fs = require("fs");
const path = require("path");
const { log, error } = require("../../utils");

function cmdAgentComplete(rest) {
  const taskId = rest[0];
  if (!taskId) {
    error("Task ID required. Usage: kad agent complete <task-id>");
    process.exitCode = 1;
    return;
  }

  const ModuleLoader = require("../../../lib/modules/module-loader");
  const loader = new ModuleLoader(path.join(__dirname, "..", "..", "..", "lib", "modules"));
  const action = loader.getAction("task-completion", "complete-task-workflow");

  // Find progress and review files
  const reviewDir = path.join(process.cwd(), "review");
  const progressDir = path.join(process.cwd(), "progress");
  
  let reviewFile = null;
  let progressFile = null;

  if (fs.existsSync(reviewDir)) {
    const reviewFiles = fs.readdirSync(reviewDir)
      .filter(f => f.match(/^version\d+-\d+\.md$/))
      .sort()
      .reverse();
    if (reviewFiles.length > 0) {
      reviewFile = path.join(reviewDir, reviewFiles[0]);
    }
  }

  if (fs.existsSync(progressDir)) {
    const progressFiles = fs.readdirSync(progressDir)
      .filter(f => f.match(/^version\d+-\d+\.md$/))
      .sort()
      .reverse();
    if (progressFiles.length > 0) {
      progressFile = path.join(progressDir, progressFiles[0]);
    }
  }

  action({ 
    taskId, 
    progressFile, 
    reviewFile,
    cwd: process.cwd() 
  }, {
    logger: { info: log, error, warn: log },
    executionId: taskId
  }).then(result => {
    if (result.success) {
      log(`Task ${taskId} completed successfully.`);
      log(`Progress and review files updated.`);
    } else {
      error(result.error || "Failed to complete task");
      process.exitCode = 1;
    }
  }).catch(e => {
    error(`Failed to complete task: ${String(e)}`);
    process.exitCode = 1;
  });
}

module.exports = cmdAgentComplete;



