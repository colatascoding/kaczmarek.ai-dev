/**
 * Review module - Actions for maintaining review/progress documentation
 */

const fileOperations = require("./file-operations");
const gitOperations = require("./git-operations");
const promptGeneration = require("./prompt-generation");
const versionManagement = require("./version-management");

module.exports = {
  name: "review",
  version: "1.0.0",
  description: "Actions for maintaining review and progress documentation",
  actions: {
    "scan-repository": gitOperations.scanRepository,
    "find-current-version": fileOperations.findCurrentVersion,
    "analyze-changes": gitOperations.analyzeChanges,
    "read-review": fileOperations.readReview,
    "read-progress": fileOperations.readProgress,
    "generate-review-prompt": promptGeneration.generateReviewPrompt,
    "append-progress": fileOperations.appendProgress,
    "append-review": fileOperations.appendReview,
    "create-next-version": versionManagement.createNextVersion,
    "check-all-tasks-complete": versionManagement.checkAllTasksComplete
  }
};
