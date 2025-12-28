/**
 * Background Agent Processor
 * Processes queued agent tasks automatically
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

class AgentProcessor {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.queueDir = path.join(this.cwd, ".kaczmarek-ai", "agent-queue");
    this.pollInterval = options.pollInterval || 5000; // 5 seconds
    this.isRunning = false;
    this.currentTask = null;
    this.processInterval = null;
  }

  /**
   * Get formatted timestamp
   */
  getTimestamp() {
    const now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 19);
  }

  /**
   * Log with timestamp
   */
  log(message) {
    console.log(`[${this.getTimestamp()}] [Agent Processor] ${message}`);
  }

  /**
   * Error log with timestamp
   */
  error(message, error = null) {
    const timestamp = this.getTimestamp();
    console.error(`[${timestamp}] [Agent Processor] ${message}`);
    if (error) {
      console.error(`[${timestamp}] [Agent Processor]`, error);
    }
  }

  /**
   * Warn log with timestamp
   */
  warn(message) {
    console.warn(`[${this.getTimestamp()}] [Agent Processor] ${message}`);
  }

  /**
   * Start the processor
   */
  start() {
    if (this.isRunning) {
      return { success: false, error: "Processor is already running" };
    }

    this.isRunning = true;
    this.log("Agent processor started. Polling for queued tasks...");

    // Process immediately, then poll
    this.processQueue();
    this.processInterval = setInterval(() => {
      if (!this.currentTask) {
        this.processQueue();
      }
    }, this.pollInterval);

    return { success: true, message: "Processor started" };
  }

  /**
   * Stop the processor
   */
  stop() {
    if (!this.isRunning) {
      return { success: false, error: "Processor is not running" };
    }

    this.isRunning = false;
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    this.log("Agent processor stopped.");
    return { success: true, message: "Processor stopped" };
  }

  /**
   * Process the queue
   */
  async processQueue() {
    if (!fs.existsSync(this.queueDir)) {
      return;
    }

    // Get all queued tasks, sorted by creation time
    const files = fs.readdirSync(this.queueDir)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const filePath = path.join(this.queueDir, f);
        try {
          const task = JSON.parse(fs.readFileSync(filePath, "utf8"));
          return { file: f, path: filePath, task, created: task.startedAt || "0" };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .filter(t => t.task.status === "queued")
      .sort((a, b) => new Date(a.created) - new Date(b.created));

    if (files.length === 0) {
      return;
    }

    // Process the first queued task
    const nextTask = files[0];
    await this.processTask(nextTask.task, nextTask.path);
  }

  /**
   * Process a single task
   */
  async processTask(task, taskFilePath) {
    if (this.currentTask) {
      return; // Already processing
    }

    this.currentTask = task.id;

    try {
      this.log(`Processing task: ${task.id}`);
      
      // Check if task has no tasks to implement - auto-complete
      const tasksArray = Array.isArray(task.tasks) ? task.tasks : [];
      if (tasksArray.length === 0) {
        this.log(`Task ${task.id} has no tasks to implement. Auto-completing.`);
        task.status = "completed";
        task.completedAt = new Date().toISOString();
        task.readyAt = new Date().toISOString();
        task.autoCompleted = true;
        task.autoCompletedReason = "No tasks to implement";
        fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
        this.currentTask = null;
        return;
      }
      
      // If this is a Cloud Agent, just poll status (don't process locally)
      if (task.type === "cursor-cloud" && task.cloudAgentId) {
        await this.pollCloudAgentStatus(task, taskFilePath);
        return;
      }

      // Update status to processing
      task.status = "processing";
      task.processingStartedAt = new Date().toISOString();
      fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));

      // For now, we'll use Cursor Chat integration
      // In the future, this could use Cursor Cloud Agents API
      if (task.type === "cursor") {
        await this.processWithCursor(task, taskFilePath);
      } else {
        await this.processLocally(task, taskFilePath);
      }
    } catch (error) {
      this.error(`Error processing task ${task.id}: ${error.message}`, error.stack);
      try {
        task.status = "failed";
        task.error = error.message;
        task.failedAt = new Date().toISOString();
        fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
      } catch (writeError) {
        this.error(`Failed to update task file: ${writeError.message}`);
      }
    } finally {
      this.currentTask = null;
    }
  }

  /**
   * Poll Cloud Agent status (for Cloud Agents already running)
   */
  async pollCloudAgentStatus(task, taskFilePath) {
    if (!process.env.CURSOR_API_KEY) {
      this.warn(`CURSOR_API_KEY not set. Cannot poll Cloud Agent status.`);
      return;
    }

    try {
      const cursorCloudAgent = require("../modules/cursor-cloud-agent");
      const statusResult = await cursorCloudAgent.actions["get-status"]({
        agentId: task.cloudAgentId
      }, {
        logger: {
          info: (msg) => this.log(msg),
          error: (msg) => this.error(msg),
          warn: (msg) => this.warn(msg)
        }
      });

      // Update task with latest status
      task.status = statusResult.status;
      task.cloudStatus = statusResult.data;
      task.lastStatusCheck = new Date().toISOString();
      
      // Store branch information from agent status if available
      // Cursor Cloud Agents create a branch and return it in the status response
      if (statusResult.data?.branch || statusResult.data?.ref || statusResult.data?.source?.ref) {
        task.agentBranch = statusResult.data.branch || statusResult.data.ref || statusResult.data.source.ref;
        this.log(`Agent branch detected: ${task.agentBranch}`);
      }

      if (statusResult.status === "completed") {
        task.completedAt = new Date().toISOString();
        this.log(`Cloud Agent ${task.cloudAgentId} completed successfully`);
        
        // Auto-merge if enabled
        if (task.autoMerge === true) {
          await this.handleAutoMerge(task, taskFilePath);
        }
      } else if (statusResult.status === "failed") {
        task.completedAt = new Date().toISOString();
        task.error = statusResult.data?.error || "Agent failed";
        this.error(`Cloud Agent ${task.cloudAgentId} failed`);
      } else {
        this.log(`Cloud Agent ${task.cloudAgentId} status: ${statusResult.status}`);
      }

      fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
    } catch (error) {
      this.error(`Failed to poll Cloud Agent status: ${error.message}`);
    }
  }

  /**
   * Process with Cursor (create context file and log instructions)
   */
  async processWithCursor(task, taskFilePath) {
    this.log(`Task ${task.id} ready for Cursor processing`);
    
    // Ensure tasks is an array
    const tasksArray = Array.isArray(task.tasks) ? task.tasks : [];
    this.log(`Tasks to implement: ${tasksArray.length}`);
    
    // Try to execute tasks automatically
    const AgentExecutor = require("./executor");
    const executor = new AgentExecutor({ 
      cwd: this.cwd,
      logger: {
        info: (msg) => {
          // Remove duplicate [Executor] prefix if present
          const cleanMsg = msg.replace(/^\[Executor\]\s*/, "");
          this.log(`[Executor] ${cleanMsg}`);
        },
        error: (msg) => {
          const cleanMsg = msg.replace(/^\[Executor\]\s*/, "");
          this.error(`[Executor] ${cleanMsg}`);
        },
        warn: (msg) => {
          const cleanMsg = msg.replace(/^\[Executor\]\s*/, "");
          this.warn(`[Executor] ${cleanMsg}`);
        }
      }
    });

    try {
      const executionResults = await executor.executeTask(task, taskFilePath);
      
      this.log(`Execution completed:`);
      this.log(`  - Executed: ${executionResults.executed.length}`);
      this.log(`  - Failed: ${executionResults.failed.length}`);
      this.log(`  - Skipped: ${executionResults.skipped.length}`);

      // Update task with execution results
      task.executionResults = executionResults;
      task.status = executionResults.failed.length === 0 ? "ready" : "partial";
    } catch (error) {
      this.error(`Execution error: ${error.message}`);
      task.status = "ready"; // Fall back to manual processing
    }
    
    // Create a processing marker file
    const processingFile = path.join(this.cwd, ".cursor", "agent-processing.json");
    const cursorDir = path.dirname(processingFile);
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    const processingInfo = {
      taskId: task.id,
      status: task.status,
      prompt: task.prompt || "",
      tasks: tasksArray,
      executionResults: task.executionResults,
      instructions: [
        "This is a background agent task queued for implementation.",
        "Some tasks may have been executed automatically.",
        "Use the prompt and remaining tasks below to implement the features.",
        "After completing each task, update the progress file.",
        "Mark tasks as completed in the task file when done."
      ],
      startedAt: new Date().toISOString()
    };

    // Try to write context file (may fail in sandbox, that's OK)
    try {
      fs.writeFileSync(processingFile, JSON.stringify(processingInfo, null, 2));
      this.log(`Cursor context file created: ${processingFile}`);
    } catch (writeError) {
      this.warn(`Could not write context file (this is OK in some environments): ${writeError.message}`);
    }
    
    this.log(`Task ${task.id} is ready for processing.`);
    this.log(`Use Cursor Chat to process remaining tasks, or mark as complete with 'kad agent complete ${task.id}'`);
    
    // Mark as "ready" - in a full implementation, this would trigger Cursor API
    task.readyAt = new Date().toISOString();
    fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
  }

  /**
   * Process locally (fallback)
   */
  async processLocally(task, taskFilePath) {
    this.log(`Processing task ${task.id} locally`);
    this.warn(`Local processing not fully implemented.`);
    
    task.status = "ready";
    task.readyAt = new Date().toISOString();
    fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
  }

  /**
   * Handle automatic merging when agent completes
   */
  async handleAutoMerge(task, taskFilePath) {
    this.log(`Auto-merge enabled for task ${task.id}`);
    
    try {
      const gitModule = require("../modules/git");
      const mergeStrategy = task.mergeStrategy || "merge";
      
      // Try to get branch from cloud agent data
      // Cursor Cloud Agents create a branch and return it in the status response
      let branch = null;
      
      // Priority 1: Use branch stored from agent status response
      if (task.agentBranch) {
        branch = task.agentBranch;
        this.log(`Using agent branch from status: ${branch}`);
      }
      // Priority 2: Check cloudStatus for branch information
      else if (task.cloudStatus?.branch) {
        branch = task.cloudStatus.branch;
        this.log(`Using branch from cloudStatus: ${branch}`);
      }
      // Priority 3: Check cloudStatus.source.ref (the branch the agent was created on)
      else if (task.cloudStatus?.source?.ref) {
        branch = task.cloudStatus.source.ref;
        this.log(`Using source ref from cloudStatus: ${branch}`);
      }
      // Priority 4: Try to fetch latest agent status to get branch info
      else if (task.cloudAgentId && process.env.CURSOR_API_KEY) {
        this.log("Fetching latest agent status to determine branch...");
        try {
          const cursorCloudAgent = require("../modules/cursor-cloud-agent");
          const statusResult = await cursorCloudAgent.actions["get-status"]({
            agentId: task.cloudAgentId
          }, {
            logger: {
              info: () => {},
              error: () => {},
              warn: () => {}
            }
          });
          
          // Update task with latest status
          task.cloudStatus = statusResult.data;
          
          // Extract branch from status
          if (statusResult.data?.branch) {
            branch = statusResult.data.branch;
            task.agentBranch = branch;
            this.log(`Found branch from latest status: ${branch}`);
          } else if (statusResult.data?.ref) {
            branch = statusResult.data.ref;
            task.agentBranch = branch;
            this.log(`Found ref from latest status: ${branch}`);
          } else if (statusResult.data?.source?.ref) {
            branch = statusResult.data.source.ref;
            task.agentBranch = branch;
            this.log(`Found source ref from latest status: ${branch}`);
          }
        } catch (e) {
          this.warn(`Could not fetch latest agent status: ${e.message}`);
        }
      }
      
      // Priority 5: Try to infer branch from agent ID or search for it
      if (!branch && task.cloudAgentId) {
        this.warn("Could not determine branch from agent data. Attempting to find agent branch...");
        
        // Try common branch patterns that Cursor might use
        try {
          const { execSync } = require("child_process");
          
          // Fetch all remote branches first
          try {
            execSync("git fetch --all", {
              cwd: this.cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            });
          } catch (e) {
            // Fetch might fail, continue anyway
          }
          
          const branches = execSync("git branch -r", {
            cwd: this.cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          });
          
          // Look for branches that might be related to this agent
          // Cursor often creates branches with patterns like:
          // - cursor-agent-{agentId}
          // - agent-{agentId}
          // - cursor-{agentId}
          const agentIdShort = task.cloudAgentId.substring(0, 8);
          const agentIdFull = task.cloudAgentId;
          
          const branchPatterns = [
            `cursor-agent-${agentIdShort}`,
            `cursor-agent-${agentIdFull}`,
            `agent-${agentIdShort}`,
            `agent-${agentIdFull}`,
            `cursor-${agentIdShort}`,
            `cursor-${agentIdFull}`,
            agentIdShort,
            agentIdFull
          ];
          
          for (const pattern of branchPatterns) {
            // Check both remote and local branches
            const remotePattern = `origin/${pattern}`;
            const localPattern = pattern;
            
            if (branches.includes(remotePattern) || branches.includes(pattern)) {
              branch = pattern;
              task.agentBranch = branch;
              this.log(`Found potential agent branch: ${branch}`);
              break;
            }
          }
        } catch (e) {
          this.warn(`Could not search for agent branch: ${e.message}`);
        }
      }
      
      if (!branch) {
        this.warn("Could not determine branch for auto-merge. Skipping merge.");
        task.mergeAttempted = true;
        task.mergeError = "Could not determine branch from agent data";
        fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
        return;
      }
      
      this.log(`Attempting to merge branch '${branch}' with strategy '${mergeStrategy}'`);
      
      const mergeResult = await gitModule.actions["merge-branch"]({
        branch,
        cwd: this.cwd,
        strategy: mergeStrategy,
        message: `Auto-merge: Agent task ${task.id} completed`,
        push: true // Push to origin after successful merge
      }, {
        logger: {
          info: (msg) => this.log(msg),
          error: (msg) => this.error(msg),
          warn: (msg) => this.warn(msg)
        }
      });
      
      // Store merge result in task
      task.mergeAttempted = true;
      task.mergeResult = mergeResult;
      
      if (mergeResult.success) {
        this.log(`Successfully merged branch '${branch}'`);
        task.merged = true;
        task.mergedAt = new Date().toISOString();
        task.mergedBranch = branch;
      } else if (mergeResult.conflict) {
        this.warn(`Merge conflict detected for branch '${branch}'. Manual resolution required.`);
        task.mergeConflict = true;
        task.mergeBranch = branch;
      } else {
        this.error(`Failed to merge branch '${branch}': ${mergeResult.error}`);
        task.mergeError = mergeResult.error;
      }
      
      fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
    } catch (error) {
      this.error(`Error during auto-merge: ${error.message}`);
      task.mergeAttempted = true;
      task.mergeError = error.message;
      fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
    }
  }
}

module.exports = AgentProcessor;

