/**
 * Git operations for review module
 */

const { execSync } = require("child_process");

/**
 * Scan repository and get summary
 */
async function scanRepository(inputs, context) {
  const { cwd = process.cwd() } = inputs;
  const { logger } = context;

  logger.info("Scanning repository...");

  try {
    // Run kad scan
    const scanOutput = execSync("node bin/kad.js scan", {
      cwd,
      encoding: "utf8"
    });

    const summary = JSON.parse(scanOutput);

    return {
      success: true,
      summary
    };
  } catch (error) {
    logger.error("Failed to scan repository:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze recent changes using git
 */
async function analyzeChanges(inputs, context) {
  const { cwd = process.cwd(), days = 7 } = inputs;
  const { logger } = context;

  const daysNum = typeof days === "string" ? parseInt(days, 10) : (days || 7);
  logger.info(`Analyzing changes from last ${daysNum} days...`);

  try {
    // Check if git is available
    try {
      execSync("git --version", { cwd, stdio: "ignore" });
    } catch {
      return {
        success: false,
        error: "Git is not available or not a git repository"
      };
    }

    // Get git log
    const since = new Date();
    since.setDate(since.getDate() - daysNum);
    const sinceStr = since.toISOString().split("T")[0];

    let logOutput = "";
    try {
      logOutput = execSync(
        `git log --since="${sinceStr}" --pretty=format:"%h|%ad|%s" --date=short`,
        { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      ).trim();
    } catch (error) {
      // No commits in range or other git error
      logOutput = "";
    }

    const commits = logOutput
      .split("\n")
      .filter(line => line.trim())
      .map(line => {
        const [hash, date, ...messageParts] = line.split("|");
        return {
          hash,
          date,
          message: messageParts.join("|")
        };
      });

    // Get changed files (only if we have commits)
    let changedFiles = [];
    if (commits.length > 0) {
      try {
        const diffOutput = execSync(
          `git diff --name-status HEAD~${Math.min(commits.length, 10)}..HEAD`,
          { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        ).trim();
        
        changedFiles = diffOutput
          .split("\n")
          .filter(line => line.trim())
          .map(line => {
            const [status, ...fileParts] = line.split(/\s+/);
            return {
              status: status.charAt(0), // M, A, D, etc.
              file: fileParts.join(" ")
            };
          });
      } catch (error) {
        // Ignore diff errors
        logger.warn("Could not get file changes:", error.message);
      }
    }

    return {
      success: true,
      commits,
      changedFiles,
      commitCount: commits.length,
      fileCount: changedFiles.length
    };
  } catch (error) {
    logger.error("Failed to analyze changes:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  scanRepository,
  analyzeChanges
};


