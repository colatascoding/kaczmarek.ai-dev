/**
 * Version management for review module
 */

const fs = require("fs");
const path = require("path");

/**
 * Create a new version (increment minor version)
 */
async function createNextVersion(inputs, context) {
  const { cwd = process.cwd(), reviewDir = "review", progressDir = "progress", currentVersionTag = null } = inputs;
  const { logger } = context;

  logger.info("Creating next version...");

  // Find current version if not provided
  let currentMajor = 0;
  let currentMinor = 0;
  let currentReviewFile = null;
  let currentProgressFile = null;
  let currentTag = currentVersionTag;

  if (currentVersionTag) {
    const match = currentVersionTag.match(/^version(\d+)-(\d+)$/);
    if (match) {
      currentMajor = parseInt(match[1], 10);
      currentMinor = parseInt(match[2], 10);
      currentReviewFile = path.join(cwd, reviewDir, `${currentVersionTag}.md`);
      currentProgressFile = path.join(cwd, progressDir, `${currentVersionTag}.md`);
    }
  } else {
    // Find current version - need to import the action
    const fileOps = require("./file-operations");
    const versionResult = await fileOps.findCurrentVersion({ cwd, reviewDir, progressDir }, context);
    if (versionResult.found) {
      currentMajor = versionResult.major;
      currentMinor = versionResult.minor;
      currentReviewFile = versionResult.reviewFile;
      currentProgressFile = versionResult.progressFile;
      currentTag = versionResult.versionTag;
    }
  }

  // Increment minor version
  const nextMinor = currentMinor + 1;
  const nextVersionTag = `version${currentMajor}-${nextMinor}`;

  const reviewPath = path.join(cwd, reviewDir);
  const progressPath = path.join(cwd, progressDir);

  // Read current review to use as template
  let reviewTemplate = "";
  if (currentReviewFile && fs.existsSync(currentReviewFile)) {
    reviewTemplate = fs.readFileSync(currentReviewFile, "utf8");
  }

  // Read current progress to use as template
  let progressTemplate = "";
  if (currentProgressFile && fs.existsSync(currentProgressFile)) {
    progressTemplate = fs.readFileSync(currentProgressFile, "utf8");
  }

  // Create new review file
  const newReviewFile = path.join(reviewPath, `${nextVersionTag}.md`);
  const newProgressFile = path.join(progressPath, `${nextVersionTag}.md`);

  // Generate new review content
  const today = new Date().toISOString().split("T")[0];
  let newReviewContent = `# Version ${currentMajor}-${nextMinor}\n\n`;
  newReviewContent += `**Status**: In Progress  \n`;
  newReviewContent += `**Started**: ${today}\n\n`;
  newReviewContent += `## Summary\n\n`;
  newReviewContent += `Continuation from version ${currentMajor}-${currentMinor}. `;
  newReviewContent += `This version builds upon the previous version's achievements.\n\n`;
  newReviewContent += `## Goals\n\n`;
  newReviewContent += `- [ ] Add goals for this version\n\n`;
  newReviewContent += `## Changes\n\n`;
  newReviewContent += `### Major Features\n\n`;
  newReviewContent += `(To be filled as work progresses)\n\n`;
  newReviewContent += `## Next Steps\n\n`;
  newReviewContent += `- [ ] Add next steps for this version\n\n`;

  // Generate new progress content
  let newProgressContent = `# Progress Log - ${nextVersionTag}\n\n`;
  newProgressContent += `## ${today}\n\n`;
  newProgressContent += `**Version Started**\n\n`;
  newProgressContent += `Starting version ${nextVersionTag} based on completion of version ${currentMajor}-${currentMinor}.\n\n`;

  // Write new files
  if (!fs.existsSync(reviewPath)) {
    fs.mkdirSync(reviewPath, { recursive: true });
  }
  if (!fs.existsSync(progressPath)) {
    fs.mkdirSync(progressPath, { recursive: true });
  }

  fs.writeFileSync(newReviewFile, newReviewContent, "utf8");
  fs.writeFileSync(newProgressFile, newProgressContent, "utf8");

  logger.info(`Created new version: ${nextVersionTag}`);
  logger.info(`Review file: ${newReviewFile}`);
  logger.info(`Progress file: ${newProgressFile}`);

  // Optionally mark previous version as complete
  if (currentReviewFile && fs.existsSync(currentReviewFile)) {
    let prevReview = fs.readFileSync(currentReviewFile, "utf8");
    // Update status to Complete
    prevReview = prevReview.replace(/\*\*Status\*\*:\s*In Progress/, "**Status**: Complete");
    // Add completion date
    if (!prevReview.includes("**Completed**:")) {
      prevReview = prevReview.replace(/(\*\*Started\*\*:\s*\d{4}-\d{2}-\d{2})/, `$1\n**Completed**: ${today}`);
    }
    fs.writeFileSync(currentReviewFile, prevReview, "utf8");
    logger.info(`Marked previous version as complete: ${currentTag || currentVersionTag}`);
  }

  return {
    success: true,
    versionTag: nextVersionTag,
    reviewFile: newReviewFile,
    progressFile: newProgressFile,
    previousVersionTag: currentVersionTag || `version${currentMajor}-${currentMinor}`,
    major: currentMajor,
    minor: nextMinor
  };
}

/**
 * Check if all tasks in review are completed
 */
async function checkAllTasksComplete(inputs, context) {
  const { reviewFile } = inputs;
  const { logger } = context;

  if (!fs.existsSync(reviewFile)) {
    return {
      success: false,
      error: `Review file not found: ${reviewFile}`
    };
  }

  const content = fs.readFileSync(reviewFile, "utf8");
  const lines = content.split("\n");

  let inNextSteps = false;
  let totalTasks = 0;
  let completedTasks = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Find "Next Steps" section
    if (line.match(/^#+\s*Next\s+Steps/i)) {
      inNextSteps = true;
      continue;
    }

    // Stop at next major section
    if (inNextSteps && line.match(/^##\s+/)) {
      break;
    }

    // Count tasks
    if (inNextSteps) {
      const taskMatch = line.match(/^[-*]\s*(\[[\sx]\]\s*)?(.+)$/i);
      if (taskMatch) {
        totalTasks++;
        const isCompleted = taskMatch[1] && taskMatch[1].includes("x");
        if (isCompleted) {
          completedTasks++;
        }
      }
    }
  }

  const allComplete = totalTasks > 0 && completedTasks === totalTasks;

  logger.info(`Tasks: ${completedTasks}/${totalTasks} completed`);

  return {
    success: true,
    allComplete,
    totalTasks,
    completedTasks,
    remainingTasks: totalTasks - completedTasks
  };
}

module.exports = {
  createNextVersion,
  checkAllTasksComplete
};

