/**
 * Workflows view module
 */

/**
 * Load workflows
 */
async function loadWorkflows() {
  const container = document.getElementById("workflows-list");
  
  // Show loading state
  if (container && window.createSkeletonLoader) {
    container.innerHTML = '';
    container.appendChild(window.createSkeletonLoader('card', 3));
  }
  
  // Update state
  if (window.setState) {
    window.setState({ loading: { ...window.getState('loading'), workflows: true } });
  }
  
  try {
    const data = await window.apiCall("/api/workflows");
    const workflows = data.workflows || [];
    
    // Update state
    if (window.setState) {
      window.setState({ 
        workflows,
        loading: { ...window.getState('loading'), workflows: false },
        errors: { ...window.getState('errors'), workflows: null }
      });
    }
    
    renderWorkflows(workflows);
  } catch (error) {
    console.error("Failed to load workflows:", error);
    
    // Update state
    if (window.setState) {
      window.setState({ 
        loading: { ...window.getState('loading'), workflows: false },
        errors: { ...window.getState('errors'), workflows: error }
      });
    }
    
    // Show error using error handler
    if (window.showError && container) {
      window.showError(container, error, {
        title: 'Failed to Load Workflows',
        showRetry: true,
        onRetry: loadWorkflows
      });
    } else {
      // Fallback
      container.innerHTML = 
        `<div class="empty-state"><p>Failed to load workflows: ${error.message}</p></div>`;
    }
  }
}

/**
 * Render workflows
 */
function renderWorkflows(workflows) {
  const container = document.getElementById("workflows-list");
  
  if (workflows.length === 0) {
    if (window.createEmptyState) {
      container.innerHTML = '';
      container.appendChild(window.createEmptyState(
        'No workflows found. Create workflows in the workflows/ directory.',
        'Refresh',
        loadWorkflows
      ));
    } else {
      container.innerHTML = `<div class="empty-state"><h3>No workflows found</h3><p>Create workflows in the workflows/ directory</p></div>`;
    }
    return;
  }
  
  // Group workflows by source
  const bySource = {
    active: [],
    library: [],
    "version-specific": []
  };
  
  workflows.forEach(wf => {
    const source = wf.source || "active";
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(wf);
  });
  
  // Build HTML with sections
  let html = "";
  
  // Active workflows
  if (bySource.active.length > 0) {
    html += `<div class="workflow-section" style="margin-bottom: 2rem;">
      <h3 style="margin-bottom: 1rem; color: var(--text); font-size: 1.1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
        Active Workflows (${bySource.active.length})
      </h3>
      ${renderWorkflowList(bySource.active)}
    </div>`;
  }
  
  // Library workflows
  if (bySource.library.length > 0) {
    html += `<div class="workflow-section" style="margin-bottom: 2rem;">
      <h3 style="margin-bottom: 1rem; color: var(--text); font-size: 1.1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
        📚 Library Workflows (${bySource.library.length})
      </h3>
      ${renderWorkflowList(bySource.library)}
    </div>`;
  }
  
  // Version-specific workflows
  if (bySource["version-specific"].length > 0) {
    html += `<div class="workflow-section" style="margin-bottom: 2rem;">
      <h3 style="margin-bottom: 1rem; color: var(--text); font-size: 1.1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
        🔖 Version-Specific Workflows (${bySource["version-specific"].length})
      </h3>
      ${renderWorkflowList(bySource["version-specific"])}
    </div>`;
  }
  
  container.innerHTML = html;
}

/**
 * Render a list of workflows
 */
