/**
 * Versions View V2
 * Stage-based version management
 */

/**
 * Load versions list
 */
async function loadVersionsV2() {
  try {
    const data = await window.apiCall("/api/versions");
    const versions = data.versions || [];
    
    renderVersionsList(versions);
  } catch (error) {
    console.error("Failed to load versions:", error);
    document.getElementById("versions-list").innerHTML = 
      `<div style="text-align: center; padding: 2rem; color: var(--text-light);">
        <p>Failed to load versions: ${error.message}</p>
      </div>`;
  }
}

/**
 * Render versions list
 */
function renderVersionsList(versions) {
  const container = document.getElementById("versions-list");
  
  if (versions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <h3 style="margin-bottom: 1rem;">No Versions Found</h3>
        <p style="color: var(--text-light); margin-bottom: 1.5rem;">Create your first version to get started</p>
        <button class="btn btn-primary" onclick="openVersionCreationWizard()">Create Version</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = versions.map(version => {
    const statusClass = (version.status || "pending").toLowerCase().replace(/\s+/g, "-");
    
    return `
      <div class="version-card-v2" style="margin-bottom: 1.5rem;">
        <div class="version-card-header">
          <div>
            <h3>Version ${version.tag}</h3>
            <span class="status-badge ${statusClass}">${version.status || "Unknown"}</span>
          </div>
          <button class="btn btn-primary" onclick="showVersionDetail('${version.tag}')">View Details</button>
        </div>
        
        ${version.description ? `<p style="color: var(--text-light); margin: 1rem 0;">${version.description}</p>` : ""}
        
        <div class="stage-progress-v2" style="margin: 1rem 0;">
          <div class="stage-progress-bar">
            ${renderVersionStageProgress(version)}
          </div>
        </div>
        
        ${version.stages ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
            ${version.stages.map(stage => `
              <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-weight: 500;">${stage.name}</span>
                  <span class="status-badge ${(stage.status || "pending").toLowerCase().replace(/\s+/g, "-")}">${stage.status || "pending"}</span>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="showStageWizard('${version.tag}', '${stage.name}')" style="width: 100%;">
                  View ${stage.name}
                </button>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

/**
 * Render version stage progress
 */
function renderVersionStageProgress(version) {
  const stages = version.stages || [];
  const stagesMap = {
    plan: stages.find(s => s.name === "01_plan" || s.name === "plan"),
    implement: stages.find(s => s.name === "02_implement" || s.name === "implement"),
    test: stages.find(s => s.name === "03_test" || s.name === "test"),
    review: stages.find(s => s.name === "04_review" || s.name === "review")
  };
  
  const stageNames = ["plan", "implement", "test", "review"];
  let html = "";
  
  stageNames.forEach((stageName, index) => {
    const stage = stagesMap[stageName];
    const status = stage?.status || "pending";
    const statusClass = status === "completed" ? "completed" : 
                       status === "in-progress" ? "active" : "pending";
    
    html += `
      <div class="stage-item ${statusClass}" data-stage="${stageName}">
        <div class="stage-icon">${statusClass === "completed" ? "✓" : statusClass === "active" ? "→" : "○"}</div>
        <div class="stage-label">${stageName.charAt(0).toUpperCase() + stageName.slice(1)}</div>
      </div>
    `;
    
    if (index < stageNames.length - 1) {
      html += `<div class="stage-connector ${statusClass === "completed" ? "completed" : ""}"></div>`;
    }
  });
  
  return html;
}

/**
 * Load version detail
 */
async function loadVersionDetail(versionTag) {
  try {
    const [versionData, stagesData] = await Promise.all([
      window.apiCall(`/api/versions`).then(data => {
        const version = (data.versions || []).find(v => v.tag === versionTag);
        return version || null;
      }),
      window.loadVersionStages(versionTag)
    ]);
    
    if (!versionData) {
      window.showNotification("Version not found", "error");
      return;
    }
    
    document.getElementById("version-detail-title").textContent = `Version ${versionTag}`;
    
    // Update stage nav statuses
    if (stagesData && Array.isArray(stagesData)) {
      stagesData.forEach(stage => {
        const stageName = stage.name.replace(/^\d+_/, ""); // Remove prefix
        const statusEl = document.getElementById(`stage-status-${stageName}`);
        if (statusEl) {
          statusEl.textContent = stage.status || "pending";
          statusEl.className = `stage-nav-status status-badge ${(stage.status || "pending").toLowerCase().replace(/\s+/g, "-")}`;
        }
      });
    }
    
    // Load initial stage (implement if available, otherwise first)
    const initialStage = stagesData?.find(s => s.status === "in-progress") || stagesData?.[0];
    if (initialStage) {
      const stageName = initialStage.name.replace(/^\d+_/, "");
      showStage(stageName);
    }
  } catch (error) {
    console.error("Failed to load version detail:", error);
    window.showNotification("Failed to load version details", "error");
  }
}

/**
 * Load version stages
 */
async function loadVersionStages(versionTag) {
  try {
    const data = await window.apiCall(`/api/versions`);
    const version = (data.versions || []).find(v => v.tag === versionTag);
    return version?.stages || [];
  } catch (error) {
    console.error("Failed to load version stages:", error);
    return [];
  }
}

/**
 * Load stage content
 */
async function loadStageContent(versionTag, stage) {
  const container = document.getElementById("stage-content");
  container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-light);">Loading ${stage} stage...</div>`;
  
  try {
    // Map stage names
    const stageMap = {
      plan: "01_plan",
      implement: "02_implement",
      test: "03_test",
      review: "04_review"
    };
    
    const stageFolder = stageMap[stage] || stage;
    
    // Load stage-specific content
    switch (stage) {
      case "plan":
        await renderPlanStage(versionTag, container);
        break;
      case "implement":
        await renderImplementStage(versionTag, container);
        break;
      case "test":
        await renderTestStage(versionTag, container);
        break;
      case "review":
        await renderReviewStage(versionTag, container);
        break;
      default:
        container.innerHTML = `<p>Unknown stage: ${stage}</p>`;
    }
  } catch (error) {
    console.error("Failed to load stage content:", error);
    container.innerHTML = `<p style="color: var(--error);">Failed to load stage content: ${error.message}</p>`;
  }
}

/**
 * Render plan stage
 */
async function renderPlanStage(versionTag, container) {
  container.innerHTML = `
    <div class="stage-wizard-content">
      <h3>Planning Stage</h3>
      <p style="color: var(--text-light); margin-bottom: 1.5rem;">Define goals and scope for this version</p>
      
      <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.5rem 0;">Goals</h4>
        <div id="plan-goals-list"></div>
        <button class="btn btn-sm btn-secondary" onclick="addPlanGoal()" style="margin-top: 0.5rem;">+ Add Goal</button>
      </div>
      
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary" onclick="savePlanStage('${versionTag}')">Save</button>
        <button class="btn btn-secondary" onclick="markStageComplete('${versionTag}', 'plan')">Mark Complete</button>
      </div>
    </div>
  `;
  
  // Load existing goals
  // TODO: Load from version files
}

/**
 * Render implement stage
 */
async function renderImplementStage(versionTag, container) {
  // Load workstreams
  const workstreamsData = await window.apiCall(`/api/workstreams?versionTag=${versionTag}`).catch(() => ({ workstreams: [] }));
  const workstreams = workstreamsData.workstreams || [];
  
  container.innerHTML = `
    <div class="stage-wizard-content">
      <h3>Implementation Stage</h3>
      <p style="color: var(--text-light); margin-bottom: 1.5rem;">Manage implementation tasks and workstreams</p>
      
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h4 style="margin: 0;">Active Workstreams</h4>
          <button class="btn btn-primary btn-sm" onclick="openWorkstreamWizard()">+ New Workstream</button>
        </div>
        <div id="implement-workstreams-list" class="workstreams-grid-v2"></div>
      </div>
      
      <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius);">
        <h4 style="margin: 0 0 0.5rem 0;">Quick Actions</h4>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-sm" onclick="window.runWorkflow && window.runWorkflow('execute-features')">Extract Next Steps</button>
          <button class="btn btn-sm" onclick="window.runWorkflow && window.runWorkflow('execute-features')">Run Implementation</button>
          <button class="btn btn-sm" onclick="consolidateWorkstreams('${versionTag}')">Consolidate Workstreams</button>
        </div>
      </div>
    </div>
  `;
  
  // Render workstreams
  if (window.loadWorkstreams) {
    await window.loadWorkstreams(versionTag);
    // Move workstreams to implement stage container
    const wsList = document.getElementById("implement-workstreams-list");
    const homeList = document.getElementById("workstreams-list");
    if (wsList && homeList) {
      wsList.innerHTML = homeList.innerHTML;
    }
  }
}

/**
 * Render test stage
 */
async function renderTestStage(versionTag, container) {
  container.innerHTML = `
    <div class="stage-wizard-content">
      <h3>Testing Stage</h3>
      <p style="color: var(--text-light); margin-bottom: 1.5rem;">Run and review tests for this version</p>
      
      <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.5rem 0;">Test Execution</h4>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="runTests('all')">Run All Tests</button>
          <button class="btn btn-secondary" onclick="runTests('unit')">Run Unit Tests</button>
          <button class="btn btn-secondary" onclick="runTests('integration')">Run Integration Tests</button>
        </div>
      </div>
      
      <div id="test-results" style="background: var(--card-bg); padding: 1rem; border-radius: var(--radius);">
        <p style="color: var(--text-light);">No test results yet. Run tests to see results.</p>
      </div>
    </div>
  `;
}

/**
 * Render review stage
 */
async function renderReviewStage(versionTag, container) {
  container.innerHTML = `
    <div class="stage-wizard-content">
      <h3>Review Stage</h3>
      <p style="color: var(--text-light); margin-bottom: 1.5rem;">Review and finalize this version</p>
      
      <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.5rem 0;">Review Checklist</h4>
        <div id="review-checklist">
          <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="checkbox"> Goals completed
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="checkbox"> All tests passing
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="checkbox"> Documentation updated
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox"> Ready for next version
          </label>
        </div>
      </div>
      
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary" onclick="window.runWorkflow && window.runWorkflow('review-self')">Run Review Workflow</button>
        <button class="btn btn-secondary" onclick="markStageComplete('${versionTag}', 'review')">Mark Complete</button>
        <button class="btn btn-primary" onclick="createNextVersion('${versionTag}')">Create Next Version</button>
      </div>
    </div>
  `;
}

/**
 * Refresh version detail
 */
function refreshVersionDetail() {
  if (currentVersion) {
    loadVersionDetail(currentVersion);
  }
}

// Expose globally
window.loadVersionsV2 = loadVersionsV2;
window.loadVersionDetail = loadVersionDetail;
window.loadVersionStages = loadVersionStages;
window.loadStageContent = loadStageContent;
window.refreshVersionDetail = refreshVersionDetail;

