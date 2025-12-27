/**
 * Git module - Actions for git operations
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "git",
  version: "1.0.0",
  description: "Actions for git operations",
  actions: {
    /**
     * Merge a branch into the current branch
     */
    "merge-branch": async (inputs, context) => {
      const { 
        branch, 
        cwd = process.cwd(),
        strategy = "merge", // merge, squash, rebase
        autoCommit = true,
        message = null
      } = inputs;
      const { logger } = context;

      if (!branch) {
        throw new Error("Branch name is required");
      }

      logger.info(`Merging branch '${branch}' into current branch`);

      try {
        // Check if we're in a git repository
        try {
          execSync("git rev-parse --git-dir", { cwd, stdio: "ignore" });
        } catch (e) {
          throw new Error("Not a git repository");
        }

        // Get current branch
        const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        }).trim();

        logger.info(`Current branch: ${currentBranch}`);

        // Check if branch exists (local or remote)
        let branchExists = false;
        let isRemoteBranch = false;
        let remoteBranchName = null;
        
        try {
          // Check if it's a local branch
          execSync(`git rev-parse --verify ${branch}`, {
            cwd,
            stdio: "ignore"
          });
          branchExists = true;
        } catch (e) {
          // Check if it's a remote branch
          try {
            const remoteBranches = execSync("git branch -r", {
              cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            });
            
            // Check for origin/branch or just branch in remote branches
            if (remoteBranches.includes(`origin/${branch}\n`) || remoteBranches.includes(`origin/${branch} `)) {
              branchExists = true;
              isRemoteBranch = true;
              remoteBranchName = `origin/${branch}`;
              logger.info(`Found remote branch: ${remoteBranchName}`);
            } else if (remoteBranches.includes(`${branch}\n`) || remoteBranches.includes(`${branch} `)) {
              branchExists = true;
              isRemoteBranch = true;
              remoteBranchName = branch;
              logger.info(`Found remote branch: ${remoteBranchName}`);
            }
          } catch (remoteError) {
            // Branch doesn't exist
          }
        }
        
        if (!branchExists) {
          throw new Error(`Branch '${branch}' does not exist locally or remotely`);
        }
        
        // If it's a remote branch, fetch it first and create a local tracking branch
        if (isRemoteBranch && remoteBranchName) {
          logger.info(`Fetching remote branch ${remoteBranchName}...`);
          try {
            // First, fetch all to make sure we have the latest
            execSync("git fetch origin", {
              cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            });
            
            // Try to checkout the remote branch as a local branch
            try {
              execSync(`git checkout -b ${branch} ${remoteBranchName}`, {
                cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
              });
              logger.info(`Checked out remote branch ${remoteBranchName} as local branch ${branch}`);
            } catch (checkoutError) {
              // Branch might already exist locally, try to merge the remote branch directly
              logger.info(`Using remote branch ${remoteBranchName} directly for merge`);
              branch = remoteBranchName; // Use remote branch name for merge
            }
          } catch (fetchError) {
            throw new Error(`Failed to fetch/checkout remote branch: ${fetchError.message}`);
          }
        }

        // Fetch latest changes
        logger.info("Fetching latest changes...");
        try {
          execSync("git fetch", {
            cwd,
            stdio: ["ignore", "pipe", "pipe"]
          });
        } catch (e) {
          logger.warn(`Failed to fetch: ${e.message}`);
        }

        // Check if branch is already merged
        const mergedBranches = execSync("git branch --merged", {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        });
        
        if (mergedBranches.includes(branch)) {
          logger.info(`Branch '${branch}' is already merged`);
          return {
            success: true,
            alreadyMerged: true,
            message: `Branch '${branch}' is already merged into ${currentBranch}`
          };
        }

        // Perform merge based on strategy
        let mergeCommand;
        let mergeMessage = message || `Merge branch '${branch}' (agent task completion)`;

        switch (strategy) {
          case "squash":
            mergeCommand = `git merge --squash ${branch}`;
            break;
          case "rebase":
            // Rebase is more complex, for now we'll just merge
            logger.warn("Rebase strategy not fully implemented, using merge instead");
            mergeCommand = `git merge --no-ff ${branch}`;
            break;
          case "merge":
          default:
            mergeCommand = `git merge --no-ff -m "${mergeMessage}" ${branch}`;
            break;
        }

        logger.info(`Executing: ${mergeCommand}`);
        
        try {
          execSync(mergeCommand, {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          });

          logger.info(`Successfully merged '${branch}' into ${currentBranch}`);

          return {
            success: true,
            merged: true,
            branch,
            currentBranch,
            message: `Successfully merged '${branch}' into ${currentBranch}`
          };
        } catch (mergeError) {
          // Check if it's a merge conflict
          const errorOutput = mergeError.stderr?.toString() || mergeError.message || "";
          
          if (errorOutput.includes("CONFLICT") || errorOutput.includes("conflict")) {
            logger.warn(`Merge conflict detected. Manual resolution required.`);
            return {
              success: false,
              conflict: true,
              branch,
              currentBranch,
              error: "Merge conflict detected. Please resolve conflicts manually.",
              message: `Merge conflict: Please resolve conflicts and complete the merge manually.`
            };
          } else {
            throw mergeError;
          }
        }
      } catch (error) {
        logger.error(`Failed to merge branch: ${error.message}`);
        return {
          success: false,
          error: error.message,
          message: `Failed to merge branch '${branch}': ${error.message}`
        };
      }
    },

    /**
     * Get the branch name from a cloud agent's source ref
     */
    "get-agent-branch": async (inputs, context) => {
      const { cloudAgentData, cwd = process.cwd() } = inputs;
      const { logger } = context;

      // Cloud agents typically work on a branch specified in their source
      if (cloudAgentData?.source?.ref) {
        return {
          success: true,
          branch: cloudAgentData.source.ref
        };
      }

      // Try to infer from agent ID or other metadata
      // For now, we'll return null and let the caller handle it
      logger.warn("Could not determine agent branch from cloud agent data");
      return {
        success: false,
        error: "Could not determine branch from agent data"
      };
    },

    /**
     * Commit and push changes to git repository
     */
    "commit-and-push": async (inputs, context) => {
      const { 
        paths = [],
        message,
        cwd = process.cwd(),
        push = true
      } = inputs;
      const { logger } = context;

      if (!message) {
        throw new Error("Commit message is required");
      }

      logger.info(`Committing changes: ${message}`);

      try {
        // Check if we're in a git repository
        try {
          execSync("git rev-parse --git-dir", { cwd, stdio: "ignore" });
        } catch (e) {
          throw new Error("Not a git repository");
        }

        // Stage files (if paths provided, stage only those; otherwise stage all)
        if (paths.length > 0) {
          for (const filePath of paths) {
            try {
              execSync(`git add "${filePath}"`, {
                cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
              });
            } catch (e) {
              logger.warn(`Failed to stage ${filePath}: ${e.message}`);
            }
          }
        } else {
          execSync("git add -A", {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          });
        }

        // Check if there are changes to commit
        try {
          const status = execSync("git status --porcelain", {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          }).trim();
          
          if (!status) {
            logger.info("No changes to commit");
            return {
              success: true,
              committed: false,
              message: "No changes to commit"
            };
          }
        } catch (e) {
          // Continue anyway
        }

        // Commit
        execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        });

        logger.info("Changes committed successfully");

        // Push if requested
        if (push) {
          try {
            const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
              cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            }).trim();

            execSync(`git push origin ${currentBranch}`, {
              cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            });

            logger.info(`Changes pushed to origin/${currentBranch}`);
          } catch (pushError) {
            logger.warn(`Failed to push changes: ${pushError.message}`);
            return {
              success: true,
              committed: true,
              pushed: false,
              error: pushError.message,
              message: "Changes committed but push failed"
            };
          }
        }

        return {
          success: true,
          committed: true,
          pushed: push,
          message: push ? "Changes committed and pushed successfully" : "Changes committed successfully"
        };
      } catch (error) {
        logger.error(`Failed to commit changes: ${error.message}`);
        return {
          success: false,
          error: error.message,
          message: `Failed to commit changes: ${error.message}`
        };
      }
    }
  }
};

