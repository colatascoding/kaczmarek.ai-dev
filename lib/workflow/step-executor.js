/**
 * Step execution functions
 */

const { getNestedValue } = require("./utils");

/**
 * Create step executor
 */
function createStepExecutor(engine) {
  return {
    /**
     * Execute a single step
     */
    async executeStep(executionId, step, state, workflow) {
      const stepExecutionId = engine.generateId();
      
      // Resolve inputs (replace template variables)
      const inputs = this.resolveInputs(step.inputs || {}, state, workflow);
      
      engine.db.createStepExecution(
        stepExecutionId,
        executionId,
        step.id,
        step.module,
        step.action,
        inputs
      );
      
      try {
        // Get action from module
        const action = engine.moduleLoader.getAction(step.module, step.action);
        
        // Create context
        const context = {
          logger: {
            info: (msg) => console.log(`[${step.id}]`, msg),
            error: (msg) => console.error(`[${step.id}]`, msg),
            warn: (msg) => console.warn(`[${step.id}]`, msg)
          },
          executionId,
          versionTag: state.workflow.versionTag,
          stepId: step.id,
          state
        };
        
        // Execute action
        const startTime = Date.now();
        const outputs = await action(inputs, context);
        const duration = Date.now() - startTime;
        
        engine.db.updateStepExecution(stepExecutionId, {
          status: "completed",
          outputs,
          returnCode: 0  // Success
        });
        
        engine.db.addHistory(executionId, "step_completed", step.id, {
          outputs,
          duration,
          returnCode: 0
        });
        
        return {
          status: "success",
          outputs,
          duration,
          returnCode: 0
        };
      } catch (error) {
        engine.db.updateStepExecution(stepExecutionId, {
          status: "failed",
          error: error.message,
          returnCode: 1  // Failure
        });
        
        engine.db.addHistory(executionId, "step_failed", step.id, {
          error: error.message,
          returnCode: 1
        });
        
        return {
          status: "failure",
          error: error.message,
          returnCode: 1
        };
      }
    },

    /**
     * Resolve input template variables
     */
    resolveInputs(inputs, state, workflow) {
      if (typeof inputs !== "object" || inputs === null) {
        return inputs;
      }
      
      // If it's an array, resolve each element
      if (Array.isArray(inputs)) {
        return inputs.map(item => this.resolveValue(item, state, workflow));
      }
      
      const resolved = {};
      
      for (const [key, value] of Object.entries(inputs)) {
        resolved[key] = this.resolveValue(value, state, workflow);
      }
      
      return resolved;
    },

    /**
     * Resolve a single value (handle template variables)
     */
    resolveValue(value, state, workflow) {
      if (typeof value === "string") {
        // Check if entire string is a template variable (e.g., "{{ steps.step.outputs.key }}")
        const fullMatch = value.match(/^\{\{([^}]+)\}\}$/);
        if (fullMatch) {
          // Entire value is a template - return the resolved value directly (not as string)
          const trimmed = fullMatch[1].trim();
          const parts = trimmed.split("||").map(p => p.trim());
          const mainExpr = parts[0];
          const defaultValue = parts[1];
          
          const exprParts = mainExpr.split(".");
          let result = null;
          
          if (exprParts[0] === "trigger") {
            result = getNestedValue(state.trigger, exprParts.slice(1));
          } else if (exprParts[0] === "steps") {
            if (exprParts.length >= 3 && exprParts[1] && exprParts[2] === "outputs") {
              const stepId = exprParts[1];
              if (exprParts.length > 3) {
                // Specific output key: steps.stepId.outputs.key
                const outputKey = exprParts[3];
                result = getNestedValue(state.steps[stepId]?.outputs, [outputKey]);
              } else {
                // All outputs: steps.stepId.outputs
                result = state.steps[stepId]?.outputs || {};
              }
            } else if (exprParts.length === 2) {
              // steps.stepId - get entire step result
              const stepId = exprParts[1];
              result = state.steps[stepId];
            }
          } else if (exprParts[0] === "workflow") {
            result = getNestedValue(state.workflow, exprParts.slice(1));
          }
          
          if (result !== null && result !== undefined) {
            return result;
          }
          if (defaultValue) {
            // Strip quotes from string literals
            const stripped = defaultValue.replace(/^['"](.*)['"]$/, '$1');
            if (!isNaN(stripped) && !isNaN(parseFloat(stripped))) {
              return parseFloat(stripped);
            }
            return stripped;
          }
          return undefined;
        }
        
        // Partial template replacement (string interpolation)
        return value.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
          const trimmed = expr.trim();
          const parts = trimmed.split("||").map(p => p.trim());
          const mainExpr = parts[0];
          const defaultValue = parts[1];
          
          const exprParts = mainExpr.split(".");
          let result = null;
          
          if (exprParts[0] === "trigger") {
            result = getNestedValue(state.trigger, exprParts.slice(1));
          } else if (exprParts[0] === "steps") {
            if (exprParts.length >= 3 && exprParts[1] && exprParts[2] === "outputs") {
              const stepId = exprParts[1];
              if (exprParts.length > 3) {
                const outputKey = exprParts[3];
                result = getNestedValue(state.steps[stepId]?.outputs, [outputKey]);
              } else {
                result = state.steps[stepId]?.outputs || {};
              }
            } else if (exprParts.length === 2) {
              const stepId = exprParts[1];
              result = state.steps[stepId];
            }
          } else if (exprParts[0] === "workflow") {
            result = getNestedValue(state.workflow, exprParts.slice(1));
          }
          
          if (result !== null && result !== undefined) {
            // Convert to string for interpolation
            if (typeof result === "object") {
              return JSON.stringify(result);
            }
            return String(result);
          }
          if (defaultValue) {
            // Strip quotes from string literals
            return defaultValue.replace(/^['"](.*)['"]$/, '$1');
          }
          return match;
        });
      } else if (Array.isArray(value)) {
        return value.map(v => this.resolveValue(v, state, workflow));
      } else if (typeof value === "object" && value !== null) {
        return this.resolveInputs(value, state, workflow);
      }
      
      return value;
    }
  };
}

module.exports = createStepExecutor;

