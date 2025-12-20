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
    }
  }
};

