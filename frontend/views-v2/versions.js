/**
 * Versions View V2
 * Stage-based version management
 */

// Stage renderers are loaded from versions-stage-renderers.js

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
  
  // Start polling for versions with active planning agents
  versions.forEach(version => {
    if (version.planningAgent && 
        version.planningAgent.status !== "completed" && 
        version.planningAgent.status !== "failed" &&
        window.startPlanningAgentPolling) {
      window.startPlanningAgentPolling(version.tag, version.planningAgent.id);
    }
  });
  
  container.innerHTML = versions.map(version => {
    const statusClass = (version.status || "pending").toLowerCase().replace(/\s+/g, "-");
    const hasActivePlanningAgent = version.planningAgent && 
      version.planningAgent.status !== "completed" && 
      version.planningAgent.status !== "failed";
    
    return `
      <div class="version-card-v2" style="margin-bottom: 1.5rem;">
        <div class="version-card-header">
          <div>
            <h3>Version ${version.tag}</h3>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
              <span class="status-badge ${statusClass}">${version.status || "Unknown"}</span>
              ${hasActivePlanningAgent ? `
                <span class="status-badge processing" style="font-size: 0.75rem;">
                  🤖 Planning Agent Running
                </span>
              ` : ""}
            </div>
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
        
        ${(() => {
          const status = (version.status || "").toLowerCase();
          const canReject = status === "in-progress" || (status !== "completed" && status !== "rejected" && status !== "");
          return canReject ? `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
              <button class="btn btn-danger" onclick="rejectVersion('${version.tag}')" style="width: 100%;">
                Reject Version
              </button>
            </div>
          ` : "";
        })()}
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
    const cleanTag = versionTag.replace(/^version/, "");
    const [versionData, stagesData] = await Promise.all([
      window.apiCall(`/api/versions`).then(data => {
        const version = (data.versions || []).find(v => v.tag === cleanTag);
        return version || null;
      }),
      window.loadVersionStages(cleanTag)
    ]);
    
    if (!versionData) {
      window.showNotification("Version not found", "error");
      return;
    }
    
    const displayTag = versionData?.tag || cleanTag;
    document.getElementById("version-detail-title").textContent = `Version ${displayTag}`;
    
    // Store current version tag for later use
    window.currentVersionTag = displayTag;
    
    // Add reject button to header if version is in-progress
    const viewActions = document.querySelector("#version-detail-view .view-actions");
    if (viewActions) {
      const existingRejectBtn = viewActions.querySelector(".btn-reject-version");
      if (existingRejectBtn) {
        existingRejectBtn.remove();
      }
      
      const status = (versionData.status || "").toLowerCase();
      // Show reject button for any status that's not completed or rejected
      if (status !== "completed" && status !== "rejected" && status !== "") {
        const rejectBtn = document.createElement("button");
        rejectBtn.className = "btn btn-danger btn-reject-version";
        rejectBtn.textContent = "🚫 Reject Version";
        rejectBtn.onclick = () => rejectVersion(displayTag);
        viewActions.insertBefore(rejectBtn, viewActions.firstChild);
      }
    }
    
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
      if (window.showStage) {
        window.showStage(stageName);
      }
    } else {
      // Default to implement stage
      if (window.showStage) {
        window.showStage("implement");
      }
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
    // Remove "version" prefix if present
    const cleanTag = versionTag.replace(/^version/, "");
    const data = await window.apiCall(`/api/versions`);
    const version = (data.versions || []).find(v => v.tag === cleanTag || v.tag === versionTag);
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
    // Remove "version" prefix if present
    const cleanTag = versionTag.replace(/^version/, "");
    
    // Map stage names
    const stageMap = {
      plan: "01_plan",
      implement: "02_implement",
      test: "03_test",
      review: "04_review"
    };
    
    // stageFolder is for future use
    // const stageFolder = stageMap[stage] || stage;
    
    // Load stage-specific content
    switch (stage) {
      case "plan":
        await renderPlanStage(cleanTag, container);
        break;
      case "implement":
        await renderImplementStage(cleanTag, container);
        break;
      case "test":
        await renderTestStage(cleanTag, container);
        break;
      case "review":
        await renderReviewStage(cleanTag, container);
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
  // Load stage summary
  let summary = null;
  try {
    const summaryData = await window.apiCall(`/api/versions/${versionTag}/plan/summary`);
    summary = summaryData.summary;
  } catch (error) {
    // 404 is expected if stage doesn't exist yet, don't log as error
    if (error.message && !error.message.includes("404") && !error.message.includes("Not Found")) {
      console.error("Failed to load plan summary:", error);
    }
  }
  
  // Check for planning agent status
  let agentStatus = null;
  try {
    const agentData = await window.apiCall(`/api/versions/${versionTag}/planning-agent-status`);
    if (agentData.hasAgent) {
      agentStatus = agentData.agent;
      // Start polling if agent is still running
      if (agentStatus.status !== "completed" && agentStatus.status !== "failed") {
        if (window.startPlanningAgentPolling) {
          window.startPlanningAgentPolling(versionTag, agentStatus.id);
        }
      }
    }
  } catch (error) {
    console.error("Failed to load planning agent status:", error);
  }
  
  container.innerHTML = `
    <div class="stage-wizard-content">
      <h3>Planning Stage</h3>
      
      ${agentStatus ? `
        <div style="background: ${agentStatus.status === "completed" ? "var(--success-light, #e8f5e9)" : agentStatus.status === "failed" ? "var(--error-bg, #fee)" : "var(--primary-light, #e3f2fd)"}; border-left: 4px solid ${agentStatus.status === "completed" ? "var(--success, #4caf50)" : agentStatus.status === "failed" ? "var(--error, #f44336)" : "var(--primary)"}; padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <h4 style="margin: 0; color: ${agentStatus.status === "completed" ? "var(--success)" : agentStatus.status === "failed" ? "var(--error)" : "var(--primary)"};">
              ${agentStatus.status === "completed" ? "✓ Planning Agent Completed" : agentStatus.status === "failed" ? "✗ Planning Agent Failed" : "🤖 Planning Agent Running"}
            </h4>
            <span class="status-badge ${agentStatus.status}">${agentStatus.status}</span>
          </div>
          ${agentStatus.status === "running" || agentStatus.status === "processing" ? `
            <p style="margin: 0.5rem 0; color: var(--text);">
              The AI agent is analyzing your project and generating goals. This may take a few minutes.
            </p>
            <div style="margin-top: 0.75rem;">
              <div class="progress-bar">
                <div class="progress-fill" style="width: 50%; animation: pulse 2s infinite;"></div>
              </div>
            </div>
          ` : agentStatus.status === "completed" ? `
            <p style="margin: 0.5rem 0; color: var(--text);">
              The planning agent has completed and generated your version goals. Review and edit as needed below.
            </p>
          ` : agentStatus.status === "failed" ? `
            <p style="margin: 0.5rem 0; color: var(--text);">
              The planning agent encountered an error: ${agentStatus.error || "Unknown error"}. You can manually create goals below.
            </p>
          ` : ""}
          ${agentStatus.cloudAgentId ? `
            <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-light);">
              Agent ID: <a href="https://cursor.com/dashboard/agents/${agentStatus.cloudAgentId}" target="_blank" style="color: var(--primary);">${agentStatus.cloudAgentId.substring(0, 8)}...</a>
            </p>
          ` : ""}
        </div>
      ` : ""}
      
      ${summary ? `
        <div style="background: var(--primary-light); border-left: 4px solid var(--primary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <h4 style="margin: 0; color: var(--primary);">Current Plan Status</h4>
            <span class="status-badge ${summary.status}">${summary.status}</span>
          </div>
          <p style="margin: 0.5rem 0; color: var(--text);">${summary.summary}</p>
          ${summary.progress > 0 ? `
            <div style="margin-top: 0.75rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.875rem;">
                <span>Progress</span>
                <span>${summary.progress}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${summary.progress}%"></div>
              </div>
            </div>
          ` : ""}
          ${summary.details?.goals && summary.details.goals.length > 0 ? `
            <div style="margin-top: 1rem;">
              <strong style="font-size: 0.875rem;">Goals:</strong>
              <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0; font-size: 0.875rem;">
                ${summary.details.goals.slice(0, 5).map(g => `
                  <li style="margin-bottom: 0.25rem;">
                    ${g.completed ? "✓" : "○"} ${g.text}
                  </li>
                `).join("")}
                ${summary.details.goals.length > 5 ? `<li style="color: var(--text-light);">... and ${summary.details.goals.length - 5} more</li>` : ""}
              </ul>
            </div>
          ` : ""}
        </div>
      ` : ""}
      
      <p style="color: var(--text-light); margin-bottom: 1.5rem;">Define goals and scope for this version</p>
      
      <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.5rem 0;">Goals</h4>
        <div id="plan-goals-list"></div>
        <button class="btn btn-sm btn-secondary" onclick="addPlanGoal()" style="margin-top: 0.5rem;">+ Add Goal</button>
      </div>
      
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary" onclick="savePlanStage('${versionTag}')">Save</button>
        <button class="btn btn-secondary" onclick="markStageComplete('${versionTag}', 'plan')">Mark Complete</button>
        ${agentStatus && (agentStatus.status === "running" || agentStatus.status === "processing") ? `
          <button class="btn btn-sm" onclick="refreshPlanStage('${versionTag}')">Refresh Status</button>
        ` : ""}
      </div>
    </div>
  `;
  
  // Load existing goals
  if (summary?.details?.goals) {
    const goalsList = document.getElementById("plan-goals-list");
    if (goalsList) {
      goalsList.innerHTML = summary.details.goals.map((goal, index) => `
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
          <input type="text" value="${goal.text}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);"
                 onchange="updatePlanGoal(${index}, this.value)">
          <button class="btn btn-sm" onclick="removePlanGoal(${index})">Remove</button>
        </div>
      `).join("");
    }
  }
}

/**
 * Render implement stage
 */
async function renderImplementStage(versionTag, container) {
  // Load stage summary
  let summary = null;
  try {
    const summaryData = await window.apiCall(`/api/versions/${versionTag}/implement/summary`);
    summary = summaryData.summary;
  } catch (error) {
    // 404 is expected if stage doesn't exist yet, don't log as error
    if (error.message && !error.message.includes("404") && !error.message.includes("Not Found")) {
      console.error("Failed to load implement summary:", error);
    }
  }
  
  // Load workstreams (data used in renderImplementStage in versions-stage-renderers.js)
  await window.apiCall(`/api/workstreams?versionTag=${versionTag}`).catch(() => ({ workstreams: [] }));
  
  container.innerHTML = `
    <div class="stage-wizard-content">
      <h3>Implementation Stage</h3>
      
      ${summary ? `
        <div style="background: var(--primary-light); border-left: 4px solid var(--primary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <h4 style="margin: 0; color: var(--primary);">Current Implementation Status</h4>
            <span class="status-badge ${summary.status}">${summary.status}</span>
          </div>
          <p style="margin: 0.5rem 0; color: var(--text);">${summary.summary}</p>
          ${summary.progress > 0 ? `
            <div style="margin-top: 0.75rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.875rem;">
                <span>Progress</span>
                <span>${summary.progress}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${summary.progress}%"></div>
              </div>
            </div>
          ` : ""}
          ${summary.details?.recentActivity && summary.details.recentActivity.length > 0 ? `
            <div style="margin-top: 1rem;">
              <strong style="font-size: 0.875rem;">Recent Activity:</strong>
              <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0; font-size: 0.875rem; color: var(--text-light);">
                ${summary.details.recentActivity.map(activity => `<li style="margin-bottom: 0.25rem;">${activity}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
        </div>
      ` : ""}
      
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
  // Load stage summary
  let summary = null;
  try {
    const summaryData = await window.apiCall(`/api/versions/${versionTag}/test/summary`);
    summary = summaryData.summary;
  } catch (error) {
    // 404 is expected if stage doesn't exist yet, don't log as error
    if (error.message && !error.message.includes("404") && !error.message.includes("Not Found")) {
      console.error("Failed to load test summary:", error);
    }
  }
  
  container.innerHTML = `
    <div class="stage-wizard-content">
      <h3>Testing Stage</h3>
      
      ${summary ? `
        <div style="background: var(--primary-light); border-left: 4px solid var(--primary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <h4 style="margin: 0; color: var(--primary);">Current Test Status</h4>
            <span class="status-badge ${summary.status}">${summary.status}</span>
          </div>
          <p style="margin: 0.5rem 0; color: var(--text);">${summary.summary}</p>
          ${summary.progress > 0 ? `
            <div style="margin-top: 0.75rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.875rem;">
                <span>Test Progress</span>
                <span>${summary.progress}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${summary.progress}%"></div>
              </div>
            </div>
          ` : ""}
          ${summary.details?.testCases && summary.details.testCases.length > 0 ? `
            <div style="margin-top: 1rem;">
              <strong style="font-size: 0.875rem;">Test Results:</strong>
              <div style="margin-top: 0.5rem; font-size: 0.875rem;">
                <span style="color: var(--success);">✓ ${summary.details.passedTests} passed</span>
                ${summary.details.failedTests > 0 ? `<span style="color: var(--error); margin-left: 1rem;">✗ ${summary.details.failedTests} failed</span>` : ""}
              </div>
            </div>
          ` : ""}
        </div>
      ` : ""}
      
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
  // Load stage summary
  let summary = null;
  try {
    const summaryData = await window.apiCall(`/api/versions/${versionTag}/review/summary`);
    summary = summaryData.summary;
  } catch (error) {
    // 404 is expected if stage doesn't exist yet, don't log as error
    if (error.message && !error.message.includes("404") && !error.message.includes("Not Found")) {
      console.error("Failed to load review summary:", error);
    }
  }
  
  container.innerHTML = `
    <div class="stage-wizard-content">
      <h3>Review Stage</h3>
      
      ${summary ? `
        <div style="background: var(--primary-light); border-left: 4px solid var(--primary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <h4 style="margin: 0; color: var(--primary);">Current Review Status</h4>
            <span class="status-badge ${summary.status}">${summary.status}</span>
          </div>
          ${summary.details?.summary ? `
            <p style="margin: 0.5rem 0; color: var(--text); font-style: italic;">${summary.details.summary}</p>
          ` : ""}
          <p style="margin: 0.5rem 0; color: var(--text);">${summary.summary}</p>
          ${summary.progress > 0 ? `
            <div style="margin-top: 0.75rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.875rem;">
                <span>Completion Progress</span>
                <span>${summary.progress}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${summary.progress}%"></div>
              </div>
            </div>
          ` : ""}
          ${summary.details?.nextSteps && summary.details.nextSteps.length > 0 ? `
            <div style="margin-top: 1rem;">
              <strong style="font-size: 0.875rem;">Next Steps:</strong>
              <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0; font-size: 0.875rem;">
                ${summary.details.nextSteps.slice(0, 5).map(step => `
                  <li style="margin-bottom: 0.25rem;">
                    ${step.completed ? "✓" : "○"} ${step.text}
                  </li>
                `).join("")}
                ${summary.details.nextSteps.length > 5 ? `<li style="color: var(--text-light);">... and ${summary.details.nextSteps.length - 5} more</li>` : ""}
              </ul>
            </div>
          ` : ""}
        </div>
      ` : ""}
      
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
      
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button class="btn btn-primary" onclick="window.runWorkflow && window.runWorkflow('review-self')">Run Review Workflow</button>
        <button class="btn btn-secondary" onclick="markStageComplete('${versionTag}', 'review')">Mark Complete</button>
        <button class="btn btn-primary" onclick="createNextVersion('${versionTag}')">Create Next Version</button>
        <button class="btn btn-danger" onclick="rejectVersion('${versionTag}')" style="margin-left: auto;">Reject Version</button>
      </div>
    </div>
  `;
}

/**
 * Refresh version detail
 */
function refreshVersionDetail() {
  const currentVersionTag = window.currentVersionTag || document.getElementById("version-detail-title")?.textContent?.replace("Version ", "");
  if (currentVersionTag) {
    loadVersionDetail(currentVersionTag);
  }
}

/**
 * Reject version
 */
async function rejectVersion(versionTag) {
  if (!confirm(`Are you sure you want to reject version ${versionTag}? This will mark it as rejected and allow creating a new version.`)) {
    return;
  }
  
  const reason = prompt("Please provide a reason for rejection (optional):");
  
  try {
    await window.apiCall(`/api/versions/${versionTag}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || null }),
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    window.showNotification(`Version ${versionTag} rejected successfully`, "success");
    
    // Refresh versions list
    await loadVersionsV2();
    
    // If viewing this version, refresh the detail view
    const currentVersionTag = window.currentVersionTag || document.getElementById("version-detail-title")?.textContent?.replace("Version ", "");
    if (currentVersionTag === versionTag || currentVersionTag === `version${versionTag}`) {
      if (window.showVersionDetail) {
        await window.showVersionDetail(versionTag);
      } else if (window.loadVersionDetail) {
        await window.loadVersionDetail(versionTag);
      }
    }
  } catch (error) {
    console.error("Failed to reject version:", error);
    window.showNotification(`Failed to reject version: ${error.message}`, "error");
  }
}

