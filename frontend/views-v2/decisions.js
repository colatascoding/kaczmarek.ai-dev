/**
 * Decisions View V2
 * UI for displaying and handling workflow decisions
 */

/**
 * Load pending decisions for an execution
 */
async function loadPendingDecisions(executionId) {
  try {
    const data = await window.apiCall(`/api/executions/${executionId}/decisions`);
    const decisions = data.decisions || [];
    
    if (decisions.length > 0) {
      renderDecisions(decisions, executionId);
    } else {
      hideDecisions();
    }
  } catch (error) {
    console.error("Failed to load pending decisions:", error);
  }
}

/**
 * Render decisions
 */
function renderDecisions(decisions, executionId) {
  const container = document.getElementById("decisions-container");
  if (!container) {
    // Create container if it doesn't exist
    const main = document.querySelector(".main-v2");
    if (main) {
      const newContainer = document.createElement("div");
      newContainer.id = "decisions-container";
      newContainer.className = "decisions-container-v2";
      main.insertBefore(newContainer, main.firstChild);
      renderDecisions(decisions, executionId);
      return;
    }
    return;
  }
  
  container.innerHTML = decisions.map(decision => renderDecisionCard(decision, executionId)).join("");
  container.style.display = "block";
}

/**
 * Render a single decision card
 */
function renderDecisionCard(decision, executionId) {
  const proposals = decision.proposals || [];
  
  return `
    <div class="decision-card-v2" data-decision-id="${decision.decisionId}">
      <div class="decision-header-v2">
        <h3>${decision.title || "Decision Required"}</h3>
        <span class="badge" style="background: var(--warning-light); color: var(--warning);">Pending</span>
      </div>
      
      ${decision.description ? `
        <p class="decision-description-v2">${decision.description}</p>
      ` : ""}
      
      <div class="decision-proposals-v2">
        <h4 style="margin: 0 0 1rem 0; font-size: 0.875rem; color: var(--text-light);">Choose an option:</h4>
        <div class="proposals-list-v2">
          ${proposals.map((proposal, index) => `
            <div class="proposal-item-v2" data-proposal-id="${proposal.id || index}">
              <div class="proposal-header-v2">
                <strong>${proposal.label || proposal.id || `Option ${index + 1}`}</strong>
              </div>
              ${proposal.description ? `
                <p class="proposal-description-v2">${proposal.description}</p>
              ` : ""}
              <button 
                class="btn btn-primary btn-sm" 
                onclick="submitDecision('${decision.decisionId}', '${proposal.id || index}', '${executionId}')"
                style="margin-top: 0.5rem;">
                Select
              </button>
            </div>
          `).join("")}
        </div>
      </div>
      
      <div class="decision-meta-v2">
        <small style="color: var(--text-light);">
          Step: ${decision.stepId} | Execution: ${executionId.substring(0, 8)}...
        </small>
      </div>
    </div>
  `;
}

/**
 * Submit a decision
 */
async function submitDecision(decisionId, choice, executionId, notes = "") {
  try {
    const result = await window.apiCall(`/api/decisions/${decisionId}/submit`, {
      method: "POST",
      body: JSON.stringify({ choice, notes })
    });
    
    if (result.success) {
      window.showNotification("Decision submitted successfully", "success");
      
      // Remove decision card
      const card = document.querySelector(`[data-decision-id="${decisionId}"]`);
      if (card) {
        card.style.opacity = "0.5";
        card.innerHTML = `
          <div style="text-align: center; padding: 1rem;">
            <p style="color: var(--success);">✓ Decision submitted: ${choice}</p>
            <p style="font-size: 0.875rem; color: var(--text-light);">Workflow resuming...</p>
          </div>
        `;
      }
      
      // Refresh execution status
      if (window.loadExecutions) {
        setTimeout(() => {
          window.loadExecutions();
          loadPendingDecisions(executionId);
        }, 1000);
      }
    }
  } catch (error) {
    console.error("Failed to submit decision:", error);
    window.showNotification(`Failed to submit decision: ${error.message}`, "error");
  }
}

/**
 * Hide decisions container
 */
function hideDecisions() {
  const container = document.getElementById("decisions-container");
  if (container) {
    container.style.display = "none";
  }
}

/**
 * Check for pending decisions periodically
 */
let decisionsCheckInterval = null;

function startDecisionsPolling(executionId) {
  if (decisionsCheckInterval) {
    clearInterval(decisionsCheckInterval);
  }
  
  decisionsCheckInterval = setInterval(() => {
    loadPendingDecisions(executionId);
  }, 3000); // Check every 3 seconds
}

function stopDecisionsPolling() {
  if (decisionsCheckInterval) {
    clearInterval(decisionsCheckInterval);
    decisionsCheckInterval = null;
  }
}

// Expose globally
window.loadPendingDecisions = loadPendingDecisions;
window.submitDecision = submitDecision;
window.hideDecisions = hideDecisions;
window.startDecisionsPolling = startDecisionsPolling;
window.stopDecisionsPolling = stopDecisionsPolling;

