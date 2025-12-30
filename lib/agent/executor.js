/**
 * Agent Executor - Executes implementation tasks
 * This is a basic executor that can handle simple operations
 * For complex tasks, it will use Cursor Chat integration
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

class AgentExecutor {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.logger = options.logger || console;
  }

  /**
   * Execute a task
   */
  async executeTask(task, taskFilePath) {
    this.logger.info(`[Executor] Executing task: ${task.id}`);
    this.logger.info(`[Executor] Tasks to implement: ${task.tasks.length}`);

    const results = {
      executed: [],
      failed: [],
      skipped: []
    };

    // Process each task
    for (const taskItem of task.tasks) {
      try {
        const result = await this.executeTaskItem(taskItem, task);
        if (result.success) {
          results.executed.push({
            task: taskItem,
            result
          });
        } else {
          results.failed.push({
            task: taskItem,
            error: result.error
          });
        }
      } catch (error) {
        results.failed.push({
          task: taskItem,
          error: error.message
        });
      }
    }

    // Update task with results
    task.executionResults = results;
    task.executionCompletedAt = new Date().toISOString();
    fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));

    return results;
  }

  /**
   * Execute a single task item
   */
  async executeTaskItem(taskItem, parentTask) {
    const description = taskItem.description || taskItem.text || "";
    
    this.logger.info(`[Executor] Processing: ${description}`);

    // For now, we'll create a simple execution plan
    // In a full implementation, this would:
    // 1. Parse the task description
    // 2. Determine what files to create/modify
    // 3. Execute the changes
    // 4. Run tests
    // 5. Verify the changes

    // Check if this is a simple task we can handle
    if (this.canExecuteDirectly(description)) {
      return await this.executeDirectly(taskItem, parentTask);
    } else {
      // Complex task - mark for Cursor Chat
      return {
        success: true,
        method: "cursor-chat",
        message: "Task requires Cursor Chat for implementation",
        prompt: this.generateExecutionPrompt(taskItem, parentTask)
      };
    }
  }

  /**
   * Check if task can be executed directly
   */
  canExecuteDirectly(description) {
    const lowerDesc = description.toLowerCase();
    
    // Simple tasks we can handle:
    // - Create file from template
    // - Run tests
    // - Update documentation
    // - Simple file operations
    
    const simplePatterns = [
      /^create\s+/i,
      /^add\s+/i,
      /^update\s+docs?/i,
      /^run\s+tests?/i,
      /^test\s+/i
    ];

    return simplePatterns.some(pattern => pattern.test(description));
  }

  /**
   * Execute task directly (simple operations)
   */
  async executeDirectly(taskItem, parentTask) {
    const description = taskItem.description || taskItem.text || "";
    
    try {
      // Try to run tests if it's a test-related task
      if (/test|run.*test/i.test(description)) {
        return await this.runTests();
      }

      // Try to create a file if it's a create task
      if (/^create\s+/i.test(description)) {
        return await this.createFileFromDescription(description);
      }

      // Default: mark for manual execution
      return {
        success: true,
        method: "manual",
        message: "Task requires manual implementation",
        prompt: this.generateExecutionPrompt(taskItem, parentTask)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run tests
   */
  async runTests() {
    this.logger.info("[Executor] Running tests...");

    try {
      // Try common test commands
      const testCommands = ["npm test", "npm run test", "yarn test", "pnpm test"];
      
      for (const cmd of testCommands) {
        try {
          const result = execSync(cmd, {
            cwd: this.cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 60000
          });

          return {
            success: true,
            method: "direct",
            command: cmd,
            output: result,
            passed: true
          };
        } catch (e) {
          // Try next command
          continue;
        }
      }

      return {
        success: false,
        error: "No test command found or tests failed"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create file from description (basic implementation)
   */
  async createFileFromDescription(description) {
    // Extract file path from description
    // Example: "Create file lib/modules/testing/index.js"
    const match = description.match(/create\s+(?:file\s+)?([^\s]+(?:\s+[^\s]+)*)/i);
    
    if (!match) {
      return {
        success: false,
        error: "Could not extract file path from description"
      };
    }

    const filePath = match[1].trim();
    const fullPath = path.join(this.cwd, filePath);

    // Check if file already exists
    if (fs.existsSync(fullPath)) {
      return {
        success: false,
        error: `File already exists: ${filePath}`
      };
    }

    // Create directory if needed
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create basic file structure
    const ext = path.extname(filePath);
    let content = "";

    if (ext === ".js") {
      content = this.generateJSFileContent(filePath);
    } else if (ext === ".md") {
      content = this.generateMarkdownContent(filePath);
    } else if (ext === ".yaml" || ext === ".yml") {
      content = this.generateYAMLContent(filePath);
    }

    fs.writeFileSync(fullPath, content);

    return {
      success: true,
      method: "direct",
      filePath,
      created: true
    };
  }

  /**
   * Generate basic JS file content
   */
  generateJSFileContent(filePath) {
    const fileName = path.basename(filePath, path.extname(filePath));
    const moduleName = fileName.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

    return `/**
 * ${moduleName}
 */

module.exports = {
  // TODO: Implement functionality
};
`;
  }

  /**
   * Generate basic Markdown content
   */
  generateMarkdownContent(filePath) {
    const fileName = path.basename(filePath, path.extname(filePath));
    const title = fileName.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

    return `# ${title}

## Overview

TODO: Add content

`;
  }

  /**
   * Generate basic YAML content
   */
  generateYAMLContent(filePath) {
    return `# YAML Configuration

# TODO: Add configuration
`;
  }

  /**
   * Generate execution prompt for Cursor Chat
   */
  generateExecutionPrompt(taskItem, parentTask) {
    return `Implement the following task:

${taskItem.description || taskItem.text}

Context from parent task:
- Prompt: ${parentTask.prompt ? parentTask.prompt.substring(0, 200) + "..." : "N/A"}
- Other tasks: ${parentTask.tasks ? parentTask.tasks.length : 0} tasks in this batch

Follow kaczmarek.ai-dev principles:
- Small, incremental changes
- Test-driven approach
- Update progress file after completion
- Keep review/progress docs in sync
`;
  }
}

module.exports = AgentExecutor;




