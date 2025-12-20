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
    this.dbPath = options.dbPath || path.join(process.cwd(), ".kaczmarek-ai", "workflows.db");
    this.workflowsDir = options.workflowsDir || path.join(process.cwd(), "workflows");
    this.modulesDir = options.modulesDir || path.join(__dirname, "..", "modules");
    
    this.db = new WorkflowDatabase(this.dbPath);
    this.moduleLoader = new ModuleLoader(this.modulesDir);
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
    
    // Create execution
    const executionId = this.generateId();
    this.db.createExecution(
      executionId,
      workflowId,
      "cli",
      triggerData
    );
    
    this.db.addHistory(executionId, "workflow_started");
    
    // Execute workflow
    try {
      await this.executeWorkflow(executionId, workflow, triggerData);
      
      this.db.updateExecution(executionId, { status: "completed" });
      this.db.addHistory(executionId, "workflow_completed");
    } catch (error) {
      this.db.updateExecution(executionId, {
        status: "failed",
        error: error.message
      });
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
  async executeWorkflow(executionId, workflow, triggerData) {
    const state = {
      trigger: triggerData,
      steps: {}
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
      
      // Update state
      state.steps[currentStep.id] = result;
      
      // Determine next step
      currentStep = this.determineNextStep(currentStep, result, workflow);
    }
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
        stepId: step.id,
        state
      };
      
      // Execute action
      const startTime = Date.now();
      const outputs = await action(inputs, context);
      const duration = Date.now() - startTime;
      
      this.db.updateStepExecution(stepExecutionId, {
        status: "completed",
        outputs
      });
      
      this.db.addHistory(executionId, "step_completed", step.id, {
        outputs,
        duration
      });
      
      return {
        status: "success",
        outputs,
        duration
      };
    } catch (error) {
      this.db.updateStepExecution(stepExecutionId, {
        status: "failed",
        error: error.message
      });
      
      this.db.addHistory(executionId, "step_failed", step.id, {
        error: error.message
      });
      
      return {
        status: "failure",
        error: error.message
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
      // Replace template variables like {{ trigger.feature }} or {{ steps.analyze.outputs.complexity }}
      return value.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
        const trimmed = expr.trim();
        const parts = trimmed.split(".");
        
        if (parts[0] === "trigger") {
          return this.getNestedValue(state.trigger, parts.slice(1));
        } else if (parts[0] === "steps") {
          if (parts.length >= 3 && parts[1] && parts[2] === "outputs") {
            const stepId = parts[1];
            const outputKey = parts[3];
            return this.getNestedValue(state.steps[stepId]?.outputs, [outputKey]);
          }
        }
        
        return match; // Return original if can't resolve
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
    // Simple condition evaluation
    // For now, just check if condition string matches output keys
    // TODO: Implement proper expression evaluation
    
    if (condition.includes("{{")) {
      // Template condition - would need proper evaluation
      return true; // Placeholder
    }
    
    // Simple boolean check
    if (result.outputs) {
      const key = condition.replace(/[{}]/g, "").trim();
      return result.outputs[key] === true;
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

