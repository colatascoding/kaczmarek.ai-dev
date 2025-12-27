/**
 * Wizards V2
 * Version creation, workstream creation, and stage wizards
 */

let versionWizardStep = 0;
let versionWizardData = {};

/**
 * Open version creation wizard
 */
async function openVersionCreationWizard() {
  versionWizardStep = 0;
  versionWizardData = {};
  
  // Fetch suggested next version
  try {
    const nextVersionData = await window.apiCall("/api/versions/next");
    if (nextVersionData.suggested) {
      versionWizardData.major = nextVersionData.suggested.major;
      versionWizardData.minor = nextVersionData.suggested.minor;
      versionWizardData.canCreate = nextVersionData.canCreate;
      versionWizardData.reason = nextVersionData.reason;
    }
  } catch (error) {
    console.error("Failed to fetch next version:", error);
    // Default to 0-0 if fetch fails
    versionWizardData.major = 0;
    versionWizardData.minor = 0;
    versionWizardData.canCreate = true;
  }
  
  const modal = document.getElementById("version-wizard-modal");
  modal.classList.add("active");
  
  renderVersionWizardStep();
}

/**
 * Close version creation wizard
 */
function closeVersionWizard() {
  const modal = document.getElementById("version-wizard-modal");
  modal.classList.remove("active");
  versionWizardStep = 0;
  versionWizardData = {};
}

/**
 * Render version wizard step
 */
function renderVersionWizardStep() {
  const container = document.getElementById("version-wizard-steps");
  const nextBtn = document.getElementById("version-wizard-next");
  
  switch (versionWizardStep) {
    case 0:
      renderVersionWizardStep1(container, nextBtn);
      break;
    case 1:
      renderVersionWizardStep2(container, nextBtn);
      break;
    case 2:
      renderVersionWizardStep3(container, nextBtn);
      break;
    default:
      container.innerHTML = "<p>Unknown step</p>";
  }
}

/**
 * Step 1: Version number and type
 */
