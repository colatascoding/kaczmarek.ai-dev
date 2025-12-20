/**
 * Simple test script to verify workflow rendering
 */

// Simulate DOM
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="modal"><div class="modal-content"><div id="modal-body"></div></div></div></body></html>');
global.document = dom.window.document;
global.window = dom.window;

// Mock workflow data
const mockWorkflow = {
  id: "test-workflow",
  name: "Test Workflow",
  version: "1.0.0",
  description: "A test workflow",
  steps: [
    {
      id: "step1",
      module: "system",
      action: "log",
      description: "Log a message",
      inputs: { message: "Hello" },
      outputs: [{ name: "result", type: "string" }],
      onSuccess: "step2"
    },
    {
      id: "step2",
      module: "system",
      action: "wait",
      description: "Wait",
      inputs: { duration: 1000 }
    }
  ]
};

// Test rendering function
function renderWorkflowSteps(wf) {
  const modalBody = document.getElementById("modal-body");
  
  // Create container
  const container = document.createElement("div");
  container.className = "workflow-steps-view";
  container.id = "workflow-steps-container";
  container.style.display = "block";
  container.style.visibility = "visible";
  
  // Render each step
  if (wf.steps && Array.isArray(wf.steps) && wf.steps.length > 0) {
    wf.steps.forEach((step, index) => {
      const stepCard = document.createElement("div");
      stepCard.className = "workflow-step-card";
      
      const stepId = step.id || `step-${index}`;
      const module = step.module || "unknown";
      const action = step.action || "unknown";
      const description = step.description || "";
      
      stepCard.innerHTML = `
        <div class="workflow-step-header">
          <div class="workflow-step-number">${index + 1}</div>
          <div class="workflow-step-info">
            <h4>${stepId}</h4>
            <div class="workflow-step-meta">
              <span class="module-badge">${module}</span>
              <span class="action-badge">${action}</span>
            </div>
          </div>
        </div>
        ${description ? `<p class="workflow-step-description">${description}</p>` : ""}
      `;
      
      container.appendChild(stepCard);
    });
  }
  
  return container;
}

// Test
console.log("Testing workflow rendering...");
const stepsContainer = renderWorkflowSteps(mockWorkflow);
console.log("Container created:", !!stepsContainer);
console.log("Steps count:", stepsContainer.children.length);
console.log("First step ID:", stepsContainer.querySelector("h4")?.textContent);
console.log("Test passed:", stepsContainer.children.length === 2);

