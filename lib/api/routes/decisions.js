/**
 * Decision route handlers
 */

/**
 * Create decision routes handler
 */
function createDecisionRoutes(server) {
  return {
    /**
     * Get pending decisions for an execution
     */
    async handleGetPendingDecisions(req, res, pathname) {
      // Path format: /api/executions/:executionId/decisions
      const urlParts = pathname.split("/").filter(p => p);
      // urlParts: ['api', 'executions', 'executionId', 'decisions']
      const executionId = urlParts[urlParts.length - 2]; // Get executionId, not "decisions"
      
      if (!executionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Execution ID is required" }));
        return;
      }
      
      const decisions = server.db.getPendingDecisionsForExecution(executionId) || [];
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ decisions }));
    },

    /**
     * Get a specific decision
     */
    async handleGetDecision(req, res, pathname) {
      const urlParts = pathname.split("/");
      const decisionId = urlParts[urlParts.length - 1];
      
      const decision = server.db.getPendingDecision(decisionId);
      
      if (!decision) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Decision not found" }));
        return;
      }
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ decision }));
    },

    /**
     * Submit a decision
     */
    async handleSubmitDecision(req, res, pathname) {
      // Path format: /api/decisions/:decisionId/submit
      const urlParts = pathname.split("/").filter(p => p);
      // urlParts: ['api', 'decisions', 'decisionId', 'submit']
      const decisionIdFromPath = urlParts[urlParts.length - 2]; // Get decisionId, not "submit"
      
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          // Use decisionId from path if not in body, or prefer body if both exist
          const { decisionId: decisionIdFromBody, choice, notes } = data;
          const decisionId = decisionIdFromBody || decisionIdFromPath;

          if (!decisionId || !choice) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "decisionId and choice are required" }));
            return;
          }

          // Get decision
          const decision = server.db.getPendingDecision(decisionId);
          if (!decision) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Decision not found" }));
            return;
          }

          if (decision.status !== "pending") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Decision is already ${decision.status}` }));
            return;
          }

          // Submit decision using system module
          const systemModule = server.engine.moduleLoader.getModule("system");
          const submitDecisionAction = systemModule.actions["submit-decision"];
          
          const result = await submitDecisionAction(
            { decisionId, choice, notes },
            { logger: console, db: server.db }
          );

          // Resume workflow execution
          const execution = server.db.getExecution(decision.executionId);
          if (execution && execution.status === "waiting") {
            // Load workflow state (parse JSON if string)
            let state = execution.state || {};
            if (typeof state === "string") {
              try {
                state = JSON.parse(state);
              } catch (e) {
                console.error("Failed to parse execution state:", e);
                state = {};
              }
            }
            
            // Load workflow
            const workflow = server.engine.workflowManager.loadWorkflow(execution.workflow_id);
            if (!workflow) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: `Workflow ${execution.workflow_id} not found` }));
              return;
            }
            
            // Resume workflow execution asynchronously
            server.engine.executor.resumeExecution(
              decision.executionId,
              workflow,
              state,
              { choice, decisionId, notes, stepId: decision.stepId }
            ).catch(error => {
              console.error("Failed to resume workflow execution:", error);
              // Update execution status to failed
              server.db.updateExecution(decision.executionId, {
                status: "failed",
                error: error.message
              });
            });
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, result }));
        } catch (error) {
          console.error("Failed to submit decision:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  };
}

module.exports = createDecisionRoutes;