function renderWorkflowList(workflows) {
  return workflows.map(wf => {
    const mode = wf.automationMode || "human-in-the-loop";
    const modeLabel = mode === "automated" ? "Automated" : (mode === "hybrid" ? "Hybrid" : "Human in the loop");
    const source = wf.source || "active";
    const sourceLabel = source === "library" ? "📚 Library" : (source === "version-specific" ? "🔖 Version" : "📁 Active");
    
    // Get category from library item path
    let categoryBadge = "";
    if (wf.libraryItem) {
      const parts = wf.libraryItem.split("/");
      if (parts.length >= 2) {
        const category = parts[1]; // e.g., "implementation", "review", "common"
        categoryBadge = `<span class="badge" style="background: var(--primary-light); color: var(--primary); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: 0.5rem;">${category}</span>`;
      }
    }
    
    return `
    <div class="list-item" onclick="showWorkflowDetails('${wf.id}')" style="cursor: pointer;">
      <div class="list-item-header">
        <div class="list-item-title">${wf.name}${categoryBadge}</div>
        <div class="list-item-meta">
          <span class="source-badge" style="background: var(--bg-secondary); color: var(--text); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-right: 0.5rem;">${sourceLabel}</span>
          <span class="automation-badge automation-${mode}">${modeLabel}</span>
          ${wf.versionTag ? `<span class="version-link">${wf.versionTag}</span>` : ""}
          ${wf.executionCount > 0 ? `<span>${wf.executionCount} executions</span>` : ""}
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); runWorkflow('${wf.id}');" style="margin-left: 0.5rem;">
            ▶ Run
          </button>
        </div>
      </div>
      ${wf.description ? `<div class="list-item-summary">${wf.description}</div>` : ""}
      <div class="list-item-body">
        <p><strong>ID:</strong> ${wf.id}</p>
        <p><strong>Source:</strong> ${sourceLabel}</p>
        ${wf.libraryItem ? `<p><strong>Library:</strong> ${wf.libraryItem}</p>` : ""}
        <p><strong>Mode:</strong> ${modeLabel}</p>
        ${wf.versionTag ? `<p><strong>Version:</strong> <span class="version-link">${wf.versionTag}</span></p>` : ""}
        ${wf.executionCount > 0 ? `<p><strong>Executions:</strong> ${wf.executionCount}</p>` : ""}
      </div>
    </div>
  `;
  }).join("");
}

/**
 * Show workflow details
 */
