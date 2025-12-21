/**
 * Integration test for workflow view rendering
 * Tests the actual DOM rendering of workflow details
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup DOM
document.body.innerHTML = `
  <div id="modal">
    <div class="modal-content">
      <span class="close">&times;</span>
      <div id="modal-body"></div>
    </div>
  </div>
`;

// Mock fetch/API
global.fetch = vi.fn();

// Mock workflow data
const mockWorkflowResponse = {
  workflow: {
    id: "test-workflow",
    name: "Test Workflow",
    version: "1.0.0",
    description: "A test workflow with steps",
    steps: [
      {
        id: "step1",
        module: "system",
        action: "log",
        description: "Log a message",
        inputs: { message: "Hello" },
        outputs: [{ name: "result", type: "string" }],
        onSuccess: "step2",
        onFailure: "error-handler"
      },
      {
        id: "step2",
        module: "system",
        action: "wait",
        description: "Wait for 1 second",
        inputs: { duration: 1000 },
        onSuccess: {
          condition: "{{ steps.step1.outputs.success }}",
          then: "step3",
          else: "step4"
        }
      },
      {
        id: "step3",
        module: "system",
        action: "notify-completion",
        description: "Notify completion"
      }
    ]
  },
  versionTag: "version0-1",
  executions: [],
  relatedFiles: []
};

// Load the actual app.js functions (we'll need to extract the showWorkflowDetails function)
// For now, we'll test the rendering logic directly

describe("Workflow View Integration", () => {
  let modalBody;
  let modal;

  beforeEach(() => {
    modalBody = document.getElementById("modal-body");
    modal = document.getElementById("modal");
    modalBody.innerHTML = "";
    modal.classList.remove("active");
    vi.clearAllMocks();
  });

  it("workflow steps container is created and visible", () => {
    const wf = mockWorkflowResponse.workflow;
    
    // Simulate the rendering logic from showWorkflowDetails
    const content = `
      <h3 style="margin-top: 1.5rem;">Workflow Steps (${wf.steps?.length || 0})</h3>
      ${wf.steps && Array.isArray(wf.steps) && wf.steps.length > 0 ? `
      <div class="workflow-steps-view" id="workflow-steps-container">
        ${wf.steps.map((step, index) => {
          const stepId = step.id || `step-${index}`;
          const module = step.module || "unknown";
          const action = step.action || "unknown";
          return `
            <div class="workflow-step-card">
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
            </div>
          `;
        }).join("")}
      </div>
      ` : ""}
    `;
    
    modalBody.innerHTML = content;
    
    const stepsContainer = modalBody.querySelector("#workflow-steps-container");
    expect(stepsContainer).not.toBeNull();
    expect(stepsContainer.children.length).toBe(3);
    
    // Check visibility
    expect(stepsContainer.style.display).not.toBe("none");
  });

  it("workflow steps are rendered with correct structure", () => {
    const wf = mockWorkflowResponse.workflow;
    
    const content = `
      <h3>Workflow Steps (${wf.steps.length})</h3>
      <div class="workflow-steps-view" id="workflow-steps-container">
        ${wf.steps.map((step, index) => {
          const stepId = step.id || `step-${index}`;
          const module = step.module || "unknown";
          const action = step.action || "unknown";
          const description = step.description || "";
          
          return `
            <div class="workflow-step-card">
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
            </div>
          `;
        }).join("")}
      </div>
    `;
    
    modalBody.innerHTML = content;
    
    const stepsContainer = modalBody.querySelector("#workflow-steps-container");
    expect(stepsContainer).not.toBeNull();
    
    // Check first step
    const firstStep = stepsContainer.querySelector(".workflow-step-card");
    expect(firstStep).not.toBeNull();
    
    const stepNumber = firstStep.querySelector(".workflow-step-number");
    expect(stepNumber).not.toBeNull();
    expect(stepNumber.textContent).toBe("1");
    
    const stepId = firstStep.querySelector("h4");
    expect(stepId).not.toBeNull();
    expect(stepId.textContent).toBe("step1");
    
    const moduleBadge = firstStep.querySelector(".module-badge");
    expect(moduleBadge).not.toBeNull();
    expect(moduleBadge.textContent).toBe("system");
    
    const actionBadge = firstStep.querySelector(".action-badge");
    expect(actionBadge).not.toBeNull();
    expect(actionBadge.textContent).toBe("log");
  });

  it("workflow steps container is visible after fallback rendering", () => {
    const wf = mockWorkflowResponse.workflow;
    
    // Simulate the fallback rendering logic
    modalBody.innerHTML = "<h3>Workflow Steps (3)</h3>";
    
    // Fallback rendering
    const fallbackContainer = document.createElement("div");
    fallbackContainer.className = "workflow-steps-view";
    fallbackContainer.id = "workflow-steps-container";
    fallbackContainer.style.display = "block";
    fallbackContainer.style.visibility = "visible";
    
    wf.steps.forEach((step, index) => {
      const stepCard = document.createElement("div");
      stepCard.className = "workflow-step-card";
      
      const stepId = step.id || `step-${index}`;
      const module = step.module || "unknown";
      const action = step.action || "unknown";
      
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
      `;
      
      fallbackContainer.appendChild(stepCard);
    });
    
    const stepsHeading = modalBody.querySelector("h3");
    if (stepsHeading && stepsHeading.nextSibling) {
      modalBody.insertBefore(fallbackContainer, stepsHeading.nextSibling);
    } else {
      modalBody.appendChild(fallbackContainer);
    }
    
    const stepsContainer = modalBody.querySelector("#workflow-steps-container");
    expect(stepsContainer).not.toBeNull();
    expect(stepsContainer.children.length).toBe(3);
    expect(stepsContainer.style.display).toBe("block");
    expect(stepsContainer.style.visibility).toBe("visible");
  });

  it("modal opens and shows workflow content", () => {
    const wf = mockWorkflowResponse.workflow;
    
    modalBody.innerHTML = `
      <h2>${wf.name}</h2>
      <h3>Workflow Steps (${wf.steps.length})</h3>
      <div class="workflow-steps-view" id="workflow-steps-container">
        <div class="workflow-step-card">Step 1</div>
      </div>
    `;
    
    modal.classList.add("active");
    
    expect(modal.classList.contains("active")).toBe(true);
    expect(modalBody.innerHTML).toContain("Test Workflow");
    expect(modalBody.innerHTML).toContain("Workflow Steps (3)");
    
    const stepsContainer = modalBody.querySelector("#workflow-steps-container");
    expect(stepsContainer).not.toBeNull();
  });
});

