/**
 * Repo status route handlers
 */

const path = require("path");
const fs = require("fs");
const ModuleLoader = require("../../modules/module-loader");

/**
 * Create repo status routes handler
 */
function createRepoStatusRoutes(server) {
  return {
    /**
     * Get current repository status
     * Returns: current version, review status, next steps, active agents
     */
    async handleGetRepoStatus(req, res) {
      try {
        const modulesDir = path.join(__dirname, "..", "..", "modules");
        const loader = new ModuleLoader(modulesDir);
        
        // Find current version
        const findVersionAction = loader.getAction("review", "find-current-version");
        const versionResult = await findVersionAction(
          { cwd: server.cwd, reviewDir: "review", progressDir: "progress" },
          { logger: { info: () => {}, error: () => {}, warn: () => {} } }
        );

        if (!versionResult || !versionResult.found) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            hasVersion: false,
            message: "No version files found"
          }));
          return;
        }

        // Read review file to get status and summary
        let reviewStatus = "Unknown";
        let reviewSummary = "";
        let reviewContent = "";
        
        if (versionResult.reviewFile && fs.existsSync(versionResult.reviewFile)) {
          reviewContent = fs.readFileSync(versionResult.reviewFile, "utf8");
          
          // Extract status
          const statusMatch = reviewContent.match(/\*\*Status\*\*:\s*(.+?)(?:\n|$)/);
          if (statusMatch) {
            reviewStatus = statusMatch[1].trim();
          }
          
          // Extract summary (first paragraph after "## Summary")
          const summaryMatch = reviewContent.match(/## Summary\s*\n\n(.+?)(?:\n\n|##)/s);
          if (summaryMatch) {
            reviewSummary = summaryMatch[1].trim();
          }
        }

        // Extract next steps
        let nextSteps = [];
        let nextStepsCount = 0;
        if (versionResult.reviewFile && fs.existsSync(versionResult.reviewFile)) {
          const extractStepsAction = loader.getAction("implementation", "extract-next-steps");
          if (extractStepsAction) {
            const stepsResult = await extractStepsAction(
              { reviewFile: versionResult.reviewFile },
              { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            
            if (stepsResult && stepsResult.success) {
              nextSteps = stepsResult.nextSteps || [];
              nextStepsCount = stepsResult.count || 0;
            }
          }
        }

        // Get active agents for this version
        const activeAgents = [];
        const queueDir = path.join(server.cwd, ".kaczmarek-ai", "agent-queue");
        if (fs.existsSync(queueDir)) {
          const files = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
          for (const file of files) {
            try {
              const task = JSON.parse(fs.readFileSync(path.join(queueDir, file), "utf8"));
              
              // Include agents that are not completed and match this version (or all if no version tag)
              const isActive = task.status !== "completed" && 
                              task.status !== "failed" &&
                              (!versionResult.versionTag || task.versionTag === versionResult.versionTag);
              
              if (isActive) {
                // Get execution and workflow info
                let execution = null;
                let workflow = null;
                if (task.executionId) {
                  execution = server.db.getExecution(task.executionId);
                  if (execution && execution.workflow_id) {
                    workflow = server.db.getWorkflow(execution.workflow_id);
                  }
                }
                
                // Generate friendly name
                const taskCount = (task.tasks || []).length;
                let agentName = `${task.type || "task"} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
                if (workflow) {
                  agentName = `${workflow.name} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
                } else if (execution) {
                  agentName = `Execution ${execution.id.substring(0, 8)} - ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
                }
                
                activeAgents.push({
                  id: task.id,
                  name: agentName,
                  status: task.status,
                  type: task.type,
                  taskCount: taskCount,
                  executionId: task.executionId,
                  versionTag: task.versionTag,
                  startedAt: task.startedAt,
                  workflow: workflow ? {
                    id: workflow.id,
                    name: workflow.name
                  } : null
                });
              }
            } catch (e) {
              // Skip invalid files
            }
          }
        }

        // Sort agents by startedAt (newest first)
        activeAgents.sort((a, b) => {
          const dateA = new Date(a.startedAt || 0);
          const dateB = new Date(b.startedAt || 0);
          return dateB - dateA;
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          hasVersion: true,
          version: {
            tag: versionResult.versionTag,
            major: versionResult.major,
            minor: versionResult.minor,
            reviewFile: versionResult.reviewFile,
            progressFile: versionResult.progressFile
          },
          review: {
            status: reviewStatus,
            summary: reviewSummary.substring(0, 300) + (reviewSummary.length > 300 ? "..." : ""),
            hasReview: !!versionResult.reviewFile && fs.existsSync(versionResult.reviewFile),
            hasProgress: !!versionResult.progressFile && fs.existsSync(versionResult.progressFile)
          },
          nextSteps: {
            items: nextSteps.slice(0, 10), // Limit to 10 for dashboard
            count: nextStepsCount,
            total: nextSteps.length
          },
          activeAgents: {
            items: activeAgents,
            count: activeAgents.length
          }
        }));
      } catch (error) {
        console.error("[API] Error getting repo status:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
  };
}

module.exports = createRepoStatusRoutes;



