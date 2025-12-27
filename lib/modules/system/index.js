/**
 * System module - built-in workflow actions
 */

module.exports = {
  name: "system",
  version: "1.0.0",
  description: "System-level workflow actions",
  actions: {
    "handle-error": async (inputs, context) => {
      const { error, step, state } = inputs;
      const { logger } = context;
      
      logger.error(`Error in step ${step}:`, error);
      
      return {
        handled: true,
        error: error?.message || String(error),
        timestamp: new Date().toISOString()
      };
    },

    "notify-completion": async (inputs, context) => {
      const { status, executionId, duration } = inputs;
      const { logger } = context;
      
      const statusStr = typeof status === "string" && status.includes("{{") 
        ? "completed" 
        : (status || "completed");
      
      logger.info(`Workflow ${executionId} completed with status: ${statusStr}`);
      
      return {
        notified: true,
        status: statusStr,
        executionId,
        duration
      };
    },

    "log": async (inputs, context) => {
      const { message, level = "info" } = inputs;
      const { logger } = context;
      
      logger[level](message);
      
      return {
        logged: true,
        message
      };
    },

    "wait": async (inputs, context) => {
      const { seconds = 1 } = inputs;
      
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      
      return {
        waited: seconds
      };
    },

    /**
     * Wait for user decision on proposals
     * This pauses workflow execution until user makes a decision
     */
    "wait-for-decision": async (inputs, context) => {
      const { 
        proposals, 
        title = "Review Proposals",
        description = "Please review the proposals and make your decision",
        executionId,
        stepId
      } = inputs;
      
      const { logger, executionId: contextExecutionId, stepId: contextStepId } = context;
      
      const execId = executionId || contextExecutionId;
      const step = stepId || contextStepId;
      
      if (!execId) {
        throw new Error("Execution ID is required for wait-for-decision");
      }
      
      // Store decision request in database
      const decisionId = require("crypto").randomBytes(16).toString("hex");
      const decisionData = {
        decisionId,
        executionId: execId,
        stepId: step,
        title,
        description,
        proposals: Array.isArray(proposals) ? proposals : [proposals],
        status: "pending",
        createdAt: new Date().toISOString()
      };
      
      // Store in database - need to get from engine
      // The context should have access to the engine or db
      if (context.engine && context.engine.db) {
        context.engine.db.createPendingDecision(decisionData);
      } else if (context.db) {
        context.db.createPendingDecision(decisionData);
      } else {
        throw new Error("Database context required for wait-for-decision");
      }
      
      logger.info(`Workflow paused at step ${step} waiting for user decision: ${decisionId}`);
      
      // Return pending status - workflow executor should handle this
      return {
        status: "pending",
        decisionId,
        message: "Waiting for user decision",
        proposals: decisionData.proposals
      };
    },

    /**
     * Submit a decision (called by API when user makes a choice)
     */
    "submit-decision": async (inputs, context) => {
      const { decisionId, choice, notes } = inputs;
      const { logger, db } = context;
      
      if (!db) {
        throw new Error("Database context required for submit-decision");
      }
      
      // Get database from context
      const database = db || (context.engine && context.engine.db) || context.db;
      if (!database) {
        throw new Error("Database context required for submit-decision");
      }
      
      // Get decision from database
      const decision = database.getPendingDecision(decisionId);
      if (!decision) {
        throw new Error(`Decision ${decisionId} not found`);
      }
      
      if (decision.status !== "pending") {
        throw new Error(`Decision ${decisionId} is already ${decision.status}`);
      }
      
      // Update decision
      database.updatePendingDecision(decisionId, {
        status: "resolved",
        choice,
        notes,
        resolvedAt: new Date().toISOString()
      });
      
      logger.info(`Decision ${decisionId} resolved with choice: ${choice}`);
      
      return {
        resolved: true,
        decisionId,
        choice,
        notes
      };
    }
  }
};

