/**
 * Review module - Actions for maintaining review/progress documentation
 * Updated for new version folder structure
 */

const fileOperationsV2 = require("./file-operations-v2");
const gitOperations = require("./git-operations");
const promptGeneration = require("./prompt-generation");
const versionManagement = require("./version-management");
const { loadConfig } = require("../../../bin/utils");
const fs = require("fs");
const path = require("path");

/**
 * Determine which file operations to use based on structure
 */
function getFileOperations(cwd) {
  const config = loadConfig(cwd);
  const versionsDir = config?.docs?.versionsDir || "versions";
  const versionsPath = path.join(cwd, versionsDir);
  
  // Check if new structure exists
  if (fs.existsSync(versionsPath)) {
    return fileOperationsV2;
  }
  
  // Fallback to old structure (for transition)
  const fileOperations = require("./file-operations");
  return fileOperations;
}

/**
 * Wrapper for find-current-version that auto-detects structure
 */
async function findCurrentVersion(inputs, context) {
  const { cwd = process.cwd() } = inputs;
  const fileOps = getFileOperations(cwd);
  const config = loadConfig(cwd);
  
  // Use new structure if versionsDir is configured
  if (config?.docs?.versionsDir) {
    return fileOps.findCurrentVersion({
      ...inputs,
      versionsDir: config.docs.versionsDir
    }, context);
  }
  
  // Fallback to old structure
  return fileOps.findCurrentVersion(inputs, context);
}

module.exports = {
  name: "review",
  version: "2.0.0",
  description: "Actions for maintaining review and progress documentation",
  actions: {
    "scan-repository": gitOperations.scanRepository,
    "find-current-version": findCurrentVersion,
    "analyze-changes": gitOperations.analyzeChanges,
    "read-review": async (inputs, context) => {
      const { cwd = process.cwd() } = inputs;
      const fileOps = getFileOperations(cwd);
      return fileOps.readReview(inputs, context);
    },
    "read-progress": async (inputs, context) => {
      const { cwd = process.cwd() } = inputs;
      const fileOps = getFileOperations(cwd);
      return fileOps.readProgress(inputs, context);
    },
    "generate-review-prompt": promptGeneration.generateReviewPrompt,
    "append-progress": async (inputs, context) => {
      const { cwd = process.cwd() } = inputs;
      const fileOps = getFileOperations(cwd);
      return fileOps.appendProgress(inputs, context);
    },
    "append-review": async (inputs, context) => {
      const { cwd = process.cwd() } = inputs;
      const fileOps = getFileOperations(cwd);
      return fileOps.appendReview(inputs, context);
    },
    "create-next-version": versionManagement.createNextVersion,
    "check-all-tasks-complete": versionManagement.checkAllTasksComplete
  }
};
