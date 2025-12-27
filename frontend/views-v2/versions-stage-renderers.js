/**
 * Stage renderers for versions view
 */

// Expose renderPlanStage globally for polling refresh
window.renderPlanStage = renderPlanStage;

/**
 * Render plan stage
 */
async function renderPlanStage(versionTag, container) {
  try {
    // Batch API calls for better performance
    const [summaryResult, agentResult] = await Promise.allSettled([
      window.apiCall(`/api/versions/${versionTag}/plan/summary`),
      window.apiCall(`/api/versions/${versionTag}/planning-agent-status`).catch(() => ({ hasAgent: false }))
    ]);
    
    const summary = summaryResult.status === "fulfilled" ? (summaryResult.value.summary || {}) : {};
    const details = summary.details || {};
    
    // Check for planning agent status
    let agentStatus = null;
    if (agentResult.status === "fulfilled" && agentResult.value.hasAgent) {
      agentStatus = agentResult.value.agent;
      // Start polling if agent is still running
      if (agentStatus && (agentStatus.status === "running" || agentStatus.status === "CREATING" || agentStatus.status === "processing") && window.startPlanningAgentPolling) {
        window.startPlanningAgentPolling(versionTag, agentStatus.id);
      }
    }
    
    const goals = details.goals || [];
    const totalGoals = details.totalGoals || 0;
    const completedGoals = details.completedGoals || 0;
    const progress = summary.progress || 0;
    
    container.innerHTML = `
      <div class="stage-content">
        <div style="margin-bottom: 1.5rem;">
          <h3>Planning Stage</h3>
          <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
            <div style="flex: 1; background: var(--bg-secondary); border-radius: var(--radius); padding: 0.5rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="font-size: 0.875rem; color: var(--text-light);">Progress</span>
                <span style="font-weight: 600;">${progress}%</span>
              </div>
              <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${progress}%; background: var(--primary); transition: width 0.3s;"></div>
              </div>
            </div>
          </div>
        </div>
        
        ${agentStatus ? `
          ${(() => {
            // Normalize status for comparison (handle both lowercase and uppercase)
            const status = (agentStatus.status || "").toLowerCase();
            const isRunning = status === "running" || status === "creating" || status === "processing";
            const isCompleted = status === "completed";
            const isFailed = status === "failed";
            return { isRunning, isCompleted, isFailed, status };
          })()}
          <div style="background: ${(() => {
            const status = (agentStatus.status || "").toLowerCase();
            const isRunning = status === "running" || status === "creating" || status === "processing";
            const isCompleted = status === "completed";
            return isRunning ? "var(--primary-light)" : isCompleted ? "var(--success-light, #e8f5e9)" : "var(--error-bg, #fee)";
          })()}; border-left: 4px solid ${(() => {
            const status = (agentStatus.status || "").toLowerCase();
            const isRunning = status === "running" || status === "creating" || status === "processing";
            const isCompleted = status === "completed";
            return isRunning ? "var(--primary)" : isCompleted ? "var(--success, #4caf50)" : "var(--error)";
          })()}; padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <div>
                <h4 style="margin: 0; color: ${(() => {
            const status = (agentStatus.status || "").toLowerCase();
            const isRunning = status === "running" || status === "creating" || status === "processing";
            const isCompleted = status === "completed";
            return isRunning ? "var(--primary)" : isCompleted ? "var(--success)" : "var(--error)";
          })()};">
                  ${(() => {
            const status = (agentStatus.status || "").toLowerCase();
            const isRunning = status === "running" || status === "creating" || status === "processing";
            const isCompleted = status === "completed";
            return isRunning ? "🤖 Planning Agent Running" : isCompleted ? "✓ Planning Agent Completed" : "✗ Planning Agent Failed";
          })()}
                </h4>
                ${agentStatus.id ? `
                  <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: var(--text-light);">
                    Agent ID: <code>${agentStatus.id.substring(0, 16)}...</code>
                    ${agentStatus.executionId ? ` • <a href="#" onclick="event.preventDefault(); switchView('executions'); setTimeout(() => showExecutionDetailsV2('${agentStatus.executionId}'), 100);" style="color: var(--primary); text-decoration: underline;">View Execution</a>` : ""}
                  </p>
                ` : ""}
                ${agentStatus.lastSynced ? `
                  <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: var(--text-light);">
                    ${agentStatus.lastSyncError ? `
                      <span style="color: var(--error);">⚠ Last sync failed:</span> ${new Date(agentStatus.lastSynced).toLocaleString()}
                    ` : `
                      <span style="color: var(--success);">✓ Last synced:</span> ${new Date(agentStatus.lastSynced).toLocaleString()}
                    `}
                  </p>
                ` : ""}
              </div>
              <span style="padding: 0.25rem 0.75rem; background: ${(() => {
            const status = String(agentStatus.status || "").toLowerCase();
            const isRunning = status === "running" || status === "creating" || status === "processing";
            const isCompleted = status === "completed";
            return isRunning ? "var(--primary)" : isCompleted ? "var(--success)" : "var(--error)";
          })()}; color: white; border-radius: var(--radius); font-size: 0.875rem; font-weight: 600;">
                ${(() => {
            const status = String(agentStatus.status || "").toUpperCase();
            return status === "RUNNING" || status === "CREATING" ? "Running" : status === "PROCESSING" ? "Processing" : status === "COMPLETED" ? "Completed" : status === "FAILED" ? "Failed" : status || "Unknown";
          })()}
              </span>
            </div>
            ${(() => {
            const status = String(agentStatus.status || "").toLowerCase();
            return status === "running" || status === "creating" || status === "processing";
          })() ? `
              <div style="margin-top: 0.5rem;">
                <div style="height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                  <div style="height: 100%; width: 100%; background: var(--primary); animation: pulse 2s infinite;"></div>
                </div>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-light);">
                  AI agent is analyzing your project and generating goals. This may take a few minutes...
                  <br>
                  <a href="#" onclick="event.preventDefault(); switchView('executions');" style="color: var(--primary); text-decoration: underline; font-size: 0.75rem;">
                    View all executions →
                  </a>
                </p>
                ${agentStatus.autoMerge === true ? `
                  <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--primary-light); border-left: 3px solid var(--primary); border-radius: var(--radius-sm);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.2rem;">🔄</span>
                      <div>
                        <strong style="font-size: 0.875rem; color: var(--primary);">Auto-merge enabled</strong>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: var(--text-light);">
                          The agent's branch will be automatically merged when planning completes.
                        </p>
                      </div>
                    </div>
                  </div>
                ` : ""}
              </div>
            ` : (() => {
            const status = (agentStatus.status || "").toLowerCase();
            return status === "completed";
          })() ? `
              <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-light);">
                Planning agent has completed. Goals have been generated.
              </p>
              ${agentStatus.autoMerge === true ? `
                <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--primary-light); border-left: 3px solid var(--primary); border-radius: var(--radius-sm);">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.2rem;">🔄</span>
                    <div>
                      <strong style="font-size: 0.875rem; color: var(--primary);">Auto-merge enabled</strong>
                      <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: var(--text-light);">
                        The agent's branch will be automatically merged when planning completes.
                      </p>
                    </div>
                  </div>
                </div>
              ` : ""}
            ` : agentStatus.status === "failed" ? `
              <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--error);">
                Planning agent failed: ${agentStatus.error || "Unknown error"}
              </p>
            ` : ""}
            
            ${agentStatus.syncHistory && agentStatus.syncHistory.length > 0 ? `
              <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                <details style="cursor: pointer;">
                  <summary style="font-size: 0.875rem; font-weight: 600; color: var(--text); margin-bottom: 0.5rem;">
                    Sync History (${agentStatus.syncHistory.length} entries)
                  </summary>
                  <div style="max-height: 300px; overflow-y: auto; margin-top: 0.5rem; font-size: 0.75rem;">
                    ${agentStatus.syncHistory.slice().reverse().map((sync, idx) => `
                      <div style="padding: 0.5rem; margin-bottom: 0.5rem; background: ${sync.success ? "var(--bg-secondary)" : "var(--error-bg, #fee)"}; border-left: 3px solid ${sync.success ? (sync.changed ? "var(--primary)" : "var(--border)") : "var(--error)"}; border-radius: var(--radius-sm);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.25rem;">
                          <div>
                            <strong>${new Date(sync.timestamp).toLocaleString()}</strong>
                            ${sync.changed ? ` <span style="color: var(--primary); font-weight: 600;">→ Status changed</span>` : ""}
                          </div>
                          <span style="padding: 0.125rem 0.5rem; background: ${sync.success ? "var(--success)" : "var(--error)"}; color: white; border-radius: var(--radius-sm); font-size: 0.7rem;">
                            ${sync.success ? "✓" : "✗"}
                          </span>
                        </div>
                        <div style="color: var(--text-light);">
                          ${sync.previousStatus && sync.status ? `
                            Status: <code>${sync.previousStatus}</code> → <code>${sync.status}</code>
                          ` : sync.status ? `
                            Status: <code>${sync.status}</code>
                          ` : ""}
                          ${sync.error ? `
                            <br><span style="color: var(--error);">Error: ${sync.error}</span>
                          ` : ""}
                        </div>
                      </div>
                    `).join("")}
                  </div>
                </details>
              </div>
            ` : ""}
          </div>
        ` : ""}
        
        <div style="margin-bottom: 1.5rem;">
          <h4>Goals (${completedGoals}/${totalGoals} completed)</h4>
          ${goals.length > 0 ? `
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${goals.map(goal => `
                <li style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius); display: flex; align-items: start; gap: 0.75rem;">
                  <span style="font-size: 1.25rem; line-height: 1;">${goal.completed ? "✓" : "○"}</span>
                  <span style="flex: 1; ${goal.completed ? "text-decoration: line-through; color: var(--text-light);" : ""}">${goal.text}</span>
                </li>
              `).join("")}
            </ul>
          ` : `
            <p style="color: var(--text-light); padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
              No goals defined yet. ${agentStatus && agentStatus.status === "running" ? "Waiting for planning agent to generate goals..." : "Add goals to start planning."}
            </p>
          `}
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Failed to render plan stage:", error);
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-light);">
        <p>Failed to load plan stage: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Render implement stage
 */
async function renderImplementStage(versionTag, container) {
  try {
    const summaryData = await window.apiCall(`/api/versions/${versionTag}/implement/summary`);
    const summary = summaryData.summary || {};
    const details = summary.details || {};
    
    const workstreams = details.workstreams || [];
    const totalWorkstreams = details.totalWorkstreams || 0;
    const activeWorkstreams = details.activeWorkstreams || 0;
    const progressEntries = details.progressEntries || 0;
    const recentActivity = details.recentActivity || [];
    const progress = summary.progress || 0;
    
    container.innerHTML = `
      <div class="stage-content">
        <div style="margin-bottom: 1.5rem;">
          <h3>Implementation Stage</h3>
          <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
            <div style="flex: 1; background: var(--bg-secondary); border-radius: var(--radius); padding: 0.5rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="font-size: 0.875rem; color: var(--text-light);">Progress</span>
                <span style="font-weight: 600;">${progress}%</span>
              </div>
              <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${progress}%; background: var(--primary); transition: width 0.3s;"></div>
              </div>
            </div>
          </div>
        </div>
        
        ${summary ? `
          <div style="background: var(--primary-light); border-left: 4px solid var(--primary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <h4 style="margin: 0; color: var(--primary);">Current Implementation Status</h4>
            </div>
            <p style="margin: 0; font-size: 0.875rem; color: var(--text-light);">${summary.summary || "No summary available"}</p>
          </div>
        ` : ""}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
          <div>
            <h4>Workstreams (${activeWorkstreams}/${totalWorkstreams} active)</h4>
            ${workstreams.length > 0 ? `
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${workstreams.map(ws => `
                  <li style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.25rem;">
                      <strong>${ws.name}</strong>
                      <span style="padding: 0.25rem 0.5rem; background: ${ws.status === "active" ? "var(--primary)" : "var(--text-light)"}; color: white; border-radius: var(--radius); font-size: 0.75rem;">
                        ${ws.status}
                      </span>
                    </div>
                    <div style="height: 4px; background: var(--border); border-radius: 2px; margin-top: 0.5rem;">
                      <div style="height: 100%; width: ${ws.progress || 0}%; background: var(--primary);"></div>
                    </div>
                  </li>
                `).join("")}
              </ul>
            ` : `
              <p style="color: var(--text-light); padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
                No workstreams created yet.
              </p>
            `}
            <button class="btn btn-primary" onclick="openWorkstreamCreationWizard()" style="margin-top: 1rem; width: 100%;">
              Create Workstream
            </button>
          </div>
          
          <div>
            <h4>Recent Activity (${progressEntries} entries)</h4>
            ${recentActivity.length > 0 ? `
              <div style="max-height: 400px; overflow-y: auto;">
                ${recentActivity.map(entry => `
                  <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius);">
                    <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; color: var(--text-light);">
                      ${entry.date}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text);">
                      ${entry.content.slice(0, 3).join("<br>")}
                      ${entry.content.length > 3 ? "<br>..." : ""}
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : `
              <p style="color: var(--text-light); padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
                No activity logged yet.
              </p>
            `}
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Failed to render implement stage:", error);
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-light);">
        <p>Failed to load implement stage: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Render test stage
 */