async function showWorkflowDetails(workflowId) {
  try {
    const data = await window.apiCall(`/api/workflows/${workflowId}`);
    const wf = data.workflow;
    
    console.log("Workflow data:", { workflowId, hasWorkflow: !!wf, stepsCount: wf?.steps?.length, workflow: wf });
    
    if (!wf) {
      console.error("No workflow data received");
      alert("Failed to load workflow data. Check console for details.");
      return;
    }
    
    const modalBody = document.getElementById("modal-body");
    if (!modalBody) {
      console.error("Modal body element not found");
      return;
    }
    
    // Clear any previous content
    modalBody.innerHTML = "";
    
    // Build the content step by step to avoid template string issues
    let content = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">${wf.name || workflowId}</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-primary" onclick="runWorkflow('${workflowId}')">
            ▶ Run Workflow
          </button>
          <button class="btn btn-secondary" onclick="runWorkflowStepByStep('${workflowId}')" title="Run this workflow in step-by-step mode">
            ⏯ Step-by-step
          </button>
        </div>
      </div>
      <p><strong>Version:</strong> ${wf.version || "N/A"}</p>
      ${data.versionTag ? `<p><strong>Version Tag:</strong> <span class="version-link">${data.versionTag}</span></p>` : ""}
      <p><strong>Description:</strong> ${wf.description || "N/A"}</p>
      
      ${data.relatedFiles && data.relatedFiles.length > 0 ? `
        <h3 style="margin-top: 1.5rem;">Related Files (${data.relatedFiles.length})</h3>
        <div class="related-files-list">
          ${data.relatedFiles.map(file => `
            <div class="related-file-item">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="file-type-badge ${file.type}">${file.type}</span>
                <strong>${file.label || file.name}</strong>
                ${file.version ? `<span class="version-link" style="font-size: 0.75rem;">${file.version}</span>` : ""}
              </div>
              <div style="font-size: 0.875rem; color: var(--text-light); margin-top: 0.25rem;">
                ${file.relative}
              </div>
            </div>
          `).join("")}
        </div>
      ` : ""}
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; margin-bottom: 1rem;">
        <h3 style="margin: 0;">Workflow Steps (${wf.steps?.length || 0})</h3>
        <div class="workflow-steps-filter" style="display: flex; gap: 0.5rem; align-items: center;">
          <label style="font-size: 0.875rem; color: var(--text-light);">Filter:</label>
          <button class="filter-btn active" data-filter="all" onclick="filterWorkflowSteps('all', '${workflowId}')" style="padding: 0.375rem 0.75rem; border: 1px solid var(--border); background: var(--card-bg); border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">All</button>
          <button class="filter-btn" data-filter="human" onclick="filterWorkflowSteps('human', '${workflowId}')" style="padding: 0.375rem 0.75rem; border: 1px solid var(--border); background: var(--card-bg); border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">Human</button>
          <button class="filter-btn" data-filter="background-agent" onclick="filterWorkflowSteps('background-agent', '${workflowId}')" style="padding: 0.375rem 0.75rem; border: 1px solid var(--border); background: var(--card-bg); border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">Background Agent</button>
        </div>
      </div>
      ${wf.steps && Array.isArray(wf.steps) && wf.steps.length > 0 ? `
      <div class="workflow-steps-view" id="workflow-steps-container" style="display: block; visibility: visible;">
      </div>
      ` : `<p style="color: var(--text-light); font-style: italic;">No steps defined in this workflow.</p>`}
      
      <details style="margin-top: 1.5rem;">
        <summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Raw Workflow JSON</summary>
        <pre><code>${JSON.stringify(wf.steps || [], null, 2)}</code></pre>
      </details>
      
      <h3 style="margin-top: 1.5rem;">Executions (${data.executions?.length || 0})</h3>
      ${data.executions?.length > 0 ? `
        <ul>
          ${data.executions.map(e => `
            <li>
              <a href="#" onclick="closeModal(); switchView('executions'); showExecutionDetails('${e.executionId}'); return false;">
                ${e.executionId}
              </a>
              - ${e.status} - ${window.formatDateForDisplay(e.startedAt)}
              ${e.agents?.length > 0 ? ` (${e.agents.length} agents)` : ""}
            </li>
          `).join("")}
        </ul>
      ` : "<p>No executions yet</p>"}
    `;
    
    // Set the content
    modalBody.innerHTML = content;
    console.log("Modal content set, steps count:", wf.steps?.length || 0);
    
    // Render steps using DOM API to avoid template string issues
    const stepsContainer = modalBody.querySelector("#workflow-steps-container");
    if (stepsContainer && wf.steps && Array.isArray(wf.steps) && wf.steps.length > 0) {
      console.log("Rendering", wf.steps.length, "steps using DOM API");
      
      wf.steps.forEach((step, index) => {
        let stepCard, stepId, module, action, description, inputs, outputs, onSuccess, onFailure;
        let executionType, executionTypeLabel;
        
        try {
          stepCard = document.createElement("div");
          stepCard.className = "workflow-step-card";
          
          stepId = step.id || `step-${index}`;
          module = step.module || "unknown";
          action = step.action || "unknown";
          description = step.description || "";
          inputs = step.inputs || {};
          outputs = step.outputs || [];
          onSuccess = step.onSuccess;
          onFailure = step.onFailure || "";
          
          // Determine execution type: "background-agent" if module is "agent", otherwise "human"
          executionType = (module === "agent") ? "background-agent" : "human";
          executionTypeLabel = (executionType === "background-agent") ? "Background Agent" : "Human";
          stepCard.setAttribute("data-execution-type", executionType);
          
          // Build success routing display
          let successDisplay = "";
          if (onSuccess) {
            if (typeof onSuccess === "string") {
              successDisplay = `
                <div class="routing-item">
                  <span class="routing-label">On Success:</span>
                  <span class="routing-arrow">→</span>
                  <span class="routing-target">${onSuccess}</span>
                </div>
              `;
            } else if (typeof onSuccess === "object" && onSuccess.then) {
              successDisplay = `
                <div class="routing-item">
                  <span class="routing-label">On Success:</span>
                  ${onSuccess.condition ? `<span class="routing-condition">${onSuccess.condition}</span>` : ""}
                  <span class="routing-arrow">→</span>
                  <span class="routing-target">${onSuccess.then}</span>
                  ${onSuccess.else ? `<span class="routing-else">else → ${onSuccess.else}</span>` : ""}
                </div>
              `;
            }
          }
          
          // Build inputs section
          let inputsHtml = "";
          if (Object.keys(inputs).length > 0) {
            inputsHtml = `
              <div class="workflow-step-section">
                <strong>Inputs:</strong>
                <pre class="workflow-step-code">${JSON.stringify(inputs, null, 2)}</pre>
              </div>
            `;
          }
          
          // Build outputs section
          let outputsHtml = "";
          if (outputs && outputs.length > 0) {
            const outputsList = outputs.map(o => {
              const name = typeof o === "string" ? o : (o.name || "unknown");
              const type = typeof o === "object" ? (o.type || "any") : "any";
              return `<li><code>${name}</code> (${type})</li>`;
            }).join("");
            outputsHtml = `
              <div class="workflow-step-section">
                <strong>Outputs:</strong>
                <ul class="workflow-step-list">${outputsList}</ul>
              </div>
            `;
          }
          
          // Build failure routing
          let failureHtml = "";
          if (onFailure) {
            failureHtml = `
              <div class="routing-item routing-failure">
                <span class="routing-label">On Failure:</span>
                <span class="routing-arrow">→</span>
                <span class="routing-target">${onFailure}</span>
              </div>
            `;
          }
          
          stepCard.innerHTML = `
            <div class="workflow-step-header">
              <div class="workflow-step-number">${index + 1}</div>
              <div class="workflow-step-info">
                <h4>${stepId}</h4>
                <div class="workflow-step-meta">
                  <span class="module-badge">${module}</span>
                  <span class="action-badge">${action}</span>
                  <span class="execution-type-badge execution-type-${executionType}">${executionTypeLabel}</span>
                </div>
              </div>
            </div>
            ${description ? `<p class="workflow-step-description">${description}</p>` : ""}
            ${inputsHtml}
            ${outputsHtml}
            <div class="workflow-step-routing">
              ${successDisplay}
              ${failureHtml}
            </div>
          `;
          
          stepsContainer.appendChild(stepCard);
        } catch (e) {
          console.error("Error rendering step:", e, step);
          const errorCard = document.createElement("div");
          errorCard.className = "workflow-step-card";
          errorCard.innerHTML = `<p style="color: red;">Error rendering step: ${e.message}</p>`;
          stepsContainer.appendChild(errorCard);
        }
      });
      
      console.log("Steps rendered successfully, container now has", stepsContainer.children.length, "step cards");
      stepsContainer.style.display = "block";
      stepsContainer.style.visibility = "visible";
    } else if (wf.steps && Array.isArray(wf.steps) && wf.steps.length > 0) {
      console.error("Steps container not found but steps exist!");
    }
    
    // Show the modal
    const modal = document.getElementById("modal");
    if (modal) {
      modal.classList.add("active");
      console.log("Modal opened");
    } else {
      console.error("Modal element not found");
    }
  } catch (error) {
    console.error("Failed to load workflow details:", error);
    alert("Failed to load workflow details. Check console for details.");
  }
}

/**
 * Filter workflow steps by execution type
 */
function filterWorkflowSteps(filterType, workflowId) {
  const stepsContainer = document.getElementById("workflow-steps-container");
  if (!stepsContainer) return;
  
  // Update filter buttons
  const filterButtons = document.querySelectorAll(`.workflow-steps-filter .filter-btn`);
  filterButtons.forEach(btn => {
    if (btn.getAttribute("data-filter") === filterType) {
      btn.classList.add("active");
      btn.style.background = "var(--primary)";
      btn.style.color = "white";
      btn.style.borderColor = "var(--primary)";
    } else {
      btn.classList.remove("active");
      btn.style.background = "var(--card-bg)";
      btn.style.color = "var(--text)";
      btn.style.borderColor = "var(--border)";
    }
  });
  
  // Filter steps
  const stepCards = stepsContainer.querySelectorAll(".workflow-step-card");
  let visibleCount = 0;
  
  stepCards.forEach(card => {
    const executionType = card.getAttribute("data-execution-type");
    
    if (filterType === "all") {
      card.style.display = "block";
      visibleCount++;
    } else if (filterType === executionType) {
      card.style.display = "block";
      visibleCount++;
    } else {
      card.style.display = "none";
    }
  });
  
  // Update step count in header
  const stepsHeader = document.querySelector("h3");
  if (stepsHeader && stepsHeader.textContent.includes("Workflow Steps")) {
    const totalSteps = stepCards.length;
    if (filterType === "all") {
      stepsHeader.textContent = `Workflow Steps (${totalSteps})`;
    } else {
      stepsHeader.textContent = `Workflow Steps (${visibleCount} of ${totalSteps})`;
    }
  }
  
  console.log(`Filtered steps: showing ${visibleCount} of ${stepCards.length} (filter: ${filterType})`);
}

// Expose globally
window.loadWorkflows = loadWorkflows;
window.renderWorkflows = renderWorkflows;
window.showWorkflowDetails = showWorkflowDetails;
window.filterWorkflowSteps = filterWorkflowSteps;

