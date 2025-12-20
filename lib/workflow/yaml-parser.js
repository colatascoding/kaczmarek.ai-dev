/**
 * YAML workflow parser and generator
 */

const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

class WorkflowYAMLParser {
  /**
   * Load workflow from YAML file
   */
  static loadFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const workflow = yaml.load(content);
      
      // Validate basic structure
      if (!workflow.name || !workflow.steps) {
        throw new Error("Invalid workflow structure: missing name or steps");
      }
      
      return workflow;
    } catch (error) {
      throw new Error(`Failed to load workflow from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Save workflow to YAML file
   */
  static saveToFile(filePath, workflow) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const yamlContent = yaml.dump(workflow, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });
      
      fs.writeFileSync(filePath, yamlContent, "utf8");
      return true;
    } catch (error) {
      throw new Error(`Failed to save workflow to ${filePath}: ${error.message}`);
    }
  }

  /**
   * Convert workflow to JSON (for database storage)
   */
  static toJSON(workflow) {
    return JSON.parse(JSON.stringify(workflow));
  }

  /**
   * Convert JSON to workflow (from database)
   */
  static fromJSON(json) {
    return JSON.parse(JSON.stringify(json));
  }

  /**
   * Validate workflow structure
   */
  static validate(workflow) {
    const errors = [];
    
    if (!workflow.name) {
      errors.push("Workflow must have a name");
    }
    
    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      errors.push("Workflow must have a steps array");
      return { valid: false, errors };
    }
    
    if (workflow.steps.length === 0) {
      errors.push("Workflow must have at least one step");
    }
    
    // Validate each step
    const stepIds = new Set();
    workflow.steps.forEach((step, index) => {
      if (!step.id) {
        errors.push(`Step ${index} is missing an id`);
      } else {
        if (stepIds.has(step.id)) {
          errors.push(`Duplicate step id: ${step.id}`);
        }
        stepIds.add(step.id);
      }
      
      if (!step.module) {
        errors.push(`Step ${step.id} is missing a module`);
      }
      
      if (!step.action) {
        errors.push(`Step ${step.id} is missing an action`);
      }
      
      // Validate onSuccess/onFailure references
      if (step.onSuccess) {
        if (typeof step.onSuccess === "string") {
          if (!stepIds.has(step.onSuccess) && !workflow.steps.find(s => s.id === step.onSuccess)) {
            errors.push(`Step ${step.id} references unknown step in onSuccess: ${step.onSuccess}`);
          }
        } else if (step.onSuccess.then || step.onSuccess.else) {
          if (step.onSuccess.then && !workflow.steps.find(s => s.id === step.onSuccess.then)) {
            errors.push(`Step ${step.id} references unknown step in onSuccess.then: ${step.onSuccess.then}`);
          }
          if (step.onSuccess.else && !workflow.steps.find(s => s.id === step.onSuccess.else)) {
            errors.push(`Step ${step.id} references unknown step in onSuccess.else: ${step.onSuccess.else}`);
          }
        }
      }
      
      if (step.onFailure && typeof step.onFailure === "string") {
        if (!workflow.steps.find(s => s.id === step.onFailure)) {
          errors.push(`Step ${step.id} references unknown step in onFailure: ${step.onFailure}`);
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert visual format to YAML workflow
   */
  static visualToYAML(visualWorkflow) {
    const steps = visualWorkflow.nodes.map(node => {
      const step = {
        id: node.data.stepId || node.id,
        module: node.data.module,
        action: node.data.action
      };
      
      if (node.data.inputs) {
        step.inputs = node.data.inputs;
      }
      
      if (node.data.outputs) {
        step.outputs = node.data.outputs;
      }
      
      // Find outgoing edges
      const successEdge = visualWorkflow.edges.find(
        e => e.source === node.id && e.condition === "success"
      );
      const failureEdge = visualWorkflow.edges.find(
        e => e.source === node.id && e.condition === "failure"
      );
      
      if (successEdge) {
        if (successEdge.conditionExpression) {
          step.onSuccess = {
            condition: successEdge.conditionExpression,
            then: successEdge.target,
            else: failureEdge?.target || null
          };
        } else {
          step.onSuccess = successEdge.target;
        }
      }
      
      if (failureEdge) {
        step.onFailure = failureEdge.target;
      }
      
      return step;
    });
    
    return {
      name: visualWorkflow.name || "Untitled Workflow",
      version: visualWorkflow.version || "1.0.0",
      description: visualWorkflow.description || "",
      steps
    };
  }

  /**
   * Convert YAML workflow to visual format
   */
  static yamlToVisual(yamlWorkflow) {
    const nodes = yamlWorkflow.steps.map((step, index) => {
      // Calculate position (simple grid layout)
      const x = 200;
      const y = 100 + (index * 150);
      
      return {
        id: step.id,
        type: "step",
        position: { x, y },
        data: {
          stepId: step.id,
          module: step.module,
          action: step.action,
          inputs: step.inputs || {},
          outputs: step.outputs || []
        }
      };
    });
    
    const edges = [];
    yamlWorkflow.steps.forEach(step => {
      if (step.onSuccess) {
        if (typeof step.onSuccess === "string") {
          edges.push({
            id: `${step.id}-success`,
            source: step.id,
            target: step.onSuccess,
            condition: "success"
          });
        } else if (step.onSuccess.then) {
          edges.push({
            id: `${step.id}-success-then`,
            source: step.id,
            target: step.onSuccess.then,
            condition: "success",
            conditionExpression: step.onSuccess.condition
          });
          if (step.onSuccess.else) {
            edges.push({
              id: `${step.id}-success-else`,
              source: step.id,
              target: step.onSuccess.else,
              condition: "success",
              conditionExpression: `!(${step.onSuccess.condition})`
            });
          }
        }
      }
      
      if (step.onFailure) {
        edges.push({
          id: `${step.id}-failure`,
          source: step.id,
          target: step.onFailure,
          condition: "failure"
        });
      }
    });
    
    return {
      name: yamlWorkflow.name,
      version: yamlWorkflow.version,
      description: yamlWorkflow.description || "",
      nodes,
      edges
    };
  }
}

module.exports = WorkflowYAMLParser;