async function renderTestStage(versionTag, container) {
  try {
    const summaryData = await window.apiCall(`/api/versions/${versionTag}/test/summary`);
    const summary = summaryData.summary || {};
    const details = summary.details || {};
    
    const tests = details.tests || [];
    const totalTests = details.totalTests || 0;
    const passedTests = details.passedTests || 0;
    const failedTests = details.failedTests || 0;
    const progress = summary.progress || 0;
    
    container.innerHTML = `
      <div class="stage-content">
        <div style="margin-bottom: 1.5rem;">
          <h3>Testing Stage</h3>
          <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
            <div style="flex: 1; background: var(--bg-secondary); border-radius: var(--radius); padding: 0.5rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="font-size: 0.875rem; color: var(--text-light);">Progress</span>
                <span style="font-weight: 600;">${progress}%</span>
              </div>
              <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${progress}%; background: var(--primary); transition: width 0.3s;"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
          <h4>Test Results (${passedTests}/${totalTests} passing)</h4>
          ${tests.length > 0 ? `
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${tests.map(test => `
                <li style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius); display: flex; align-items: start; gap: 0.75rem;">
                  <span style="font-size: 1.25rem; line-height: 1; color: ${test.passed ? "var(--success)" : "var(--error)"};">${test.passed ? "✓" : "✗"}</span>
                  <span style="flex: 1;">${test.text}</span>
                </li>
              `).join("")}
            </ul>
          ` : `
            <p style="color: var(--text-light); padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
              No test cases defined yet. Add tests to the test plan.
            </p>
          `}
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Failed to render test stage:", error);
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-light);">
        <p>Failed to load test stage: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Render review stage
 */
async function renderReviewStage(versionTag, container) {
  try {
    const summaryData = await window.apiCall(`/api/versions/${versionTag}/review/summary`);
    const summary = summaryData.summary || {};
    const details = summary.details || {};
    
    const nextSteps = details.nextSteps || [];
    const totalNextSteps = details.totalNextSteps || 0;
    const completedNextSteps = details.completedNextSteps || 0;
    const progress = summary.progress || 0;
    
    container.innerHTML = `
      <div class="stage-content">
        <div style="margin-bottom: 1.5rem;">
          <h3>Review Stage</h3>
          <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
            <div style="flex: 1; background: var(--bg-secondary); border-radius: var(--radius); padding: 0.5rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="font-size: 0.875rem; color: var(--text-light);">Progress</span>
                <span style="font-weight: 600;">${progress}%</span>
              </div>
              <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${progress}%; background: var(--primary); transition: width 0.3s;"></div>
              </div>
            </div>
          </div>
        </div>
        
        ${details.summary ? `
          <div style="background: var(--primary-light); border-left: 4px solid var(--primary); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
            <p style="margin: 0; font-size: 0.875rem; color: var(--text-light);">${details.summary}</p>
          </div>
        ` : ""}
        
        <div style="margin-bottom: 1.5rem;">
          <h4>Next Steps (${completedNextSteps}/${totalNextSteps} completed)</h4>
          ${nextSteps.length > 0 ? `
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${nextSteps.map(step => `
                <li style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius); display: flex; align-items: start; gap: 0.75rem;">
                  <span style="font-size: 1.25rem; line-height: 1;">${step.completed ? "✓" : "○"}</span>
                  <span style="flex: 1; ${step.completed ? "text-decoration: line-through; color: var(--text-light);" : ""}">${step.text}</span>
                </li>
              `).join("")}
            </ul>
          ` : `
            <p style="color: var(--text-light); padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
              No next steps defined yet.
            </p>
          `}
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Failed to render review stage:", error);
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-light);">
        <p>Failed to load review stage: ${error.message}</p>
      </div>
    `;
  }
}

// Expose globally
window.renderPlanStage = renderPlanStage;
window.renderImplementStage = renderImplementStage;
window.renderTestStage = renderTestStage;
window.renderReviewStage = renderReviewStage;

