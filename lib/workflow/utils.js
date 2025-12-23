/**
 * Workflow engine utility functions
 */

const crypto = require("crypto");

/**
 * Get nested value from object
 */
function getNestedValue(obj, path) {
  if (!obj) return undefined;
  
  let current = obj;
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/**
 * Determine next step based on outcome
 */
function determineNextStep(step, result, workflow, evaluateConditionFn) {
  if (result.status === "success") {
    if (step.onSuccess) {
      if (typeof step.onSuccess === "string") {
        return workflow.steps.find(s => s.id === step.onSuccess);
      } else if (step.onSuccess.condition) {
        // Evaluate condition (simple for now)
        const conditionMet = evaluateConditionFn(
          step.onSuccess.condition,
          result,
          workflow
        );
        const nextStepId = conditionMet
          ? step.onSuccess.then
          : step.onSuccess.else;
        return workflow.steps.find(s => s.id === nextStepId);
      }
    }
  } else if (result.status === "failure") {
    if (step.onFailure) {
      return workflow.steps.find(s => s.id === step.onFailure);
    }
  }
  
  return null; // Workflow complete
}

/**
 * Evaluate condition (simple implementation)
 */
function evaluateCondition(condition, result, workflow, resolveValueFn) {
  if (!condition) {
    return true; // No condition means always true
  }
  
  // If condition contains template variables, resolve them
  if (condition.includes("{{")) {
    // Create a minimal state for resolution
    const state = {
      steps: {
        [result.stepId || "current"]: {
          outputs: result.outputs || {}
        }
      }
    };
    
    // Resolve the condition expression
    const resolved = resolveValueFn(condition, state, workflow);
    
    // Evaluate the resolved condition
    if (typeof resolved === "boolean") {
      return resolved;
    }
    
    // Try to parse as expression
    try {
      // Simple expression evaluation (e.g., "outputs.count > 0")
      if (typeof resolved === "string") {
        // Check for comparison operators
        if (resolved.includes(">")) {
          const [left, right] = resolved.split(">").map(s => s.trim());
          return parseFloat(left) > parseFloat(right);
        }
        if (resolved.includes("<")) {
          const [left, right] = resolved.split("<").map(s => s.trim());
          return parseFloat(left) < parseFloat(right);
        }
        if (resolved.includes("===") || resolved.includes("==")) {
          const [left, right] = resolved.split(/===|==/).map(s => s.trim());
          return left === right;
        }
        if (resolved.includes("!==") || resolved.includes("!=")) {
          const [left, right] = resolved.split(/!==|!=/).map(s => s.trim());
          return left !== right;
        }
      }
      
      // Default: truthy check
      return !!resolved;
    } catch (e) {
      return false;
    }
  }
  
  // Simple boolean check
  return !!condition;
}

/**
 * Generate unique ID
 */
function generateId() {
  return crypto.randomBytes(16).toString("hex");
}

module.exports = {
  getNestedValue,
  determineNextStep,
  evaluateCondition,
  generateId
};

