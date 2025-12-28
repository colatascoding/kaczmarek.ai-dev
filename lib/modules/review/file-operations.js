/**
 * File operations for review module
 */

const fs = require("fs");
const path = require("path");

/**
 * Find current review and progress files
 */
async function findCurrentVersion(inputs, context) {
  const { cwd = process.cwd(), reviewDir = "review", progressDir = "progress" } = inputs;
  const { logger } = context;

  logger.info("Finding current version files...");

  const reviewPath = path.join(cwd, reviewDir);
  const progressPath = path.join(cwd, progressDir);

  if (!fs.existsSync(reviewPath)) {
    return {
      found: false,
      error: `Review directory not found: ${reviewPath}`
    };
  }

  // Find version files
  const reviewFiles = fs.readdirSync(reviewPath)
    .filter(f => f.match(/^version\d+-\d+\.md$/))
    .map(f => {
      const match = f.match(/^version(\d+)-(\d+)\.md$/);
      return {
        file: f,
        path: path.join(reviewPath, f),
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10)
      };
    })
    .sort((a, b) => {
      if (a.major !== b.major) return b.major - a.major;
      return b.minor - a.minor;
    });

  if (reviewFiles.length === 0) {
    return {
      found: false,
      error: "No version review files found"
    };
  }

  const latest = reviewFiles[0];
  const versionTag = `version${latest.major}-${latest.minor}`;
  const progressFile = path.join(progressPath, `${versionTag}.md`);

  return {
    found: true,
    versionTag,
    reviewFile: latest.path,
    progressFile: fs.existsSync(progressFile) ? progressFile : null,
    major: latest.major,
    minor: latest.minor
  };
}

/**
 * Read review file
 */
async function readReview(inputs, context) {
  const { reviewFile } = inputs;
  const { logger } = context;

  if (!fs.existsSync(reviewFile)) {
    return {
      found: false,
      error: `Review file not found: ${reviewFile}`
    };
  }

  const content = fs.readFileSync(reviewFile, "utf8");

  return {
    found: true,
    content,
    path: reviewFile
  };
}

/**
 * Read progress file
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

  const content = fs.readFileSync(progressFile, "utf8");

  return {
    found: true,
    content,
    path: progressFile
  };
}

/**
 * Append to progress file
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
      const versionTag = path.basename(progressFile, ".md");
      content = `# Progress Log - ${versionTag}\n\n`;
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
 * Append Claude-generated review update directly to the review file.
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

    // Read existing content, or initialize a minimal header if the file does not exist
    let content = "";
    if (fs.existsSync(reviewFile)) {
      content = fs.readFileSync(reviewFile, "utf8");
    } else {
      const baseName = path.basename(reviewFile, ".md");
      content = `# ${baseName}\n\n`;
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


