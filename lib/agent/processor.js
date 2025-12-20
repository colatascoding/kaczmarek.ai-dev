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
   * Start the processor
   */
  start() {
    if (this.isRunning) {
      return { success: false, error: "Processor is already running" };
    }

    this.isRunning = true;
    console.log("Agent processor started. Polling for queued tasks...");

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

    console.log("Agent processor stopped.");
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
      console.log(`[Agent Processor] Processing task: ${task.id}`);
      
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
      console.error(`[Agent Processor] Error processing task ${task.id}:`, error.message);
      console.error(error.stack);
      try {
        task.status = "failed";
        task.error = error.message;
        task.failedAt = new Date().toISOString();
        fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
      } catch (writeError) {
        console.error(`[Agent Processor] Failed to update task file:`, writeError.message);
      }
    } finally {
      this.currentTask = null;
    }
  }

  /**
   * Process with Cursor (create context file and log instructions)
   */
  async processWithCursor(task, taskFilePath) {
    console.log(`[Agent Processor] Task ${task.id} ready for Cursor processing`);
    
    // Ensure tasks is an array
    const tasksArray = Array.isArray(task.tasks) ? task.tasks : [];
    console.log(`[Agent Processor] Tasks to implement: ${tasksArray.length}`);
    
    // Create a processing marker file
    const processingFile = path.join(this.cwd, ".cursor", "agent-processing.json");
    const cursorDir = path.dirname(processingFile);
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    const processingInfo = {
      taskId: task.id,
      status: "ready",
      prompt: task.prompt || "",
      tasks: tasksArray,
      instructions: [
        "This is a background agent task queued for implementation.",
        "Use the prompt and tasks below to implement the features.",
        "After completing each task, update the progress file.",
        "Mark tasks as completed in the task file when done."
      ],
      startedAt: new Date().toISOString()
    };

    // Try to write context file (may fail in sandbox, that's OK)
    try {
      fs.writeFileSync(processingFile, JSON.stringify(processingInfo, null, 2));
      console.log(`[Agent Processor] Cursor context file created: ${processingFile}`);
    } catch (writeError) {
      console.log(`[Agent Processor] Could not write context file (this is OK in some environments): ${writeError.message}`);
    }
    
    console.log(`[Agent Processor] Task ${task.id} is ready for processing.`);
    console.log(`[Agent Processor] Use Cursor Chat to process this task, or it will be handled automatically.`);
    
    // Mark as "ready" - in a full implementation, this would trigger Cursor API
    task.status = "ready";
    task.readyAt = new Date().toISOString();
    fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
  }

  /**
   * Process locally (fallback)
   */
  async processLocally(task, taskFilePath) {
    console.log(`[Agent Processor] Processing task ${task.id} locally`);
    console.log(`[Agent Processor] Local processing not fully implemented.`);
    
    task.status = "ready";
    task.readyAt = new Date().toISOString();
    fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
  }
}

module.exports = AgentProcessor;

