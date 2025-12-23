/**
 * Workflow management functions
 */

const path = require("path");
const fs = require("fs");
const WorkflowYAMLParser = require("./yaml-parser");

/**
 * Create workflow manager
 */
function createWorkflowManager(engine) {
  return {
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
    },

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
      engine.db.saveWorkflow(
        workflowId,
        workflow.name,
        workflow.version || "1.0.0",
        workflow
      );
    },

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
        if (!engine.moduleLoader.hasAction(step.module, step.action)) {
          moduleErrors.push(
            `Step ${step.id}: Module "${step.module}" action "${step.action}" not found`
          );
        }
      });
      
      return {
        valid: moduleErrors.length === 0,
        errors: validation.errors.concat(moduleErrors)
      };
    },

    /**
     * List all workflows from filesystem
     */
    listWorkflows() {
      const workflows = [];
      
      if (!fs.existsSync(engine.workflowsDir)) {
        return workflows;
      }
      
      const files = fs.readdirSync(engine.workflowsDir);
      
      for (const file of files) {
        if (file.endsWith(".yaml") || file.endsWith(".yml")) {
          try {
            const filePath = path.join(engine.workflowsDir, file);
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
    },

    /**
     * Get workflow by ID
     */
    getWorkflowById(workflowId) {
      // Try to load from filesystem first
      const yamlPath = path.join(engine.workflowsDir, `${workflowId}.yaml`);
      if (fs.existsSync(yamlPath)) {
        return this.loadWorkflow(yamlPath);
      }
      
      // Try database
      const dbWorkflow = engine.db.getWorkflow(workflowId);
      if (dbWorkflow) {
        return dbWorkflow.definition;
      }
      
      return null;
    }
  };
}

module.exports = createWorkflowManager;

