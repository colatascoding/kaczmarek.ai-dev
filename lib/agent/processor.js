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
}

module.exports = AgentProcessor;

