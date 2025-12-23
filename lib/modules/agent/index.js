/**
 * Agent module - Actions for running background agents
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const AgentProcessor = require("../../agent/processor");

/**
 * Get git repository identifier (owner/repo or full URL)
 */
function getGitRepository(cwd) {
  try {
    // Try to get remote URL
    const remoteUrl = execSync("git config --get remote.origin.url", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();

    if (remoteUrl) {
      // Extract owner/repo from various URL formats
      // https://github.com/owner/repo.git -> owner/repo
      // git@github.com:owner/repo.git -> owner/repo
      // https://github.com/owner/repo -> owner/repo
      const match = remoteUrl.match(/(?:github\.com[/:]|gitlab\.com[/:]|bitbucket\.org[/:])([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
      // Return full URL if we can't parse it
      return remoteUrl;
    }
  } catch (e) {
    // Git not available or not a git repo
  }

  // Fallback: use current directory name
  return path.basename(cwd);
}

module.exports = {
  name: "agent",
  version: "1.0.0",
  description: "Actions for running background agents to implement features",
  actions: {
    /**
     * Launch a background agent to implement features
     */
    "launch-background": async (inputs, context) => {
      const { 
        prompt, 
        tasks, 
        cwd = process.cwd(),
        agentType = "cursor", // cursor, local, etc.
        maxIterations = 5
      } = inputs;
      const { logger, executionId } = context;

      // Handle tasks - could be array or plan object with tasks property
      const tasksArray = Array.isArray(tasks) 
        ? tasks 
        : (tasks?.tasks || []);

      logger.info(`Launching background agent (type: ${agentType}) for ${tasksArray.length} tasks`);

      // If there are no tasks, skip creating an agent task
      if (tasksArray.length === 0) {
        logger.info("No tasks to implement. Skipping agent task creation.");
        return {
          success: true,
          agentTaskId: null,
          status: "skipped",
          message: "No tasks to implement. All tasks may already be completed."
        };
      }

      // If agentType is "cursor" and CURSOR_API_KEY is available, use Cloud Agents API
      if (agentType === "cursor") {
        if (process.env.CURSOR_API_KEY) {
          try {
            const cursorCloudAgent = require("../cursor-cloud-agent");
            const repository = getGitRepository(cwd);
            
            // Build comprehensive prompt from tasks
            const tasksList = tasksArray.map((t, i) => 
              `${i + 1}. ${t.description || t.text || JSON.stringify(t)}`
            ).join("\n");
            
            const fullPrompt = `${prompt}\n\nTasks to implement:\n${tasksList}\n\nFollow kaczmarek.ai-dev principles:\n- Small, incremental changes\n- Test-driven approach\n- Update progress file after completion\n- Keep review/progress docs in sync`;

            logger.info(`Launching Cursor Cloud Agent for repository: ${repository}`);
            
            const result = await cursorCloudAgent.actions["launch"]({
              prompt: fullPrompt,
              repository,
              branch: null // Will auto-detect from git or default to "main"
              // Note: "mode" is not supported by the API, so we don't pass it
            }, context);

          // Store agent info for status tracking
          const versionTag = context.versionTag || null;
          const agentTask = {
            id: result.agentId,
            executionId: executionId || null,
            versionTag: versionTag,
            type: "cursor-cloud",
            prompt: fullPrompt,
            tasks: tasksArray,
            cwd,
            status: result.status,
            cloudAgentId: result.agentId,
            startedAt: new Date().toISOString()
          };

          // Save to queue for status tracking
          const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
          if (!fs.existsSync(queueDir)) {
            fs.mkdirSync(queueDir, { recursive: true });
          }
          const taskFile = path.join(queueDir, `${agentTask.id}.json`);
          fs.writeFileSync(taskFile, JSON.stringify(agentTask, null, 2));

          logger.info(`Cursor Cloud Agent launched: ${result.agentId}`);
          logger.info(`Monitor status with: kad agent status ${result.agentId}`);

            return {
              success: true,
              agentTaskId: result.agentId,
              cloudAgentId: result.agentId,
              status: result.status,
              message: `Cursor Cloud Agent launched. Monitor at: https://cursor.com/dashboard/agents/${result.agentId}`
            };
          } catch (error) {
            logger.warn(`Failed to launch Cloud Agent: ${error.message}`);
            logger.warn(`Falling back to local file-based queue.`);
            // Fall through to local queue implementation
          }
        } else {
          logger.info(`CURSOR_API_KEY not set. Using local file-based queue instead of Cloud Agents API.`);
          logger.info(`To use Cloud Agents API, add CURSOR_API_KEY to your .env file.`);
          // Fall through to local queue implementation
        }
      }

      // Fallback: local file-based queue (original implementation)
      // Get version tag from context if available
      const versionTag = context.versionTag || null;
      
      const agentTask = {
        id: executionId || `agent-${Date.now()}`,
        executionId: executionId || null, // Link to workflow execution
        versionTag: versionTag, // Link to version
        type: agentType,
        prompt,
        tasks: tasksArray,
        cwd,
        maxIterations,
        status: "queued",
        startedAt: new Date().toISOString()
      };

      // Save agent task to a queue file
      const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
      if (!fs.existsSync(queueDir)) {
        fs.mkdirSync(queueDir, { recursive: true });
      }

      const taskFile = path.join(queueDir, `${agentTask.id}.json`);
      fs.writeFileSync(taskFile, JSON.stringify(agentTask, null, 2));

      logger.info(`Agent task queued: ${agentTask.id}`);
      logger.info(`Task file: ${taskFile}`);

      // If agentType is "cursor", we can try to trigger Cursor Chat
      if (agentType === "cursor") {
        // Create a Cursor Chat context file
        const cursorContextFile = path.join(cwd, ".cursor", "agent-context.json");
        const cursorContextDir = path.dirname(cursorContextFile);
        if (!fs.existsSync(cursorContextDir)) {
          fs.mkdirSync(cursorContextDir, { recursive: true });
        }

        const cursorContext = {
          type: "background-agent",
          taskId: agentTask.id,
          prompt,
          tasks: tasksArray,
          instructions: [
            "You are a background agent implementing features from the review document.",
            "Work incrementally, making small, testable changes.",
            "After each change, verify it works before proceeding.",
            "Update progress file after completing each task.",
            "Follow kaczmarek.ai-dev principles: local-first, test-driven, small iterations."
          ],
          createdAt: new Date().toISOString()
        };

        fs.writeFileSync(cursorContextFile, JSON.stringify(cursorContext, null, 2));
      logger.info(`Cursor context file created: ${cursorContextFile}`);
      logger.info("You can now use Cursor Chat with this context, or the agent will process it automatically.");
      }

      // Automatically process the task
      try {
        const AgentProcessor = require("../../agent/processor");
        const processor = new AgentProcessor({ cwd });
        // Process immediately (non-blocking)
        setImmediate(() => {
          processor.processQueue().catch(err => {
            logger.warn("Error processing queue:", err.message);
          });
        });
      } catch (e) {
        logger.warn("Could not process task automatically:", e.message);
      }

      return {
        success: true,
        agentTaskId: agentTask.id,
        taskFile,
        status: "queued",
        message: agentType === "cursor" 
          ? "Agent task queued. Use Cursor Chat to process it, or it will be processed automatically."
          : "Agent task queued for background processing."
      };
    },

    /**
     * Process agent task (simulate agent execution)
     * In a real implementation, this would integrate with Cursor Cloud Agents API
     */
    "process-task": async (inputs, context) => {
      const { taskId, cwd = process.cwd() } = inputs;
      const { logger } = context;

      logger.info(`Processing agent task: ${taskId}`);

      const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
      const taskFile = path.join(queueDir, `${taskId}.json`);

      if (!fs.existsSync(taskFile)) {
        return {
          success: false,
          error: `Task file not found: ${taskFile}`
        };
      }

      const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));
      
      // Update task status
      task.status = "processing";
      task.processingStartedAt = new Date().toISOString();
      fs.writeFileSync(taskFile, JSON.stringify(task, null, 2));

      logger.info(`Task ${taskId} is now being processed`);
      logger.info(`Tasks to implement: ${task.tasks.length}`);

      // For now, we'll mark it as ready for manual processing
      // In a real implementation, this would:
      // 1. Parse the prompt and tasks
      // 2. Use Cursor API or local AI to implement features
      // 3. Run tests
      // 4. Update progress/review files
      // 5. Report results

      return {
        success: true,
        taskId,
        status: "processing",
        message: "Task is ready for processing. In a full implementation, this would execute via Cursor Cloud Agents API."
      };
    },

    /**
     * Check agent status
     */
    "check-status": async (inputs, context) => {
      const { taskId, cwd = process.cwd() } = inputs;
      const { logger } = context;

      const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
      const taskFile = path.join(queueDir, `${taskId}.json`);

      if (!fs.existsSync(taskFile)) {
        return {
          success: false,
          error: `Task file not found: ${taskFile}`
        };
      }

      const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));

      // If this is a Cloud Agent, check status via API
      if (task.type === "cursor-cloud" && task.cloudAgentId && process.env.CURSOR_API_KEY) {
        try {
          const cursorCloudAgent = require("../cursor-cloud-agent");
          const statusResult = await cursorCloudAgent.actions["get-status"]({
            agentId: task.cloudAgentId
          }, context);

          // Update local task file with latest status
          task.status = statusResult.status;
          task.cloudStatus = statusResult.data;
          if (statusResult.status === "completed" || statusResult.status === "failed") {
            task.completedAt = new Date().toISOString();
          }
          fs.writeFileSync(taskFile, JSON.stringify(task, null, 2));

          return {
            success: true,
            task: {
              id: task.id,
              status: statusResult.status,
              type: task.type,
              cloudAgentId: task.cloudAgentId,
              tasksCount: task.tasks?.length || 0,
              startedAt: task.startedAt,
              processingStartedAt: task.processingStartedAt,
              completedAt: task.completedAt,
              cloudStatus: statusResult.data
            }
          };
        } catch (error) {
          logger.warn(`Failed to get Cloud Agent status: ${error.message}. Using cached status.`);
        }
      }

      return {
        success: true,
        task: {
          id: task.id,
          status: task.status,
          type: task.type,
          tasksCount: task.tasks?.length || 0,
          startedAt: task.startedAt,
          processingStartedAt: task.processingStartedAt,
          completedAt: task.completedAt
        }
      };
    },

    /**
     * Execute implementation using local tools (fallback when cloud agents unavailable)
     */
    "execute-local": async (inputs, context) => {
      const { prompt, tasks, cwd = process.cwd() } = inputs;
      const { logger } = context;

      logger.info("Executing implementation locally (fallback mode)");
      logger.info(`Tasks to implement: ${tasks?.length || 0}`);

      // This is a placeholder for local execution
      // In practice, this could:
      // 1. Use a local LLM API
      // 2. Use file templates and patterns
      // 3. Execute predefined scripts
      // 4. Use Cursor's local mode

      logger.warn("Local agent execution not fully implemented. Use Cursor Chat with the generated prompt instead.");

      return {
        success: true,
        mode: "local",
        message: "Local execution mode. Use Cursor Chat with the generated prompt to implement features.",
        prompt,
        tasks
      };
    }
  }
};