function renderVersionWizardStep1(container, nextBtn) {
  const canCreate = versionWizardData.canCreate !== false;
  const reason = versionWizardData.reason || "";
  
  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.5rem 0;">Step 1 of 3: Version Information</h4>
      <p style="color: var(--text-light); font-size: 0.875rem;">Define the version number and type</p>
    </div>
    
    ${!canCreate ? `
      <div style="background: var(--error-bg, #fee); color: var(--error-text, #c00); padding: 1rem; border-radius: var(--radius); margin-bottom: 1rem; border: 1px solid var(--error-border, #fcc);">
        <strong>⚠️ Cannot Create New Version</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem;">${reason || "Current version must be completed or rejected first."}</p>
      </div>
    ` : ""}
    
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Version Type</label>
      <div style="display: flex; gap: 1rem;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="radio" name="versionType" value="major" ${versionWizardData.type === "major" ? "checked" : ""} onchange="versionWizardData.type = 'major'" ${!canCreate ? "disabled" : ""}>
          <span>Major Version</span>
        </label>
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="radio" name="versionType" value="minor" ${versionWizardData.type === "minor" || !versionWizardData.type ? "checked" : ""} onchange="versionWizardData.type = 'minor'" ${!canCreate ? "disabled" : ""}>
          <span>Minor Version</span>
        </label>
      </div>
    </div>
    
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Version Number <span style="color: var(--text-light); font-size: 0.875rem; font-weight: normal;">(suggested)</span></label>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <input type="number" id="version-major" placeholder="0" min="0" value="${versionWizardData.major !== undefined ? versionWizardData.major : ""}" 
               style="width: 80px; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);" 
               onchange="versionWizardData.major = parseInt(this.value)" ${!canCreate ? "disabled" : ""}>
        <span style="font-size: 1.25rem;">-</span>
        <input type="number" id="version-minor" placeholder="0" min="0" value="${versionWizardData.minor !== undefined ? versionWizardData.minor : ""}" 
               style="width: 80px; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);" 
               onchange="versionWizardData.minor = parseInt(this.value)" ${!canCreate ? "disabled" : ""}>
      </div>
      <p id="version-preview" style="margin-top: 0.5rem; color: var(--text-light); font-size: 0.875rem;">
        Version: ${versionWizardData.major !== undefined ? versionWizardData.major : 0}-${versionWizardData.minor !== undefined ? versionWizardData.minor : 0}
      </p>
    </div>
  `;
  
  nextBtn.textContent = "Next: Goals →";
  nextBtn.disabled = !canCreate;
  nextBtn.onclick = () => {
    if (!canCreate) {
      window.showNotification(reason || "Cannot create new version. Complete or reject current version first.", "error");
      return;
    }
    if (versionWizardData.major === undefined && versionWizardData.major !== 0) {
      window.showNotification("Please enter a major version number", "error");
      return;
    }
    if (versionWizardData.minor === undefined && versionWizardData.minor !== 0) {
      window.showNotification("Please enter a minor version number", "error");
      return;
    }
    versionWizardStep = 1;
    renderVersionWizardStep();
  };
  
  // Update preview on change
  const majorInput = document.getElementById("version-major");
  const minorInput = document.getElementById("version-minor");
  const preview = document.getElementById("version-preview");
  
  [majorInput, minorInput].forEach(input => {
    if (input) {
      input.addEventListener("input", () => {
        const major = document.getElementById("version-major")?.value || 0;
        const minor = document.getElementById("version-minor")?.value || 0;
        if (preview) {
          preview.textContent = `Version: ${major}-${minor}`;
        }
      });
    }
  });
}

/**
 * Step 2: Goals
 */
function renderVersionWizardStep2(container, nextBtn) {
  const goals = versionWizardData.goals || [];
  const useAI = versionWizardData.useAI !== false; // Default to true if not set
  
  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.5rem 0;">Step 2 of 3: Define Goals</h4>
      <p style="color: var(--text-light); font-size: 0.875rem;">Choose how to generate the plan</p>
    </div>
    
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
      <label style="display: flex; align-items: start; gap: 0.75rem; cursor: pointer;">
        <input type="radio" name="planMethod" value="ai" ${useAI ? "checked" : ""} 
               onchange="versionWizardData.useAI = true; renderVersionWizardStep();" style="margin-top: 0.25rem;">
        <div style="flex: 1;">
          <div style="font-weight: 500; margin-bottom: 0.25rem;">🤖 Generate Plan with AI Agent</div>
          <div style="font-size: 0.875rem; color: var(--text-light);">
            Launch a Cursor Cloud Agent to analyze the project and automatically generate goals and objectives for this version.
            The agent will review recent changes, current state, and create a comprehensive plan.
          </div>
        </div>
      </label>
    </div>
    
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
      <label style="display: flex; align-items: start; gap: 0.75rem; cursor: pointer;">
        <input type="radio" name="planMethod" value="manual" ${!useAI ? "checked" : ""} 
               onchange="versionWizardData.useAI = false; renderVersionWizardStep();" style="margin-top: 0.25rem;">
        <div style="flex: 1;">
          <div style="font-weight: 500; margin-bottom: 0.25rem;">✏️ Manual Entry</div>
          <div style="font-size: 0.875rem; color: var(--text-light);">
            Manually define goals for this version.
          </div>
        </div>
      </label>
    </div>
    
    ${!useAI ? `
      <div id="wizard-goals-list" style="margin-bottom: 1rem;">
        ${goals.map((goal, index) => `
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" value="${goal}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);"
                   onchange="versionWizardData.goals[${index}] = this.value">
            <button class="btn btn-sm" onclick="removeWizardGoal(${index})">Remove</button>
          </div>
        `).join("")}
        ${goals.length === 0 ? '<p style="color: var(--text-light); font-size: 0.875rem;">No goals added yet</p>' : ""}
      </div>
      
      <button class="btn btn-secondary btn-sm" onclick="addWizardGoal()">+ Add Goal</button>
    ` : `
      <div style="padding: 1rem; background: var(--primary-light, #e3f2fd); border-left: 4px solid var(--primary); border-radius: var(--radius);">
        <p style="margin: 0; font-size: 0.875rem; color: var(--text);">
          The AI agent will analyze your project and generate a comprehensive plan after the version is created.
          You can review and edit the generated plan in the Planning stage.
        </p>
      </div>
    `}
  `;
  
  nextBtn.textContent = "Next: Review →";
  nextBtn.onclick = () => {
    versionWizardStep = 2;
    renderVersionWizardStep();
  };
}

/**
 * Step 3: Review and create
 */
