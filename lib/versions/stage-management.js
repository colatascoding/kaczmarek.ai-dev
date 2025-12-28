/**
 * Stage management for version folders
 */

const fs = require("fs");
const path = require("path");
const { findVersionFolder, getStagePath } = require("./file-operations");

/**
 * Get stage status
 * @param {string} versionTag - Version tag
 * @param {string} stage - Stage name (e.g., "01_plan", "02_implement")
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 * @returns {string} - Stage status: "pending", "in-progress", "completed"
 */
function getStageStatus(versionTag, stage, cwd = process.cwd(), versionsDir = "versions") {
  const stagePath = getStagePath(versionTag, stage, cwd, versionsDir);
  if (!stagePath) return "pending";

  // Check for .status file
  const statusFile = path.join(stagePath, ".status");
  if (fs.existsSync(statusFile)) {
    try {
      return fs.readFileSync(statusFile, "utf8").trim();
    } catch (e) {
      return "pending";
    }
  }

  // Check version.json for stage status
  const versionOps = require("./file-operations");
  const metadata = versionOps.readVersionMetadata(versionTag, cwd, versionsDir);
  if (metadata && metadata.stages && metadata.stages[stage.replace("0", "").replace("_", "")]) {
    return metadata.stages[stage.replace("0", "").replace("_", "")].status || "pending";
  }

  // Default: check if stage has content
  const files = fs.readdirSync(stagePath);
  return files.length > 0 ? "in-progress" : "pending";
}

/**
 * Set stage status
 * @param {string} versionTag - Version tag
 * @param {string} stage - Stage name
 * @param {string} status - Status: "pending", "in-progress", "completed"
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 */
function setStageStatus(versionTag, stage, status, cwd = process.cwd(), versionsDir = "versions") {
  const stagePath = getStagePath(versionTag, stage, cwd, versionsDir);
  if (!stagePath) {
    throw new Error(`Stage path not found for ${versionTag}/${stage}`);
  }

  // Write .status file
  const statusFile = path.join(stagePath, ".status");
  fs.writeFileSync(statusFile, status, "utf8");

  // Update version.json
  const versionOps = require("./file-operations");
  const metadata = versionOps.readVersionMetadata(versionTag, cwd, versionsDir) || {
    version: versionTag,
    major: parseInt(versionTag.split("-")[0], 10),
    minor: parseInt(versionTag.split("-")[1], 10),
    type: "minor",
    status: "in-progress",
    stages: {}
  };

  const stageKey = stage.replace("0", "").replace("_", "");
  if (!metadata.stages) {
    metadata.stages = {};
  }
  if (!metadata.stages[stageKey]) {
    metadata.stages[stageKey] = {};
  }
  metadata.stages[stageKey].status = status;
  if (status === "completed") {
    metadata.stages[stageKey].completedAt = new Date().toISOString();
  } else if (status === "in-progress") {
    metadata.stages[stageKey].startedAt = new Date().toISOString();
  }

  versionOps.writeVersionMetadata(versionTag, metadata, cwd, versionsDir);
}

/**
 * Get all stages for a version
 * @param {string} versionTag - Version tag
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 * @returns {Array} - Array of stage objects with name and status
 */
function getVersionStages(versionTag, cwd = process.cwd(), versionsDir = "versions") {
  const stages = ["01_plan", "02_implement", "03_test", "04_review"];
  return stages.map(stage => ({
    name: stage,
    status: getStageStatus(versionTag, stage, cwd, versionsDir),
    path: getStagePath(versionTag, stage, cwd, versionsDir)
  }));
}

/**
 * Validate stage completeness
 * @param {string} versionTag - Version tag
 * @param {string} stage - Stage name
 * @param {string} cwd - Current working directory
 * @param {string} versionsDir - Versions directory
 * @returns {object} - Validation result
 */
function validateStage(versionTag, stage, cwd = process.cwd(), versionsDir = "versions") {
  const stagePath = getStagePath(versionTag, stage, cwd, versionsDir);
  if (!stagePath) {
    return {
      valid: false,
      error: `Stage path not found: ${stage}`
    };
  }

  const files = fs.readdirSync(stagePath);
  const requiredFiles = {
    "01_plan": ["goals.md"],
    "02_implement": ["progress.md"],
    "03_test": [],
    "04_review": ["review.md"]
  };

  const required = requiredFiles[stage] || [];
  const missing = required.filter(file => !files.includes(file));

  return {
    valid: missing.length === 0,
    missing,
    files: files.filter(f => f !== ".status")
  };
}

module.exports = {
  getStageStatus,
  setStageStatus,
  getVersionStages,
  validateStage
};