/**
 * Planning agent polling
 */
const planningAgentIntervals = new Map();

function startPlanningAgentPolling(versionTag, _agentTaskId) {
  // Stop existing polling for this version if any
  if (planningAgentIntervals.has(versionTag)) {
    clearInterval(planningAgentIntervals.get(versionTag));
  }
  
  // Start polling
  const interval = setInterval(async () => {
    try {
      const agentData = await window.apiCall(`/api/versions/${versionTag}/planning-agent-status`);
      
      if (agentData.hasAgent) {
        const agent = agentData.agent;
        
        // Stop polling if agent completed or failed
        if (agent.status === "completed" || agent.status === "failed") {
          stopPlanningAgentPolling(versionTag);
          
          // Show notification
          if (agent.status === "completed") {
            window.showNotification(`Planning agent completed for version ${versionTag}. Goals have been generated.`, "success");
          } else {
            window.showNotification(`Planning agent failed for version ${versionTag}: ${agent.error || "Unknown error"}`, "error");
          }
          
          // Refresh plan stage if we're viewing it
          const currentVersionTag = window.currentVersionTag || document.getElementById("version-detail-title")?.textContent?.replace("Version ", "");
          if (currentVersionTag === versionTag || currentVersionTag === `version${versionTag}`) {
            const stageContent = document.getElementById("stage-content");
            if (stageContent && document.querySelector(".stage-nav-btn[data-stage='plan']")?.classList.contains("active")) {
              await renderPlanStage(versionTag, stageContent);
            }
          }
          
          // Refresh versions list
          if (window.loadVersionsV2) {
            await window.loadVersionsV2();
          }
        }
      } else {
        // Agent not found, stop polling
        stopPlanningAgentPolling(versionTag);
      }
    } catch (error) {
      console.error("Failed to check planning agent status:", error);
    }
  }, 5000); // Check every 5 seconds
  
  planningAgentIntervals.set(versionTag, interval);
}

function stopPlanningAgentPolling(versionTag) {
  if (planningAgentIntervals.has(versionTag)) {
    clearInterval(planningAgentIntervals.get(versionTag));
    planningAgentIntervals.delete(versionTag);
  }
}

/**
 * Refresh plan stage (reloads content and agent status)
 */
async function refreshPlanStage(versionTag) {
  const container = document.getElementById("stage-content");
  if (container) {
    await renderPlanStage(versionTag, container);
  }
}

// Expose globally
window.loadVersionsV2 = loadVersionsV2;
// showVersionDetail is already defined above, just expose it
window.loadVersionDetail = loadVersionDetail;
window.loadVersionStages = loadVersionStages;
window.loadStageContent = loadStageContent;
window.refreshVersionDetail = refreshVersionDetail;
window.rejectVersion = rejectVersion;
window.startPlanningAgentPolling = startPlanningAgentPolling;
window.stopPlanningAgentPolling = stopPlanningAgentPolling;
window.refreshPlanStage = refreshPlanStage;