function renderVersionWizardStep3(container, nextBtn) {
  const versionTag = `${versionWizardData.major}-${versionWizardData.minor}`;
  
  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.5rem 0;">Step 3 of 3: Review</h4>
      <p style="color: var(--text-light); font-size: 0.875rem;">Review and create the version</p>
    </div>
    
    <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1rem;">
      <div style="margin-bottom: 0.75rem;">
        <strong>Version:</strong> ${versionTag}
      </div>
      <div style="margin-bottom: 0.75rem;">
        <strong>Type:</strong> ${versionWizardData.type || "minor"}
      </div>
      <div>
        <strong>Goals (${(versionWizardData.goals || []).length}):</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0;">
          ${(versionWizardData.goals || []).map(goal => `<li>${goal}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
  
  nextBtn.textContent = "Create Version";
  nextBtn.onclick = createVersionFromWizard;
}

/**
 * Add wizard goal
 */
function addWizardGoal() {
  if (!versionWizardData.goals) {
    versionWizardData.goals = [];
  }
  versionWizardData.goals.push("");
  renderVersionWizardStep();
}

/**
 * Remove wizard goal
 */
function removeWizardGoal(index) {
  if (versionWizardData.goals) {
    versionWizardData.goals.splice(index, 1);
    renderVersionWizardStep();
  }
}

/**
 * Next version wizard step
 */
function nextVersionWizardStep() {
  // Handler is set in renderVersionWizardStep
}

/**
 * Create version from wizard
 */
async function createVersionFromWizard() {
  try {
    const versionTag = `${versionWizardData.major}-${versionWizardData.minor}`;
    const useAI = versionWizardData.useAI !== false;
    
    // Show loading state
    const nextBtn = document.getElementById("version-wizard-next");
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = "Creating Version...";
    }
    
    const data = await window.apiCall("/api/versions", {
      method: "POST",
      body: JSON.stringify({
        major: versionWizardData.major,
        minor: versionWizardData.minor,
        type: versionWizardData.type || "minor",
        goals: versionWizardData.goals || [],
        launchPlanningAgent: useAI
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (useAI && data.agentTaskId) {
      window.showNotification(
        `Version ${versionTag} created. Planning agent launched. Generating plan in the background...`, 
        "success"
      );
      
      // Start polling for agent status
      if (window.startPlanningAgentPolling) {
        window.startPlanningAgentPolling(versionTag, data.agentTaskId);
      }
    } else {
      window.showNotification(`Version ${versionTag} created successfully`, "success");
    }
    
    closeVersionWizard();
    
    // Refresh home and versions
    if (window.loadVersionsV2) {
      await window.loadVersionsV2();
    }
    if (window.refreshHome) {
      await window.refreshHome();
    }
    
    // Switch to versions view and show new version
    window.switchView("versions");
    setTimeout(() => {
      if (window.showVersionDetail) {
        window.showVersionDetail(versionTag);
      }
    }, 100);
  } catch (error) {
    console.error("Failed to create version:", error);
    window.showNotification(`Failed to create version: ${error.message}`, "error");
    
    // Re-enable button on error
    const nextBtn = document.getElementById("version-wizard-next");
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.textContent = "Create Version";
    }
  }
}

/**
 * Open workstream wizard
 */
function openWorkstreamWizard() {
  const modal = document.getElementById("workstream-wizard-modal");
  modal.classList.add("active");
  
  const form = document.getElementById("workstream-wizard-form");
  form.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Workstream Name</label>
      <input type="text" id="workstream-name" placeholder="e.g., Feature A" 
             style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);">
    </div>
    
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Description (optional)</label>
      <textarea id="workstream-description" placeholder="Describe what this workstream will accomplish" 
                style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius); min-height: 80px;"></textarea>
    </div>
    
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Version</label>
      <input type="text" id="workstream-version" value="${window.currentVersionTag || ""}" 
             style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);">
    </div>
  `;
}

/**
 * Close workstream wizard
 */
function closeWorkstreamWizard() {
  const modal = document.getElementById("workstream-wizard-modal");
  modal.classList.remove("active");
}

/**
 * Create workstream
 */
async function createWorkstream() {
  try {
    const name = document.getElementById("workstream-name")?.value;
    const description = document.getElementById("workstream-description")?.value;
    const versionTag = document.getElementById("workstream-version")?.value || window.currentVersion;
    
    if (!name) {
      window.showNotification("Workstream name is required", "error");
      return;
    }
    
    if (!versionTag) {
      window.showNotification("Version tag is required", "error");
      return;
    }
    
    const data = await window.apiCall("/api/workstreams", {
      method: "POST",
      body: JSON.stringify({
        versionTag,
        workstreamName: name,
        description
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    window.showNotification("Workstream created successfully", "success");
    closeWorkstreamWizard();
    
    // Refresh workstreams
    if (window.loadWorkstreams && versionTag) {
      await window.loadWorkstreams(versionTag);
    }
  } catch (error) {
    console.error("Failed to create workstream:", error);
    window.showNotification(`Failed to create workstream: ${error.message}`, "error");
  }
}

/**
 * Show stage wizard
 */
function showStageWizard(versionTag, stageName) {
  const modal = document.getElementById("stage-wizard-modal");
  modal.classList.add("active");
  
  document.getElementById("stage-wizard-title").textContent = `${stageName} - Version ${versionTag}`;
  
  // Load stage-specific wizard content
  const content = document.getElementById("stage-wizard-content");
  content.innerHTML = `<p>Stage wizard for ${stageName} coming soon</p>`;
}

/**
 * Close stage wizard
 */
function closeStageWizard() {
  const modal = document.getElementById("stage-wizard-modal");
  modal.classList.remove("active");
}

// Expose globally
window.openVersionCreationWizard = openVersionCreationWizard;
window.closeVersionWizard = closeVersionWizard;
window.nextVersionWizardStep = nextVersionWizardStep;
window.addWizardGoal = addWizardGoal;
window.removeWizardGoal = removeWizardGoal;
window.openWorkstreamWizard = openWorkstreamWizard;
window.closeWorkstreamWizard = closeWorkstreamWizard;
window.createWorkstream = createWorkstream;
window.showStageWizard = showStageWizard;
window.closeStageWizard = closeStageWizard;

