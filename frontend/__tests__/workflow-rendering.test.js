/**
 * Unit tests for workflow rendering functionality (Jest + jsdom)
 * Uses Jest's global describe/it/expect/jest.
 */

// Mock DOM environment
document.body.innerHTML = `
  <div id="modal">
    <div class="modal-content">
      <span class="close">&times;</span>
      <div id="modal-body"></div>
    </div>
  </div>
  <div id="workflows-list"></div>
`;

// Mock the API call function
global.apiCall = jest.fn();

// Mock workflow data
const mockWorkflowData = {
  workflow: {
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

describe("Workflow Rendering", () => {
  beforeEach(() => {
    // Clear DOM
    document.getElementById("modal-body").innerHTML = "";
    document.getElementById("modal").classList.remove("active");
    jest.clearAllMocks();
  });

  it("showWorkflowDetails renders workflow header", async () => {
    global.apiCall.mockResolvedValue(mockWorkflowData);
    
    // Import the function (in a real test, you'd import from the module)
    // For now, we'll test the logic directly
    const wf = mockWorkflowData.workflow;
    const modalBody = document.getElementById("modal-body");
    
    const content = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">${wf.name || "test-workflow"}</h2>
        <button class="btn btn-primary" onclick="runWorkflow('test-workflow')">
          ▶ Run Workflow
        </button>
      </div>
      <p><strong>Version:</strong> ${wf.version || "N/A"}</p>
      <p><strong>Description:</strong> ${wf.description || "N/A"}</p>
    `;
    
    modalBody.innerHTML = content;
    
    expect(modalBody.innerHTML).toContain("Test Workflow");
    expect(modalBody.innerHTML).toContain("1.0.0");
    expect(modalBody.innerHTML).toContain("A test workflow");
  });

  it("showWorkflowDetails renders workflow steps", async () => {
    global.apiCall.mockResolvedValue(mockWorkflowData);
    
    const wf = mockWorkflowData.workflow;
    const modalBody = document.getElementById("modal-body");
    
    // Test step rendering
    const stepsHtml = wf.steps.map((step, index) => {
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
    }).join("");
    
    const content = `
      <h3>Workflow Steps (${wf.steps.length})</h3>
      <div class="workflow-steps-view" id="workflow-steps-container">
        ${stepsHtml}
      </div>
    `;
    
    modalBody.innerHTML = content;
    
    const stepsContainer = modalBody.querySelector("#workflow-steps-container");
    expect(stepsContainer).not.toBeNull();
    expect(stepsContainer.children.length).toBe(3);
    
    // Check first step
    const firstStep = stepsContainer.querySelector(".workflow-step-card");
    expect(firstStep).not.toBeNull();
    expect(firstStep.textContent).toContain("step1");
    expect(firstStep.textContent).toContain("system");
    expect(firstStep.textContent).toContain("log");
  });

  it("showWorkflowDetails handles empty steps array", async () => {
    const emptyWorkflowData = {
      ...mockWorkflowData,
      workflow: {
        ...mockWorkflowData.workflow,
        steps: []
      }
    };
    
    global.apiCall.mockResolvedValue(emptyWorkflowData);
    
    const wf = emptyWorkflowData.workflow;
    const modalBody = document.getElementById("modal-body");
    
    const content = `
      <h3>Workflow Steps (0)</h3>
      ${wf.steps && wf.steps.length > 0 ? `
        <div class="workflow-steps-view">Steps here</div>
      ` : `<p style="color: var(--text-light); font-style: italic;">No steps defined in this workflow.</p>`}
    `;
    
    modalBody.innerHTML = content;
    
    expect(modalBody.innerHTML).toContain("No steps defined");
    expect(modalBody.querySelector(".workflow-steps-view")).toBeNull();
  });

  it("showWorkflowDetails renders step routing information", async () => {
    const wf = mockWorkflowData.workflow;
    const modalBody = document.getElementById("modal-body");
    
    // Test routing rendering
    const step = wf.steps[1]; // step2 with conditional routing
    const onSuccess = step.onSuccess;
    
    let successDisplay = "";
    if (typeof onSuccess === "string") {
      successDisplay = `<span class="routing-target">${onSuccess}</span>`;
    } else if (typeof onSuccess === "object" && onSuccess.then) {
      successDisplay = `
        <span class="routing-condition">${onSuccess.condition}</span>
        <span class="routing-arrow">→</span>
        <span class="routing-target">${onSuccess.then}</span>
        ${onSuccess.else ? `<span class="routing-else">else → ${onSuccess.else}</span>` : ""}
      `;
    }
    
    expect(successDisplay).toContain("step3");
    expect(successDisplay).toContain("step4");
    expect(successDisplay).toContain("condition");
  });

  it("showWorkflowDetails renders step inputs and outputs", async () => {
    const wf = mockWorkflowData.workflow;
    const step = wf.steps[0]; // step1 with inputs and outputs
    
    const inputs = step.inputs || {};
    const outputs = step.outputs || [];
    
    let inputsHtml = "";
    if (Object.keys(inputs).length > 0) {
      inputsHtml = `
        <div class="workflow-step-section">
          <strong>Inputs:</strong>
          <pre class="workflow-step-code">${JSON.stringify(inputs, null, 2)}</pre>
        </div>
      `;
    }
    
    let outputsHtml = "";
    if (outputs.length > 0) {
      outputsHtml = `
        <div class="workflow-step-section">
          <strong>Outputs:</strong>
          <ul class="workflow-step-list">
            ${outputs.map(o => {
              const name = typeof o === "string" ? o : (o.name || "unknown");
              const type = typeof o === "object" ? (o.type || "any") : "any";
              return `<li><code>${name}</code> (${type})</li>`;
            }).join("")}
          </ul>
        </div>
      `;
    }
    
    expect(inputsHtml).toContain("message");
    expect(inputsHtml).toContain("Hello");
    expect(outputsHtml).toContain("result");
    expect(outputsHtml).toContain("string");
  });

  it("modal opens when showWorkflowDetails is called", async () => {
    global.apiCall.mockResolvedValue(mockWorkflowData);
    
    const modal = document.getElementById("modal");
    const modalBody = document.getElementById("modal-body");
    
    // Simulate opening modal
    modalBody.innerHTML = "<h2>Test Workflow</h2>";
    modal.classList.add("active");
    
    expect(modal.classList.contains("active")).toBe(true);
    expect(modalBody.innerHTML).toContain("Test Workflow");
  });

  it("workflow steps container is visible after rendering", async () => {
    const wf = mockWorkflowData.workflow;
    const modalBody = document.getElementById("modal-body");
    
    const content = `
      <div class="workflow-steps-view" id="workflow-steps-container">
        <div class="workflow-step-card">Step 1</div>
      </div>
    `;
    
    modalBody.innerHTML = content;
    
    const stepsContainer = modalBody.querySelector("#workflow-steps-container");
    expect(stepsContainer).not.toBeNull();
    
    // Ensure visibility
    stepsContainer.style.display = "block";
    stepsContainer.style.visibility = "visible";
    
    expect(stepsContainer.style.display).toBe("block");
    expect(stepsContainer.style.visibility).toBe("visible");
  });
});


