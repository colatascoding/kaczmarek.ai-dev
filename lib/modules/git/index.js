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
        message = null,
        push = true // Push to origin after successful merge
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

        // Fetch first to ensure we have latest remote branch information
        logger.info("Fetching latest remote branches...");
        try {
          execSync("git fetch origin", {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          });
        } catch (fetchErr) {
          logger.warn(`Failed to fetch: ${fetchErr.message}`);
          // Continue anyway - might still work
        }
        
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
          logger.info(`Found local branch: ${branch}`);
        } catch (e) {
          // Check if it's a remote branch - use more robust checking
          try {
            // First try using git ls-remote which is more reliable
            try {
              const lsRemote = execSync(`git ls-remote --heads origin ${branch}`, {
                cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
              });
              if (lsRemote.trim()) {
                branchExists = true;
                isRemoteBranch = true;
                remoteBranchName = `origin/${branch}`;
                logger.info(`Found remote branch via ls-remote: ${remoteBranchName}`);
              }
            } catch (lsRemoteError) {
              // Fall back to branch -r method
              const remoteBranches = execSync("git branch -r", {
                cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
              });
              
              // Split by newlines and check each branch more carefully
              const branchLines = remoteBranches.split("\n").map(line => line.trim()).filter(line => line);
              
              // Check for origin/branch pattern
              const originBranchPattern = `origin/${branch}`;
              if (branchLines.some(line => line === originBranchPattern || line.startsWith(originBranchPattern + " "))) {
                branchExists = true;
                isRemoteBranch = true;
                remoteBranchName = originBranchPattern;
                logger.info(`Found remote branch: ${remoteBranchName}`);
              } else {
                // Check for branch without origin prefix (other remotes)
                const branchMatch = branchLines.find(line => 
                  line.endsWith(`/${branch}`) || 
                  line === branch ||
                  line.split("/").pop() === branch
                );
                if (branchMatch) {
                  branchExists = true;
                  isRemoteBranch = true;
                  remoteBranchName = branchMatch;
                  logger.info(`Found remote branch: ${remoteBranchName}`);
                }
              }
            }
          } catch (remoteError) {
            // Branch doesn't exist - will throw error below
            logger.warn(`Branch check failed: ${remoteError.message}`);
          }
        }
        
        if (!branchExists) {
          // Try one more time with a direct fetch of the specific branch
          logger.info(`Branch not found, attempting to fetch ${branch} directly...`);
          try {
            execSync(`git fetch origin ${branch}:refs/remotes/origin/${branch}`, {
              cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            });
            // Check again after fetch
            try {
              execSync(`git rev-parse --verify origin/${branch}`, {
                cwd,
                stdio: "ignore"
              });
              branchExists = true;
              isRemoteBranch = true;
              remoteBranchName = `origin/${branch}`;
              logger.info(`Found remote branch after direct fetch: ${remoteBranchName}`);
            } catch (e) {
              // Still not found
            }
          } catch (fetchBranchError) {
            // Fetch failed, branch probably doesn't exist
          }
          
          if (!branchExists) {
            throw new Error(`Branch '${branch}' does not exist locally or remotely`);
          }
        }
        
        // If it's a remote branch, fetch it first and create a local tracking branch
        // Use a local variable for the branch to merge (don't reassign the parameter)
        let branchToMerge = branch;
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
              branchToMerge = branch; // Use local branch name
            } catch (checkoutError) {
              // Branch might already exist locally, try to merge the remote branch directly
              logger.info(`Using remote branch ${remoteBranchName} directly for merge`);
              branchToMerge = remoteBranchName; // Use remote branch name for merge
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

        // Check if branch is already merged using a more accurate method
        // Use git merge-base to check if branch is an ancestor of current branch
        let isAlreadyMerged = false;
        try {
          // Get the commit hash of the branch tip
          let branchCommit;
          branchCommit = execSync(`git rev-parse ${branchToMerge}`, {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          }).trim();
          
          // Get current branch commit
          const currentCommit = execSync("git rev-parse HEAD", {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          }).trim();
          
          // Check if branch commit is an ancestor of current branch
          // If merge-base of branch and current equals branch, then branch is already merged
          const mergeBase = execSync(`git merge-base ${branchCommit} ${currentCommit}`, {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          }).trim();
          
          if (mergeBase === branchCommit) {
            isAlreadyMerged = true;
          }
        } catch (mergeBaseError) {
          // If we can't determine, fall back to checking git branch --merged
          try {
            const mergedBranches = execSync("git branch --merged", {
              cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            });
            // More precise check: branch name should appear as a separate line or word
            const branchPattern = new RegExp(`(^|\\s)${branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|\\*)`, 'm');
            if (branchPattern.test(mergedBranches)) {
              isAlreadyMerged = true;
            }
          } catch (e) {
            // If both checks fail, assume not merged and try to merge
            logger.warn(`Could not determine if branch is merged: ${e.message}`);
          }
        }
        
        if (isAlreadyMerged) {
          logger.info(`Branch '${branch}' is already merged into ${currentBranch}`);
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
            mergeCommand = `git merge --squash ${branchToMerge}`;
            break;
          case "rebase":
            // Rebase is more complex, for now we'll just merge
            logger.warn("Rebase strategy not fully implemented, using merge instead");
            mergeCommand = `git merge --no-ff ${branchToMerge}`;
            break;
          case "merge":
          default:
            mergeCommand = `git merge --no-ff -m "${mergeMessage}" ${branchToMerge}`;
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

          // Push to origin if requested and merge was successful
          let pushed = false;
          let pushError = null;
          if (push) {
            try {
              logger.info(`Pushing merged changes to origin/${currentBranch}...`);
              execSync(`git push origin ${currentBranch}`, {
                cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
              });
              pushed = true;
              logger.info(`Successfully pushed to origin/${currentBranch}`);
            } catch (pushErr) {
              pushError = pushErr.message;
              logger.warn(`Failed to push to origin: ${pushError}`);
              // Don't fail the merge if push fails - merge was successful
            }
          }

          return {
            success: true,
            merged: true,
            branch: branch, // Original branch name
            branchMerged: branchToMerge, // Actual branch that was merged
            currentBranch,
            pushed: pushed,
            pushError: pushError,
            message: pushed 
              ? `Successfully merged '${branchToMerge}' into ${currentBranch} and pushed to origin`
              : pushError
                ? `Successfully merged '${branchToMerge}' into ${currentBranch} (push to origin failed: ${pushError})`
                : `Successfully merged '${branchToMerge}' into ${currentBranch}`
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

