/**
 * Workflow execution engine
 */

const WorkflowDatabase = require("../db/database");
const ModuleLoader = require("../modules/module-loader");
const path = require("path");
const fs = require("fs");
const { generateId } = require("./utils");
const createWorkflowManager = require("./workflow-manager");
const createWorkflowExecutor = require("./executor");
const createOutcomeHandler = require("./outcome");
const createStepExecutor = require("./step-executor");

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
    
    // Initialize sub-modules
    this.workflowManager = createWorkflowManager(this);
    this.stepExecutor = createStepExecutor(this);
    this.outcomeHandler = createOutcomeHandler(this);
    this.executor = createWorkflowExecutor(this);
    
    // Expose utils for use by modules
    const utils = require("./utils");
    this.utils = utils;
  }

  // Workflow management methods
  loadWorkflow(filePath) {
    return this.workflowManager.loadWorkflow(filePath);
  }

  saveWorkflow(filePath, workflow) {
    return this.workflowManager.saveWorkflow(filePath, workflow);
  }

  validateWorkflow(workflow) {
    return this.workflowManager.validateWorkflow(workflow);
  }

  listWorkflows() {
    return this.workflowManager.listWorkflows();
  }

  getWorkflowById(workflowId) {
    return this.workflowManager.getWorkflowById(workflowId);
  }

  // Execution methods
  async execute(workflowId, triggerData = {}, options = {}) {
    return this.executor.execute(workflowId, triggerData, options);
  }

  async executeWorkflow(executionId, workflow, triggerData, versionTag = null) {
    return this.executor.executeWorkflow(executionId, workflow, triggerData, versionTag);
  }

  async executeNextStep(executionId, workflow, triggerData, versionTag = null) {
    return this.executor.executeNextStep(executionId, workflow, triggerData, versionTag);
  }

  // Outcome methods
  generateExecutionSummary(executionId, workflow, state, outcome, followUpSuggestions) {
    return this.outcomeHandler.generateExecutionSummary(executionId, workflow, state, outcome, followUpSuggestions);
  }

  determineOutcome(state, workflow) {
    return this.outcomeHandler.determineOutcome(state, workflow);
  }

  getFollowUpSuggestions(outcome, workflow) {
    return this.outcomeHandler.getFollowUpSuggestions(outcome, workflow);
  }

  // Step execution methods
  async executeStep(executionId, step, state, workflow) {
    return this.stepExecutor.executeStep(executionId, step, state, workflow);
  }

  resolveInputs(inputs, state, workflow) {
    return this.stepExecutor.resolveInputs(inputs, state, workflow);
  }

  resolveValue(value, state, workflow) {
    return this.stepExecutor.resolveValue(value, state, workflow);
  }

  // Utility methods
  getNestedValue(obj, path) {
    return this.utils.getNestedValue(obj, path);
  }

  determineNextStep(step, result, workflow) {
    return this.utils.determineNextStep(
      step,
      result,
      workflow,
      (condition, result, workflow) => this.utils.evaluateCondition(
        condition,
        result,
        workflow,
        (value, state, workflow) => this.stepExecutor.resolveValue(value, state, workflow)
      )
    );
  }

  evaluateCondition(condition, result, workflow) {
    return this.utils.evaluateCondition(
      condition,
      result,
      workflow,
      (value, state, workflow) => this.stepExecutor.resolveValue(value, state, workflow)
    );
  }

  generateId() {
    return generateId();
  }

  // Status methods
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
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = WorkflowEngine;
