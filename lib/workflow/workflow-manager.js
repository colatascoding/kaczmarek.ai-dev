/**
 * Workflow management functions (Updated for library system)
 */

const path = require("path");
const fs = require("fs");
const WorkflowYAMLParser = require("./yaml-parser");
const workflowDiscovery = require("../library/workflow-discovery");

/**
 * Create workflow manager
 */
function createWorkflowManager(engine) {
  return {
    /**
     * Load workflow from YAML file or discover from library
     */
    loadWorkflow(filePathOrId, options = {}) {
      // If it's a file path, load directly
      if (filePathOrId.includes("/") || filePathOrId.includes("\\") || filePathOrId.endsWith(".yaml") || filePathOrId.endsWith(".yml")) {
        const workflow = WorkflowYAMLParser.loadFromFile(filePathOrId);
        const validation = WorkflowYAMLParser.validate(workflow);
        
        if (!validation.valid) {
          throw new Error(`Invalid workflow: ${validation.errors.join(", ")}`);
        }
        
        return workflow;
      }

      // Otherwise, try to discover from library
      const workflow = workflowDiscovery.getWorkflowById(filePathOrId, engine.cwd, options);
      if (!workflow) {
        throw new Error(`Workflow not found: ${filePathOrId}`);
      }

      // Load from discovered path
      const discoveredWorkflow = WorkflowYAMLParser.loadFromFile(workflow.sourcePath);
      const validation = WorkflowYAMLParser.validate(discoveredWorkflow);
      
      if (!validation.valid) {
        throw new Error(`Invalid workflow: ${validation.errors.join(", ")}`);
      }

      return {
        ...discoveredWorkflow,
        _source: workflow.source,
        _sourcePath: workflow.sourcePath
      };
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
     * List all workflows (from all sources)
     */
    listWorkflows(options = {}) {
      // Discover workflows from all sources
      const discoveredWorkflows = workflowDiscovery.discoverWorkflows(engine.cwd, options);
      
      // Transform to expected format
      return discoveredWorkflows.map(workflow => ({
        id: workflow.id,
        name: workflow.name,
        version: workflow.version || "1.0.0",
        description: workflow.description || "",
        file: workflow.file || path.basename(workflow.sourcePath),
        filePath: workflow.sourcePath,
        path: workflow.sourcePath,
        source: workflow.source,
        versionTag: workflow.versionTag || null,
        libraryItem: workflow.libraryItem || null
      }));
    },

    /**
     * Get workflow by ID (from all sources)
     */
    getWorkflowById(workflowId, options = {}) {
      // Try discovery first (checks active, version-specific, library)
      const discovered = workflowDiscovery.getWorkflowById(workflowId, engine.cwd, options);
      if (discovered) {
        return this.loadWorkflow(discovered.sourcePath, options);
      }
      
      // Fallback to database
      const dbWorkflow = engine.db.getWorkflow(workflowId);
      if (dbWorkflow) {
        return dbWorkflow.definition;
      }
      
      return null;
    }
  };
}

module.exports = createWorkflowManager;

