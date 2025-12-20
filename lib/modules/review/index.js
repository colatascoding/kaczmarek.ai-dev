/**
 * Review module - Actions for maintaining review/progress documentation
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

module.exports = {
  name: "review",
  version: "1.0.0",
  description: "Actions for maintaining review and progress documentation",
  actions: {
    /**
     * Scan repository and get summary
     */
    "scan-repository": async (inputs, context) => {
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
    },

    /**
     * Find current review and progress files
     */
    "find-current-version": async (inputs, context) => {
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
    },

    /**
     * Analyze recent changes using git
     */
    "analyze-changes": async (inputs, context) => {
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
    },

    /**
     * Read review file
     */
    "read-review": async (inputs, context) => {
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
    },

    /**
     * Read progress file
     */
    "read-progress": async (inputs, context) => {
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
    },

    /**
     * Generate review update prompt
     */
    "generate-review-prompt": async (inputs, context) => {
      const { summary, changes, reviewContent, progressContent, versionTag } = inputs;
      const { logger } = context;

      logger.info("Generating review update prompt...");

      // Ensure we have proper values (not template strings)
      const summaryObj = typeof summary === "object" ? summary : {};
      const changesObj = typeof changes === "object" && !changes.includes ? changes : {};

      const prompt = [
        "You are an AI development assistant (kaczmarek.ai-dev style).",
        "",
        "You are helping maintain the *current* version review and progress log for this repository.",
        "",
        "Your work MUST align with the kaczmarek.ai-dev concept documented in `docs/concept.md`.",
        "",
        `Current version tag: ${versionTag || "unknown"}`,
        "",
        "Repository summary:",
        "```json",
        JSON.stringify(summaryObj, null, 2),
        "```",
        "",
        "Recent changes:",
        "```json",
        JSON.stringify(changesObj, null, 2),
        "```",
        "",
        "Current review file content:",
        "```markdown",
        reviewContent || "(empty or not found)",
        "```",
        "",
        progressContent ? "Current progress file content:" : "",
        progressContent ? "```markdown" : "",
        progressContent || "",
        progressContent ? "```" : "",
        "",
        "Goals:",
        "- Use the current review file to keep a high-level, curated summary of what changed, risks, and next steps.",
        "- Use the current progress file as a detailed, chronological log of implementation work and verification steps.",
        "- Propose specific edits or additions to these files that keep them consistent with each other and with the underlying codebase.",
        "- Align any suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
        "",
        "Output:",
        "- A short high-level analysis of the current review/progress pair and any obvious gaps.",
        "- A concise list of next edits (1–5 items) to apply to the review and/or progress files.",
        "- Suggested concrete text snippets or bullet points for those edits where helpful."
      ].filter(Boolean).join("\n");

      // Also log the prompt for visibility
      logger.info("Generated review prompt:");
      logger.info("=".repeat(80));
      logger.info(prompt);
      logger.info("=".repeat(80));

      return {
        success: true,
        prompt
      };
    },

    /**
     * Append to progress file
     */
    "append-progress": async (inputs, context) => {
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
  }
};

