/**
 * Agent Debugging Utilities
 */

const fs = require("fs");
const path = require("path");

class AgentDebugger {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
  }

  /**
   * Get detailed information about a task
   */
  getTaskDetails(taskId) {
    const taskFile = path.join(this.queueDir, `${taskId}.json`);
    
    if (!fs.existsSync(taskFile)) {
      return { error: `Task file not found: ${taskFile}` };
    }

    try {
      const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));
      
      return {
        id: task.id,
        status: task.status,
        type: task.type,
        createdAt: task.startedAt,
        processingStartedAt: task.processingStartedAt,
        readyAt: task.readyAt,
        failedAt: task.failedAt,
        error: task.error,
        tasksCount: Array.isArray(task.tasks) ? task.tasks.length : 0,
        tasks: task.tasks || [],
        promptLength: task.prompt ? task.prompt.length : 0,
        hasPrompt: !!task.prompt,
        cwd: task.cwd,
        maxIterations: task.maxIterations
      };
    } catch (e) {
      return { error: `Failed to parse task file: ${e.message}` };
    }
  }

  /**
   * List all tasks with detailed status
   */
  listAllTasks() {
    if (!fs.existsSync(this.queueDir)) {
      return [];
    }

    const files = fs.readdirSync(this.queueDir)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const taskId = f.replace(".json", "");
        return this.getTaskDetails(taskId);
      })
      .filter(t => !t.error);

    return files;
  }

  /**
   * Get failed tasks
   */
  getFailedTasks() {
    return this.listAllTasks().filter(t => t.status === "failed");
  }

  /**
   * Get task logs/history
   */
  getTaskHistory(taskId) {
    const task = this.getTaskDetails(taskId);
    if (task.error) {
      return { error: task.error };
    }

    const history = [];
    
    if (task.createdAt) {
      history.push({ timestamp: task.createdAt, event: "created", status: "queued" });
    }
    
    if (task.processingStartedAt) {
      history.push({ timestamp: task.processingStartedAt, event: "processing_started", status: "processing" });
    }
    
    if (task.readyAt) {
      history.push({ timestamp: task.readyAt, event: "ready", status: "ready" });
    }
    
    if (task.failedAt) {
      history.push({ 
        timestamp: task.failedAt, 
        event: "failed", 
        status: "failed",
        error: task.error
      });
    }

    return {
      taskId,
      currentStatus: task.status,
      history,
      error: task.error
    };
  }

  /**
   * Analyze why a task failed
   */
  analyzeFailure(taskId) {
    const task = this.getTaskDetails(taskId);
    
    if (task.error) {
      return {
        taskId,
        status: task.status,
        error: task.error,
        analysis: this.analyzeError(task.error),
        suggestions: this.getSuggestions(task.error, task)
      };
    }

    return {
      taskId,
      status: task.status,
      message: "No error found. Task may not have failed yet."
    };
  }

  /**
   * Analyze error message
   */
  analyzeError(errorMessage) {
    if (!errorMessage) return null;

    const analysis = {
      type: "unknown",
      details: []
    };

    if (errorMessage.includes("EPERM") || errorMessage.includes("permission")) {
      analysis.type = "permission_error";
      analysis.details.push("File system permission issue");
      analysis.details.push("May be running in sandboxed environment");
    }

    if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
      analysis.type = "file_not_found";
      analysis.details.push("Required file or directory not found");
    }

    if (errorMessage.includes("JSON") || errorMessage.includes("parse")) {
      analysis.type = "parse_error";
      analysis.details.push("Failed to parse JSON data");
    }

    if (errorMessage.includes("module") || errorMessage.includes("require")) {
      analysis.type = "module_error";
      analysis.details.push("Module loading or import error");
    }

    return analysis;
  }

  /**
   * Get suggestions for fixing errors
   */
  getSuggestions(errorMessage, task) {
    const suggestions = [];

    if (errorMessage && errorMessage.includes("EPERM")) {
      suggestions.push("Permission error: This is normal in sandboxed environments");
      suggestions.push("The task is still marked as 'ready' and can be processed");
      suggestions.push("Try running outside sandbox or with proper permissions");
    }

    if (task && !task.hasPrompt) {
      suggestions.push("Task missing prompt - may have been created incorrectly");
    }

    if (task && task.tasksCount === 0) {
      suggestions.push("Task has no implementation tasks - check workflow configuration");
    }

    return suggestions;
  }
}

module.exports = AgentDebugger;




