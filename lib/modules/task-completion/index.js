/**
 * Task Completion Module - Handles task completion and progress updates
 */

const fs = require("fs");
const path = require("path");

const actions = {
  /**
   * Mark an agent task as completed
   */
  "mark-task-complete": async (inputs, context) => {
    const { taskId, cwd = process.cwd(), results = {} } = inputs;
    const { logger } = context;

    logger.info(`Marking task ${taskId} as completed`);

    const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
    const taskFile = path.join(queueDir, `${taskId}.json`);

    if (!fs.existsSync(taskFile)) {
      return {
        success: false,
        error: `Task file not found: ${taskFile}`
      };
    }

    const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));
    
    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.results = results;
    
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2));

    logger.info(`Task ${taskId} marked as completed`);

    return {
      success: true,
      taskId,
      completedAt: task.completedAt
    };
  },

  /**
   * Update progress file with task completion
   */
  "update-progress-on-completion": async (inputs, context) => {
    const { taskId, progressFile, cwd = process.cwd() } = inputs;
    const { logger } = context;

    logger.info(`Updating progress file for task ${taskId}`);

    const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
    const taskFile = path.join(queueDir, `${taskId}.json`);

    if (!fs.existsSync(taskFile)) {
      return {
        success: false,
        error: `Task file not found: ${taskFile}`
      };
    }

    const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));

    if (!progressFile || !fs.existsSync(progressFile)) {
      logger.warn("Progress file not found, skipping update");
      return {
        success: false,
        error: "Progress file not found"
      };
    }

    // Read current progress
    const progressContent = fs.readFileSync(progressFile, "utf8");
    
    // Create completion entry
    const today = new Date().toISOString().split("T")[0];
    const entry = `\n## ${today}\n\n**Task Completed: ${taskId}**\n\n`;
    
    let tasksSummary = "";
    if (task.tasks && Array.isArray(task.tasks)) {
      tasksSummary = "Completed tasks:\n";
      task.tasks.forEach((t, i) => {
        tasksSummary += `- ${t.description || t.text || t.id || `Task ${i + 1}`}\n`;
      });
    }

    const resultsSummary = task.results 
      ? `\nResults: ${JSON.stringify(task.results, null, 2)}\n`
      : "";

    const fullEntry = entry + tasksSummary + resultsSummary;

    // Append to progress file
    fs.appendFileSync(progressFile, fullEntry);

    logger.info(`Progress file updated: ${progressFile}`);

    return {
      success: true,
      progressFile,
      entry: fullEntry
    };
  },

  /**
   * Mark review tasks as completed
   */
  "mark-review-tasks-complete": async (inputs, context) => {
    const { taskId, reviewFile, cwd = process.cwd() } = inputs;
    const { logger } = context;

    logger.info(`Marking review tasks as completed for task ${taskId}`);

    const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
    const taskFile = path.join(queueDir, `${taskId}.json`);

    if (!fs.existsSync(taskFile)) {
      return {
        success: false,
        error: `Task file not found: ${taskFile}`
      };
    }

    const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));

    if (!reviewFile || !fs.existsSync(reviewFile)) {
      logger.warn("Review file not found, skipping update");
      return {
        success: false,
        error: "Review file not found"
      };
    }

    // Read review file
    let reviewContent = fs.readFileSync(reviewFile, "utf8");
    const lines = reviewContent.split("\n");

    // Find and mark tasks as completed
    let inNextSteps = false;
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Find "Next Steps" section
      if (line.match(/^#+\s*Next\s+Steps/i)) {
        inNextSteps = true;
        continue;
      }

      // Stop at next major section
      if (inNextSteps && line.match(/^##\s+/)) {
        break;
      }

      // Mark tasks as completed
      if (inNextSteps && task.tasks) {
        task.tasks.forEach(taskItem => {
          const taskText = taskItem.description || taskItem.text;
          if (taskText && line.includes(taskText)) {
            // Replace - [ ] with - [x]
            if (line.match(/^[-*]\s*\[\s*\]/)) {
              lines[i] = line.replace(/\[\s*\]/, "[x]");
              modified = true;
            }
          }
        });
      }
    }

    if (modified) {
      fs.writeFileSync(reviewFile, lines.join("\n"));
      logger.info(`Review file updated: ${reviewFile}`);
    }

    return {
      success: true,
      reviewFile,
      modified
    };
  },

  /**
   * Complete task workflow (mark complete + update progress + update review)
   */
  "complete-task-workflow": async (inputs, context) => {
    const { taskId, progressFile, reviewFile, results = {}, cwd = process.cwd() } = inputs;
    const { logger } = context;

    logger.info(`Completing task workflow for ${taskId}`);

    // Step 1: Mark task as completed
    const markResult = await actions["mark-task-complete"]({ taskId, results, cwd }, context);
    if (!markResult.success) {
      return markResult;
    }

    // Step 2: Update progress file
    if (progressFile) {
      await actions["update-progress-on-completion"]({ taskId, progressFile, cwd }, context);
    }

    // Step 3: Update review file
    if (reviewFile) {
      await actions["mark-review-tasks-complete"]({ taskId, reviewFile, cwd }, context);
    }

    return {
      success: true,
      taskId,
      completedAt: markResult.completedAt
    };
  }
};

module.exports = {
  name: "task-completion",
  version: "1.0.0",
  description: "Actions for marking tasks complete and updating progress",
  actions
};
