/**
 * Version management for review module (Updated for new structure)
 */

const fs = require("fs");
const path = require("path");
const versionOps = require("../../versions/file-operations");
const stageOps = require("../../versions/stage-management");
const fileOpsV2 = require("./file-operations-v2");

/**
 * Create a new version (increment minor version) - New Structure
 */
async function createNextVersion(inputs, context) {
  const { cwd = process.cwd(), versionsDir = "versions", currentVersionTag = null, incrementType = "minor" } = inputs;
  const { logger } = context;

  logger.info("Creating next version in new structure...");

  // Find current version if not provided
  let currentMajor = 0;
  let currentMinor = 0;
  let currentTag = currentVersionTag;

  if (currentVersionTag) {
    const match = currentVersionTag.match(/^version?(\d+)-(\d+)$/);
    if (match) {
      currentMajor = parseInt(match[1], 10);
      currentMinor = parseInt(match[2], 10);
    } else {
      const match2 = currentVersionTag.match(/^(\d+)-(\d+)$/);
      if (match2) {
        currentMajor = parseInt(match2[1], 10);
        currentMinor = parseInt(match2[2], 10);
      }
    }
  } else {
    // Find current version using new structure
    const versionResult = await fileOpsV2.findCurrentVersion({ cwd, versionsDir }, context);
    if (versionResult.found) {
      currentMajor = versionResult.major;
      currentMinor = versionResult.minor;
      currentTag = versionResult.versionTag;
    }
  }

  // Determine next version
  let nextMajor = currentMajor;
  let nextMinor = currentMinor + 1;
  
  if (incrementType === "major") {
    nextMajor = currentMajor + 1;
    nextMinor = 0;
  }

  const nextVersionTag = `${nextMajor}-${nextMinor}`;

  // Create version folder structure
  const versionPath = versionOps.createVersionFolder(nextVersionTag, cwd, versionsDir);
  logger.info(`Created version folder: ${versionPath}`);

  // Read current version files for template
  let reviewTemplate = "";
  let progressTemplate = "";
  
  if (currentTag) {
    const currentVersionPath = versionOps.findVersionFolder(currentTag, cwd, versionsDir);
    if (currentVersionPath) {
      const currentReviewFile = path.join(currentVersionPath, "04_review", "review.md");
      const currentProgressFile = path.join(currentVersionPath, "02_implement", "progress.md");
      
      if (fs.existsSync(currentReviewFile)) {
        reviewTemplate = fs.readFileSync(currentReviewFile, "utf8");
      }
      if (fs.existsSync(currentProgressFile)) {
        progressTemplate = fs.readFileSync(currentProgressFile, "utf8");
      }
    }
  }

  // Generate new review content
  const today = new Date().toISOString().split("T")[0];
  const reviewPath = path.join(versionPath, "04_review", "review.md");
  let newReviewContent = `# Version ${nextVersionTag}\n\n`;
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
  const progressPath = path.join(versionPath, "02_implement", "progress.md");
  let newProgressContent = `# Progress Log - Version ${nextVersionTag}\n\n`;
  newProgressContent += `## ${today}\n\n`;
  newProgressContent += `**Version Started**\n\n`;
  newProgressContent += `Starting version ${nextVersionTag} based on completion of version ${currentMajor}-${currentMinor}.\n\n`;

  // Generate goals content
  const goalsPath = path.join(versionPath, "01_plan", "goals.md");
  const goalsContent = `# Version ${nextVersionTag} Goals\n\n## Primary Objectives\n\n- [ ] Add goals for this version\n\n## Success Criteria\n\n(To be defined)\n`;

  // Write new files
  fs.writeFileSync(reviewPath, newReviewContent, "utf8");
  fs.writeFileSync(progressPath, newProgressContent, "utf8");
  fs.writeFileSync(goalsPath, goalsContent, "utf8");

  // Create version.json metadata
  const metadata = {
    version: nextVersionTag,
    major: nextMajor,
    minor: nextMinor,
    type: incrementType === "major" ? "major" : "minor",
    status: "in-progress",
    started: today,
    previousVersion: currentTag ? `${currentMajor}-${currentMinor}` : null,
    stages: {
      plan: { status: "in-progress", startedAt: today },
      implement: { status: "pending" },
      test: { status: "pending" },
      review: { status: "pending" }
    }
  };
  versionOps.writeVersionMetadata(nextVersionTag, metadata, cwd, versionsDir);

  // Create README.md
  const readmePath = path.join(versionPath, "README.md");
  const readmeContent = `# Version ${nextVersionTag}

**Status**: In Progress  
**Started**: ${today}

## Quick Links
- [Planning](./01_plan/goals.md)
- [Implementation](./02_implement/progress.md)
- [Testing](./03_test/)
- [Review](./04_review/review.md)

## Summary

Continuation from version ${currentMajor}-${currentMinor}. This version builds upon the previous version's achievements.
`;
  fs.writeFileSync(readmePath, readmeContent, "utf8");

  logger.info(`Created new version: ${nextVersionTag}`);
  logger.info(`Version folder: ${versionPath}`);

  // Mark previous version as complete
  if (currentTag) {
    const currentMetadata = versionOps.readVersionMetadata(currentTag, cwd, versionsDir);
    if (currentMetadata) {
      currentMetadata.status = "completed";
      currentMetadata.completed = today;
      if (currentMetadata.stages) {
        Object.keys(currentMetadata.stages).forEach(stageKey => {
          if (currentMetadata.stages[stageKey].status === "in-progress") {
            currentMetadata.stages[stageKey].status = "completed";
            currentMetadata.stages[stageKey].completedAt = today;
          }
        });
      }
      versionOps.writeVersionMetadata(currentTag, currentMetadata, cwd, versionsDir);
      logger.info(`Marked previous version as complete: ${currentTag}`);
    }
  }

  return {
    success: true,
    versionTag: nextVersionTag,
    versionPath,
    reviewFile: reviewPath,
    progressFile: progressPath,
    goalsFile: goalsPath,
    previousVersionTag: currentTag || `${currentMajor}-${currentMinor}`,
    major: nextMajor,
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

