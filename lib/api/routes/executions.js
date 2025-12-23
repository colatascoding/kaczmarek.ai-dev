/**
 * Execution route handlers
 */

const path = require("path");
const fs = require("fs");

/**
 * Create execution routes handler
 */
function createExecutionRoutes(server) {
  return {
    /**
     * List executions
     */
    async handleListExecutions(req, res) {
      try {
        const executions = server.db.getAllExecutions() || [];
        
        // Add workflow and agent links
        const executionsWithLinks = executions.map(exec => {
          const workflow = server.db.getWorkflow(exec.workflowId);
          const agents = server.getAgentsByExecutionId(exec.executionId);
          return {
            ...exec,
            workflow: workflow ? {
              id: workflow.id,
              name: workflow.name,
              version: workflow.version,
              versionTag: workflow.version_tag
            } : null,
            agents: agents || [],
            agentCount: agents.length
          };
        });
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ executions: executionsWithLinks }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    },

    /**
     * Get execution details
     */
    async handleGetExecution(req, res, pathname) {
      try {
        const executionId = pathname.split("/").pop();
        // Parse query parameters from req.url
        const urlParts = req.url.split("?");
        const queryString = urlParts.length > 1 ? urlParts[1] : "";
        const searchParams = new URLSearchParams(queryString);
        const forceRecalculate = searchParams.get("_recalculate") === "true";
        
        const execution = server.db.getExecution(executionId);
        const stepExecutions = server.db.getStepExecutions(executionId) || [];

        if (!execution) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Execution not found" }));
          return;
        }

        // Get workflow details
        const workflow = execution.workflow_id ? server.db.getWorkflow(execution.workflow_id) : null;
        
        // If outcome or follow-up suggestions are missing, try to determine them retroactively
        let outcome = execution.outcome;
        let followUpSuggestions = execution.followUpSuggestions || execution.follow_up_suggestions ? 
          (typeof execution.followUpSuggestions === 'string' ? JSON.parse(execution.followUpSuggestions) : execution.followUpSuggestions) :
          (execution.follow_up_suggestions ? JSON.parse(execution.follow_up_suggestions) : null);
        
        // Recalculate if outcome is missing OR if outcome exists but follow-up suggestions are missing/empty OR if forceRecalculate is true
        const needsRecalculation = forceRecalculate || (!outcome || !followUpSuggestions || (Array.isArray(followUpSuggestions) && followUpSuggestions.length === 0));
        
        if (needsRecalculation && execution.status === "completed" && workflow && execution.state) {
          try {
            const state = typeof execution.state === 'string' ? JSON.parse(execution.state) : execution.state;
            
            // Try to load workflow from file first (to get latest followUpWorkflows config)
            let workflowDef = workflow.definition || workflow;
            const workflowId = execution.workflow_id;
            const workflowFilePath = path.join(server.workflowsDir, `${workflowId}.yaml`);
            
            if (fs.existsSync(workflowFilePath)) {
              try {
                const YAMLParser = require("../../workflow/yaml-parser");
                workflowDef = YAMLParser.loadFromFile(workflowFilePath);
                console.log(`[API Server] Loaded workflow from file: ${workflowFilePath}`);
              } catch (e) {
                console.warn(`[API Server] Failed to load workflow from file, using DB version: ${e.message}`);
              }
            }
            
            // Determine outcome (recalculate if forceRecalculate or if missing)
            if (forceRecalculate || !outcome) {
              outcome = server.engine.determineOutcome(state, workflowDef);
              console.log(`[API Server] Determined outcome for execution ${executionId}: ${outcome}`);
            }
            
            // Get follow-up suggestions (always recalculate if missing/empty or forceRecalculate)
            if (forceRecalculate || !followUpSuggestions || (Array.isArray(followUpSuggestions) && followUpSuggestions.length === 0)) {
              const determinedOutcome = outcome || server.engine.determineOutcome(state, workflowDef);
              followUpSuggestions = server.engine.getFollowUpSuggestions(determinedOutcome, workflowDef);
              console.log(`[API Server] Generated ${followUpSuggestions.length} follow-up suggestions for execution ${executionId} with outcome: ${determinedOutcome}`);
            }
            
            // Update the execution with the determined outcome and suggestions
            server.db.updateExecution(executionId, {
              outcome: outcome || "unknown",
              followUpSuggestions
            });
          } catch (e) {
            console.error(`[API Server] Failed to determine outcome for execution ${executionId}:`, e.message);
            console.error(e.stack);
          }
        }
        
        // Get linked agents
        const agents = server.getAgentsByExecutionId(executionId);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          execution: {
            ...execution,
            executionId: execution.id,
            workflowId: execution.workflow_id,
            versionTag: execution.version_tag,
            executionMode: execution.executionMode || execution.execution_mode || "auto",
            startedAt: execution.started_at,
            completedAt: execution.completed_at,
            error: execution.error,
            outcome: outcome,
            followUpSuggestions: followUpSuggestions,
            summary: execution.summary
          },
          workflow: workflow ? {
            id: workflow.id,
            name: workflow.name,
            version: workflow.version
          } : null,
          steps: stepExecutions.map(step => ({
            ...step,
            step_id: step.step_id || step.id,
            started_at: step.started_at,
            completed_at: step.completed_at,
            return_code: step.return_code,
            error: step.error,
            duration: step.completed_at && step.started_at 
              ? (new Date(step.completed_at) - new Date(step.started_at))
              : null
          })),
          agents
        }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    },

    /**
     * Execute next step for a step-mode execution
     */
    async handleNextStep(req, res, pathname) {
      try {
        const parts = pathname.split("/");
        const executionId = parts[parts.length - 2];
        
        const execution = server.db.getExecution(executionId);
        if (!execution) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Execution not found" }));
          return;
        }

        const executionMode = execution.executionMode || execution.execution_mode || "auto";
        if (executionMode !== "step") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Execution is not in step-by-step mode" }));
          return;
        }

        const workflowId = execution.workflow_id;
        const workflowDef = server.db.getWorkflow(workflowId);
        if (!workflowDef || !workflowDef.definition) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Workflow definition not found for execution" }));
          return;
        }

        const workflow = workflowDef.definition;
        const triggerData = execution.trigger_data || {};

        const result = await server.engine.executeNextStep(executionId, workflow, triggerData, execution.version_tag);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          done: result.done,
          currentStep: result.currentStep,
          state: result.state
        }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
  };
}

module.exports = createExecutionRoutes;

