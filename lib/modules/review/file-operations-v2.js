/**
 * File operations for review module (Version 2 - New Structure)
 * Handles file operations for the new version folder structure
 */

const fs = require("fs");
const path = require("path");
const versionOps = require("../../versions/file-operations");

/**
 * Find current version in new structure
 */
async function findCurrentVersion(inputs, context) {
  const { cwd = process.cwd(), versionsDir = "versions" } = inputs;
  const { logger } = context;

  logger.info("Finding current version in new structure...");

  const versionsPath = path.join(cwd, versionsDir);
  if (!fs.existsSync(versionsPath)) {
    return {
      found: false,
      error: `Versions directory not found: ${versionsPath}`
    };
  }

  // Find all major version directories
  const majorDirs = fs.readdirSync(versionsPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith("v"))
    .map(entry => {
      const majorMatch = entry.name.match(/^v(\d+)$/);
      if (!majorMatch) return null;
      return {
        major: parseInt(majorMatch[1], 10),
        path: path.join(versionsPath, entry.name)
      };
    })
    .filter(v => v !== null)
    .sort((a, b) => b.major - a.major);

  if (majorDirs.length === 0) {
    return {
      found: false,
      error: "No version directories found"
    };
  }

  // Find latest version across all major versions
  let latestVersion = null;
  let latestMajor = -1;
  let latestMinor = -1;

  for (const majorDir of majorDirs) {
    const versionDirs = fs.readdirSync(majorDir.path, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.match(/^\d+-\d+$/))
      .map(entry => {
        const match = entry.name.match(/^(\d+)-(\d+)$/);
        if (!match) return null;
        return {
          major: parseInt(match[1], 10),
          minor: parseInt(match[2], 10),
          path: path.join(majorDir.path, entry.name)
        };
      })
      .filter(v => v !== null);

    for (const version of versionDirs) {
      if (version.major > latestMajor || 
          (version.major === latestMajor && version.minor > latestMinor)) {
        latestVersion = version;
        latestMajor = version.major;
        latestMinor = version.minor;
      }
    }
  }

  if (!latestVersion) {
    return {
      found: false,
      error: "No version folders found"
    };
  }

  const versionTag = `${latestVersion.major}-${latestVersion.minor}`;
  const versionPath = latestVersion.path;
  const reviewFile = path.join(versionPath, "04_review", "review.md");
  const progressFile = path.join(versionPath, "02_implement", "progress.md");

  return {
    found: true,
    versionTag,
    versionPath,
    reviewFile: fs.existsSync(reviewFile) ? reviewFile : null,
    progressFile: fs.existsSync(progressFile) ? progressFile : null,
    major: latestVersion.major,
    minor: latestVersion.minor
  };
}

/**
 * Read review file from new structure
 */
async function readReview(inputs, context) {
  const { reviewFile } = inputs;
  const { logger } = context;

  if (!reviewFile || !fs.existsSync(reviewFile)) {
    return {
      found: false,
      error: reviewFile ? `Review file not found: ${reviewFile}` : "No review file specified"
    };
  }

  try {
    const content = fs.readFileSync(reviewFile, "utf8");
    return {
      found: true,
      content,
      path: reviewFile
    };
  } catch (readError) {
    logger.error(`Failed to read review file ${reviewFile}: ${readError.message}`);
    return {
      found: false,
      error: `Failed to read review file: ${readError.message}`,
      path: reviewFile
    };
  }
}

/**
 * Read progress file from new structure
 */
async function readProgress(inputs, context) {
  const { progressFile } = inputs;
  const { logger } = context;

  if (!progressFile || !fs.existsSync(progressFile)) {
    return {
      found: false,
      error: progressFile ? `Progress file not found: ${progressFile}` : "No progress file specified"
    };
  }

  try {
    const content = fs.readFileSync(progressFile, "utf8");
    return {
      found: true,
      content,
      path: progressFile
    };
  } catch (readError) {
    logger.error(`Failed to read progress file ${progressFile}: ${readError.message}`);
    return {
      found: false,
      error: `Failed to read progress file: ${readError.message}`,
      path: progressFile
    };
  }
}

/**
 * Append to progress file in new structure
 */
async function appendProgress(inputs, context) {
  const { progressFile, entry } = inputs;
  const { logger } = context;

  if (!progressFile) {
    return {
      success: false,
      error: "Progress file path required"
    };
  }

  try {
    // Ensure directory exists
    const dir = path.dirname(progressFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Read existing content or create new
    let content = "";
    if (fs.existsSync(progressFile)) {
      content = fs.readFileSync(progressFile, "utf8");
    } else {
      const versionTag = path.basename(path.dirname(path.dirname(progressFile)));
      content = `# Progress Log - Version ${versionTag}\n\n`;
    }

    // Append entry
    const date = new Date().toISOString().split("T")[0];
    const newEntry = `\n## ${date}\n\n${entry}\n`;
    content += newEntry;

    fs.writeFileSync(progressFile, content, "utf8");

    logger.info(`Appended entry to ${progressFile}`);

    return {
      success: true,
      path: progressFile
    };
  } catch (error) {
    logger.error("Failed to append progress:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Append review update to review file in new structure
 */
async function appendReview(inputs, context) {
  const { reviewFile, entry } = inputs;
  const { logger } = context;

  if (!reviewFile) {
    return {
      success: false,
      error: "Review file path required"
    };
  }

  try {
    const dir = path.dirname(reviewFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Read existing content, or initialize if the file does not exist
    let content = "";
    if (fs.existsSync(reviewFile)) {
      content = fs.readFileSync(reviewFile, "utf8");
    } else {
      const versionTag = path.basename(path.dirname(path.dirname(reviewFile)));
      content = `# Version ${versionTag}\n\n**Status**: In Progress\n\n`;
    }

    const newSection = `\n\n## Automated Review Update (Claude)\n\n${entry}\n`;
    content += newSection;

    fs.writeFileSync(reviewFile, content, "utf8");

    logger.info(`Appended automated review update to ${reviewFile}`);

    return {
      success: true,
      path: reviewFile
    };
  } catch (error) {
    logger.error("Failed to append review update:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  findCurrentVersion,
  readReview,
  readProgress,
  appendProgress,
  appendReview
};

