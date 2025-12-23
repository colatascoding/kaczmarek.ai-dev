/**
 * Agent route handlers
 */

const path = require("path");
const fs = require("fs");
const { getAgentsByExecutionId } = require("../agent-helpers");

/**
 * Create agent routes handler
 */
function createAgentRoutes(server) {
  return {
    /**
     * List agent tasks
     */
    async handleListAgents(req, res) {
      const queueDir = path.join(server.cwd, ".kaczmarek-ai", "agent-queue");
      const agents = [];

      if (fs.existsSync(queueDir)) {
        const files = fs.readdirSync(queueDir)
          .filter(f => f.endsWith(".json"))
          .map(f => {
            const filePath = path.join(queueDir, f);
            try {
              const task = JSON.parse(fs.readFileSync(filePath, "utf8"));
              const agent = {
                id: task.id,
                executionId: task.executionId || null,
                versionTag: task.versionTag || null,
                status: task.status,
                type: task.type,
                tasks: task.tasks || [],
                createdAt: task.startedAt,
                readyAt: task.readyAt,
                completedAt: task.completedAt
              };
              
              // Generate a friendly name for the agent
              const taskCount = (task.tasks || []).length;
              const taskType = task.type || "task";
              if (task.executionId) {
                const execution = server.db.getExecution(task.executionId);
                if (execution) {
                  const workflow = execution.workflow_id ? server.db.getWorkflow(execution.workflow_id) : null;
                  if (workflow) {
                    agent.name = `${workflow.name} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
                  } else {
                    agent.name = `Execution ${task.executionId.substring(0, 8)} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
                  }
                  agent.execution = {
                    executionId: execution.id,
                    id: execution.id,
                    workflowId: execution.workflow_id,
                    status: execution.status,
                    startedAt: execution.started_at
                  };
                  // Get workflow details
                  if (execution.workflow_id) {
                    const workflow = server.db.getWorkflow(execution.workflow_id);
                    if (workflow) {
                      agent.workflow = {
                        id: workflow.id,
                        name: workflow.name,
                        versionTag: workflow.version_tag
                      };
                    }
                  }
                } else {
                  agent.name = `${taskType} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
                }
              } else {
                agent.name = `${taskType} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
              }
              
              return agent;
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean);

        agents.push(...files);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ agents }));
    },

    /**
     * Get agent task details
     */
    async handleGetAgent(req, res, pathname) {
      const agentId = pathname.split("/").pop();
      const queueDir = path.join(server.cwd, ".kaczmarek-ai", "agent-queue");
      const taskFile = path.join(queueDir, `${agentId}.json`);

      if (!fs.existsSync(taskFile)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Agent task not found" }));
        return;
      }

      const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));
      
      // Get execution and workflow info
      let execution = null;
      let workflow = null;
      if (task.executionId) {
        execution = server.db.getExecution(task.executionId);
        if (execution) {
          workflow = server.db.getWorkflow(execution.workflow_id);
        }
      }
      
      // Generate a friendly name for the agent
      const taskCount = (task.tasks || []).length;
      const taskType = task.type || "task";
      let agentName;
      if (workflow) {
        agentName = `${workflow.name} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
      } else if (execution) {
        agentName = `Execution ${execution.id.substring(0, 8)} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
      } else {
        agentName = `${taskType} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
      }
      
      const agentWithLinks = {
        ...task,
        name: agentName,
        execution: execution ? {
          executionId: execution.id,
          id: execution.id,
          workflowId: execution.workflow_id,
          status: execution.status,
          versionTag: execution.version_tag,
          startedAt: execution.started_at
        } : null,
        workflow: workflow ? {
          id: workflow.id,
          name: workflow.name,
          version: workflow.version,
          versionTag: workflow.version_tag
        } : null
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ agent: agentWithLinks }));
    },

    /**
     * Complete an agent task
     */
    async handleCompleteAgent(req, res, pathname) {
      // Extract agent ID from path like /api/agents/{id}/complete
      const parts = pathname.split("/");
      const agentId = parts[parts.length - 2]; // Get ID before "complete"
      
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const params = body ? JSON.parse(body) : {};
          const queueDir = path.join(server.cwd, ".kaczmarek-ai", "agent-queue");
          const taskFile = path.join(queueDir, `${agentId}.json`);

          if (!fs.existsSync(taskFile)) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Agent task not found" }));
            return;
          }

          const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));

          // Find review and progress files
          let reviewFile = null;
          let progressFile = null;

          // Try to get from version tag
          if (task.versionTag) {
            const reviewPath = path.join(server.cwd, "review", `${task.versionTag}.md`);
            const progressPath = path.join(server.cwd, "progress", `${task.versionTag}.md`);
            
            if (fs.existsSync(reviewPath)) {
              reviewFile = reviewPath;
            }
            if (fs.existsSync(progressPath)) {
              progressFile = progressPath;
            }
          }

          // If not found, try to find latest version
          if (!reviewFile || !progressFile) {
            try {
              const ModuleLoader = require("../../modules/module-loader");
              const modulesDir = path.join(__dirname, "..", "..", "modules");
              const loader = new ModuleLoader(modulesDir);
              const findVersionAction = loader.getAction("review", "find-current-version");
              
              if (findVersionAction) {
                const versionResult = await findVersionAction(
                  { cwd: server.cwd, reviewDir: "review", progressDir: "progress" },
                  { logger: { info: () => {}, error: () => {}, warn: () => {} } }
                );
                
                if (versionResult && versionResult.found) {
                  reviewFile = reviewFile || versionResult.reviewFile;
                  progressFile = progressFile || versionResult.progressFile;
                }
              }
            } catch (e) {
              // If finding version fails, continue without it
            }
          }

          // Use provided files or found files
          reviewFile = params.reviewFile || reviewFile;
          progressFile = params.progressFile || progressFile;

          // Get task completion module
          const ModuleLoader = require("../../modules/module-loader");
          const modulesDir = path.join(__dirname, "..", "..", "modules");
          const loader = new ModuleLoader(modulesDir);
          const completeAction = loader.getAction("task-completion", "complete-task-workflow");

          if (!completeAction) {
            throw new Error("Task completion module not found");
          }

          // Execute completion
          const result = await completeAction(
            {
              taskId: agentId,
              progressFile,
              reviewFile,
              results: params.results || {},
              cwd: server.cwd
            },
            {
              logger: {
                info: (msg) => console.log(`[API] ${msg}`),
                error: (msg) => console.error(`[API] ${msg}`),
                warn: (msg) => console.warn(`[API] ${msg}`)
              }
            }
          );

          if (result.success) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              success: true,
              taskId: agentId,
              completedAt: result.completedAt,
              message: "Task completed successfully"
            }));
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: result.error || "Failed to complete task" }));
          }
        } catch (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  };
}

module.exports = createAgentRoutes;

