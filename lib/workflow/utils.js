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
function determineNextStep(step, result, workflow, evaluateConditionFn, state = null) {
  if (result.status === "success") {
    if (step.onSuccess) {
      if (typeof step.onSuccess === "string") {
        return workflow.steps.find(s => s.id === step.onSuccess);
      } else if (step.onSuccess.condition) {
        // Evaluate condition (simple for now)
        const conditionMet = evaluateConditionFn(
          step.onSuccess.condition,
          result,
          workflow,
          state
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
function evaluateCondition(condition, result, workflow, resolveValueFn, fullState = null) {
  if (!condition) {
    return true; // No condition means always true
  }
  
  // If condition contains template variables, resolve them
  if (condition.includes("{{")) {
    // Use full state if provided, otherwise create minimal state with current step
    const state = fullState || {
      steps: {
        [result.stepId || "current"]: {
          outputs: result.outputs || {}
        }
      }
    };
    
    // Ensure current step's outputs are in state
    if (!state.steps) {
      state.steps = {};
    }
    if (result.stepId && !state.steps[result.stepId]) {
      state.steps[result.stepId] = { outputs: result.outputs || {} };
    } else if (result.stepId && state.steps[result.stepId]) {
      // Update with latest outputs
      state.steps[result.stepId].outputs = result.outputs || {};
    }
    
    // Extract template variables and expressions from condition
    // Handle cases like: "{{ steps.step.outputs.count > 0 }}"
    // We need to extract the variable part and the expression part separately
    
    // Try to extract template variables and operators
    const templateVarMatch = condition.match(/\{\{([^}]+)\}\}/);
    if (templateVarMatch) {
      const templateContent = templateVarMatch[1].trim();
      
      // Check if it contains an expression (has operators like >, <, ==, etc.)
      const hasOperator = /[><=!]/.test(templateContent);
      
      if (hasOperator) {
        // Split on operators, but preserve them
        // Find the operator and split
        let operator = null;
        let operatorRegex = null;
        if (templateContent.includes(">")) {
          operator = ">";
          operatorRegex = />/;
        } else if (templateContent.includes("<")) {
          operator = "<";
          operatorRegex = /</;
        } else if (templateContent.includes("===")) {
          operator = "===";
          operatorRegex = /===/;
        } else if (templateContent.includes("==")) {
          operator = "==";
          operatorRegex = /==/;
        } else if (templateContent.includes("!==")) {
          operator = "!==";
          operatorRegex = /!==/;
        } else if (templateContent.includes("!=")) {
          operator = "!=";
          operatorRegex = /!=/;
        }
        
        if (operator) {
          const parts = templateContent.split(operatorRegex).map(s => s.trim());
          const leftExpr = parts[0];
          const rightExpr = parts[1];
          
          // Resolve left side (template variable)
          const leftValue = resolveValueFn(`{{ ${leftExpr} }}`, state, workflow);
          
          // Resolve right side (could be a number, string, or another template variable)
          let rightValue = rightExpr;
          if (rightExpr.includes("{{")) {
            rightValue = resolveValueFn(rightExpr, state, workflow);
          } else if (!isNaN(rightExpr)) {
            rightValue = parseFloat(rightExpr);
          } else if (rightExpr === "true" || rightExpr === "false") {
            rightValue = rightExpr === "true";
          } else if (rightExpr.startsWith('"') && rightExpr.endsWith('"')) {
            rightValue = rightExpr.slice(1, -1);
          } else if (rightExpr.startsWith("'") && rightExpr.endsWith("'")) {
            rightValue = rightExpr.slice(1, -1);
          }
          
          // Evaluate comparison
          if (operator === ">") {
            return parseFloat(leftValue) > parseFloat(rightValue);
          } else if (operator === "<") {
            return parseFloat(leftValue) < parseFloat(rightValue);
          } else if (operator === "===" || operator === "==") {
            return leftValue === rightValue;
          } else if (operator === "!==" || operator === "!=") {
            return leftValue !== rightValue;
          }
        }
      } else {
        // No operator, just resolve the template variable and check truthiness
        const resolved = resolveValueFn(`{{ ${templateContent} }}`, state, workflow);
        return !!resolved;
      }
    }
    
    // Fallback: try to resolve the entire condition
    const resolved = resolveValueFn(condition, state, workflow);
    
    // Evaluate the resolved condition
    if (typeof resolved === "boolean") {
      return resolved;
    }
    
    // Default: truthy check
    return !!resolved;
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

