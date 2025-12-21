/**
 * Workflow execution engine
 */

const crypto = require("crypto");
const WorkflowDatabase = require("../db/database");
const WorkflowYAMLParser = require("./yaml-parser");
const ModuleLoader = require("../modules/module-loader");
const path = require("path");
const fs = require("fs");

class WorkflowEngine {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.dbPath = options.dbPath || path.join(this.cwd, ".kaczmarek-ai", "workflows.db");
    this.workflowsDir = options.workflowsDir || path.join(this.cwd, "workflows");
    this.modulesDir = options.modulesDir || path.join(__dirname, "..", "modules");
    
    // Allow overriding db and moduleLoader for testing
    this.db = options.db || new WorkflowDatabase(this.dbPath);
    this.moduleLoader = options.moduleLoader || new ModuleLoader(this.modulesDir);
    this.executions = new Map();
    
    // Ensure workflows directory exists
    if (!fs.existsSync(this.workflowsDir)) {
      fs.mkdirSync(this.workflowsDir, { recursive: true });
    }
  }

  /**
   * Load workflow from YAML file
   */
  loadWorkflow(filePath) {
    const workflow = WorkflowYAMLParser.loadFromFile(filePath);
    const validation = WorkflowYAMLParser.validate(workflow);
    
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(", ")}`);
    }
    
    return workflow;
  }

  /**
   * Save workflow to YAML file
   */
  saveWorkflow(filePath, workflow) {
    const validation = WorkflowYAMLParser.validate(workflow);
    
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(", ")}`);
    }
    
    WorkflowYAMLParser.saveToFile(filePath, workflow);
    
    // Also save to database
    const workflowId = path.basename(filePath, path.extname(filePath));
    this.db.saveWorkflow(
      workflowId,
      workflow.name,
      workflow.version || "1.0.0",
      workflow
    );
  }

  /**
   * Validate workflow
   */
  validateWorkflow(workflow) {
    const validation = WorkflowYAMLParser.validate(workflow);
    
    if (!validation.valid) {
      return validation;
    }
    
    // Check if all modules and actions exist
    const moduleErrors = [];
    workflow.steps.forEach(step => {
      if (!this.moduleLoader.hasAction(step.module, step.action)) {
        moduleErrors.push(
          `Step ${step.id}: Module "${step.module}" action "${step.action}" not found`
        );
      }
    });
    
    return {
      valid: moduleErrors.length === 0,
      errors: validation.errors.concat(moduleErrors)
    };
  }

  /**
   * List all workflows from filesystem
   */
  listWorkflows() {
    const workflows = [];
    
    if (!fs.existsSync(this.workflowsDir)) {
      return workflows;
    }
    
    const files = fs.readdirSync(this.workflowsDir);
    
    for (const file of files) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        try {
          const filePath = path.join(this.workflowsDir, file);
          const workflow = this.loadWorkflow(filePath);
          workflows.push({
            id: path.basename(file, path.extname(file)),
            name: workflow.name,
            version: workflow.version,
            filePath,
            description: workflow.description || ""
          });
        } catch (error) {
          console.warn(`Failed to load workflow ${file}:`, error.message);
        }
      }
    }
    
    return workflows;
  }

  /**
   * Execute a workflow
   */
  async execute(workflowId, triggerData = {}) {
    // Load workflow
    const workflow = this.getWorkflowById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    // Try to detect current version tag
    let versionTag = triggerData.versionTag || null;
    if (!versionTag) {
      try {
        const ModuleLoader = require("../modules/module-loader");
        const loader = new ModuleLoader(this.cwd || process.cwd());
        const findVersionAction = loader.getAction("review", "find-current-version");
        if (findVersionAction) {
          const versionResult = await findVersionAction(
            { cwd: this.cwd || process.cwd() },
            { logger: { info: () => {}, error: () => {}, warn: () => {} } }
          );
          if (versionResult && versionResult.found) {
            versionTag = versionResult.versionTag;
          }
        }
      } catch (e) {
        // Version detection failed, continue without it
      }
    }
    
    // Ensure workflow is saved to database (for foreign key constraint)
    this.db.saveWorkflow(
      workflowId,
      workflow.name,
      workflow.version || "1.0.0",
      workflow,
      versionTag
    );
    
    // Create execution
    const executionId = this.generateId();
    this.db.createExecution(
      executionId,
      workflowId,
      "cli",
      triggerData,
      versionTag
    );
    
    this.db.addHistory(executionId, "workflow_started");
    
    // Execute workflow with version tag in context
    try {
      await this.executeWorkflow(executionId, workflow, triggerData, versionTag);
      
      this.db.updateExecution(executionId, { status: "completed" });
      this.db.addHistory(executionId, "workflow_completed");
    } catch (error) {
      // Even on failure, try to determine outcome and suggest follow-ups
      try {
        const execution = this.db.getExecution(executionId);
        if (execution && execution.state) {
          const state = typeof execution.state === 'string' ? JSON.parse(execution.state) : execution.state;
          const outcome = this.determineOutcome(state, workflow) || "failed";
          const followUpSuggestions = this.getFollowUpSuggestions(outcome, workflow);
          
          this.db.updateExecution(executionId, {
            status: "failed",
            error: error.message,
            outcome,
            followUpSuggestions
          });
        } else {
          this.db.updateExecution(executionId, {
            status: "failed",
            error: error.message,
            outcome: "failed"
          });
        }
      } catch (e) {
        // If outcome determination fails, just update status
        this.db.updateExecution(executionId, {
          status: "failed",
          error: error.message,
          outcome: "failed"
        });
      }
      this.db.addHistory(executionId, "workflow_failed", null, { error: error.message });
      throw error;
    }
    
    return {
      id: executionId,
      workflowId,
      status: "completed"
    };
  }

  /**
   * Execute workflow steps
   */
  async executeWorkflow(executionId, workflow, triggerData, versionTag = null) {
    const state = {
      trigger: triggerData,
      steps: {},
      workflow: {
        executionId,
        cwd: process.cwd(),
        versionTag
      }
    };
    
    let currentStep = workflow.steps[0];
    
    while (currentStep) {
      this.db.updateExecution(executionId, {
        currentStep: currentStep.id,
        state
      });
      
      this.db.addHistory(executionId, "step_started", currentStep.id);
      
      // Execute step
      const result = await this.executeStep(
        executionId,
        currentStep,
        state,
        workflow
      );
      
      // Update state with full result (including outputs)
      state.steps[currentStep.id] = {
        ...result,
        outputs: result.outputs || {}
      };
      
      // Determine next step
      currentStep = this.determineNextStep(currentStep, result, workflow);
    }
    
    // Workflow completed - determine outcome and suggest follow-ups
    const outcome = this.determineOutcome(state, workflow);
    const followUpSuggestions = this.getFollowUpSuggestions(outcome, workflow);
    
    this.db.updateExecution(executionId, {
      outcome,
      followUpSuggestions
    });
  }
  
  /**
   * Determine workflow outcome based on final state
   */
  determineOutcome(state, workflow) {
    // Check last step outputs to determine outcome
    const lastStepId = Object.keys(state.steps).pop();
    const lastStep = state.steps[lastStepId];
    
    if (!lastStep) {
      return "unknown";
    }
    
    // Check for common outcome indicators
    if (lastStep.outputs) {
      // Check if no tasks were found
      if (lastStep.outputs.count === 0 || lastStep.outputs.nextStepsCount === 0) {
        return "no-tasks";
      }
      
      // Check if all tasks are complete
      if (lastStep.outputs.allComplete === true) {
        return "all-complete";
      }
      
      // Check if version was created
      if (lastStep.outputs.versionTag) {
        return "version-created";
      }
    }
    
    // Check step ID for common patterns
    if (lastStepId === "no-tasks") {
      return "no-tasks";
    }
    
    if (lastStepId === "check-all-complete") {
      // Check the outputs of check-all-complete step
      if (lastStep.outputs && lastStep.outputs.allComplete === true) {
        return "all-complete";
      }
      return "no-tasks";
    }
    
    if (lastStepId === "create-next-version") {
      return "version-created";
    }
    
    if (lastStep.status === "failure") {
      return "failed";
    }
    
    // Check all steps to find outcome indicators
    for (const [stepId, step] of Object.entries(state.steps)) {
      if (step.outputs) {
        if (step.outputs.count === 0 || (step.outputs.nextSteps && Array.isArray(step.outputs.nextSteps) && step.outputs.nextSteps.length === 0)) {
          return "no-tasks";
        }
        if (step.outputs.allComplete === true) {
          return "all-complete";
        }
      }
    }
    
    return "completed";
  }
  
  /**
   * Get follow-up workflow suggestions based on outcome
   */
  getFollowUpSuggestions(outcome, workflow) {
    const suggestions = [];
    
    // Check if workflow defines follow-up workflows
    if (workflow.followUpWorkflows && Array.isArray(workflow.followUpWorkflows)) {
      workflow.followUpWorkflows.forEach(followUp => {
        // Check if this follow-up matches the outcome
        if (followUp.onOutcome) {
          const outcomes = Array.isArray(followUp.onOutcome) 
            ? followUp.onOutcome 
            : [followUp.onOutcome];
          
          if (outcomes.includes(outcome)) {
            suggestions.push({
              workflowId: followUp.workflowId,
              name: followUp.name || followUp.workflowId,
              description: followUp.description || `Run ${followUp.workflowId} workflow`,
              reason: followUp.reason || `Suggested because workflow completed with outcome: ${outcome}`
            });
          }
        }
      });
    }
    
    // Add default suggestions based on outcome
    if (suggestions.length === 0) {
      switch (outcome) {
        case "no-tasks":
          suggestions.push({
            workflowId: "review-self",
            name: "Review Self",
            description: "Run a new review to identify new tasks",
            reason: "No tasks found - run a review to identify new work"
          });
          break;
        case "all-complete":
          suggestions.push({
            workflowId: "review-self",
            name: "Review Self",
            description: "Start a new review cycle",
            reason: "All tasks completed - start a new review"
          });
          break;
        case "version-created":
          suggestions.push({
            workflowId: "execute-features",
            name: "Execute Features",
            description: "Implement features from the new version",
            reason: "New version created - implement features from it"
          });
          break;
      }
    }
    
    return suggestions;
  }

  /**
   * Execute a single step
   */
  async executeStep(executionId, step, state, workflow) {
    const stepExecutionId = this.generateId();
    
    // Resolve inputs (replace template variables)
    const inputs = this.resolveInputs(step.inputs || {}, state, workflow);
    
    this.db.createStepExecution(
      stepExecutionId,
      executionId,
      step.id,
      step.module,
      step.action,
      inputs
    );
    
    try {
      // Get action from module
      const action = this.moduleLoader.getAction(step.module, step.action);
      
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
      
      this.db.updateStepExecution(stepExecutionId, {
        status: "completed",
        outputs,
        returnCode: 0  // Success
      });
      
      this.db.addHistory(executionId, "step_completed", step.id, {
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
      this.db.updateStepExecution(stepExecutionId, {
        status: "failed",
        error: error.message,
        returnCode: 1  // Failure
      });
      
      this.db.addHistory(executionId, "step_failed", step.id, {
        error: error.message,
        returnCode: 1
      });
      
      return {
        status: "failure",
        error: error.message,
        returnCode: 1
      };
    }
  }

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
  }

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
          result = this.getNestedValue(state.trigger, exprParts.slice(1));
        } else if (exprParts[0] === "steps") {
          if (exprParts.length >= 3 && exprParts[1] && exprParts[2] === "outputs") {
            const stepId = exprParts[1];
            if (exprParts.length > 3) {
              // Specific output key: steps.stepId.outputs.key
              const outputKey = exprParts[3];
              result = this.getNestedValue(state.steps[stepId]?.outputs, [outputKey]);
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
          result = this.getNestedValue(state.workflow, exprParts.slice(1));
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
          result = this.getNestedValue(state.trigger, exprParts.slice(1));
        } else if (exprParts[0] === "steps") {
          if (exprParts.length >= 3 && exprParts[1] && exprParts[2] === "outputs") {
            const stepId = exprParts[1];
            if (exprParts.length > 3) {
              const outputKey = exprParts[3];
              result = this.getNestedValue(state.steps[stepId]?.outputs, [outputKey]);
            } else {
              result = state.steps[stepId]?.outputs || {};
            }
          } else if (exprParts.length === 2) {
            const stepId = exprParts[1];
            result = state.steps[stepId];
          }
        } else if (exprParts[0] === "workflow") {
          result = this.getNestedValue(state.workflow, exprParts.slice(1));
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

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
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
  determineNextStep(step, result, workflow) {
    if (result.status === "success") {
      if (step.onSuccess) {
        if (typeof step.onSuccess === "string") {
          return workflow.steps.find(s => s.id === step.onSuccess);
        } else if (step.onSuccess.condition) {
          // Evaluate condition (simple for now)
          const conditionMet = this.evaluateCondition(
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
  evaluateCondition(condition, result, workflow) {
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
      const resolved = this.resolveValue(condition, state, workflow);
      
      // Evaluate the resolved condition
      if (typeof resolved === "boolean") {
        return resolved;
      }
      
      // Try to parse as expression
      if (typeof resolved === "string") {
        // Check for comparison operators
        if (resolved.includes(">")) {
          const parts = resolved.split(">").map(p => p.trim());
          const left = parseFloat(parts[0]) || 0;
          const right = parseFloat(parts[1]) || 0;
          return left > right;
        }
        if (resolved.includes("<")) {
          const parts = resolved.split("<").map(p => p.trim());
          const left = parseFloat(parts[0]) || 0;
          const right = parseFloat(parts[1]) || 0;
          return left < right;
        }
        if (resolved.includes("===") || resolved.includes("==")) {
          const parts = resolved.split(/===|==/).map(p => p.trim());
          return parts[0] === parts[1];
        }
        
        // Check if it's a truthy value
        const lower = resolved.toLowerCase();
        if (lower === "true" || lower === "1" || lower === "yes") {
          return true;
        }
        if (lower === "false" || lower === "0" || lower === "no" || lower === "") {
          return false;
        }
        
        // Check if it's a number > 0
        const num = parseFloat(resolved);
        if (!isNaN(num)) {
          return num > 0;
        }
        
        // Default: non-empty string is truthy
        return resolved.length > 0;
      }
      
      // Default to true for template conditions (conservative)
      return true;
    }
    
    // Simple boolean check
    if (result.outputs) {
      const key = condition.replace(/[{}]/g, "").trim();
      const value = result.outputs[key];
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value > 0;
      }
      return !!value;
    }
    
    return false;
  }

  /**
   * Get workflow by ID
   */
  getWorkflowById(workflowId) {
    // Try to load from filesystem first
    const yamlPath = path.join(this.workflowsDir, `${workflowId}.yaml`);
    if (fs.existsSync(yamlPath)) {
      return this.loadWorkflow(yamlPath);
    }
    
    // Try database
    const dbWorkflow = this.db.getWorkflow(workflowId);
    if (dbWorkflow) {
      return dbWorkflow.definition;
    }
    
    return null;
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId) {
    const execution = this.db.getExecution(executionId);
    if (!execution) {
      return null;
    }
    
    const stepExecutions = this.db.getStepExecutions(executionId);
    const history = this.db.getHistory(executionId);
    
    return {
      ...execution,
      stepExecutions,
      history
    };
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = WorkflowEngine;

