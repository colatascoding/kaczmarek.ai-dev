/**
 * Outcome determination and follow-up suggestions
 */

/**
 * Create outcome handler
 */
function createOutcomeHandler(engine) {
  return {
    /**
     * Generate execution summary
     */
    generateExecutionSummary(executionId, workflow, state, outcome, followUpSuggestions) {
      const stepExecutions = engine.db.getStepExecutions(executionId) || [];
      const completedSteps = stepExecutions.filter(s => s.status === "completed");
      const failedSteps = stepExecutions.filter(s => s.status === "failed");
      const totalSteps = stepExecutions.length;
      const successCount = completedSteps.length;
      const failureCount = failedSteps.length;
      const overallReturnCode = failureCount === 0 && totalSteps > 0 ? 0 : failureCount > 0 ? failureCount : null;
      
      let summary = `# Execution Summary: ${executionId}\n\n`;
      summary += `## Basic Information\n`;
      summary += `- **Execution ID:** ${executionId}\n`;
      summary += `- **Status:** ${state.status || "completed"} ${state.status === "completed" ? "✓" : state.status === "failed" ? "✗" : ""}\n`;
      summary += `- **Workflow:** ${workflow.name || workflow.id || "Unknown"}\n`;
      summary += `- **Version Tag:** ${state.workflow?.versionTag || "N/A"}\n`;
      summary += `- **Steps Summary:** ${successCount} succeeded, ${failureCount} failed, ${totalSteps} total\n`;
      summary += `- **Overall Return Code:** ${overallReturnCode !== null ? `${overallReturnCode} ${overallReturnCode === 0 ? "✓ Success" : "✗ Failed"}` : "N/A"}\n`;
      
      const formatDate = (dateValue) => {
        if (!dateValue) return "N/A";
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return "Invalid date";
          return date.toISOString();
        } catch (e) {
          return String(dateValue);
        }
      };
      
      const execution = engine.db.getExecution(executionId);
      const isRunning = execution && (execution.status === "running" || execution.status === "pending" || !execution.completed_at);
      
      summary += `- **Started:** ${formatDate(execution?.started_at)}\n`;
      if (execution?.completed_at && !isNaN(new Date(execution.completed_at).getTime())) {
        summary += `- **Completed:** ${formatDate(execution.completed_at)}\n`;
        try {
          const startDate = new Date(execution.started_at);
          const endDate = new Date(execution.completed_at);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const duration = endDate - startDate;
            summary += `- **Duration:** ${Math.round(duration / 1000)}s\n`;
          }
        } catch (e) {
          // Skip duration if dates are invalid
        }
      } else {
        summary += `- **Completed:** ${isRunning ? "Still running" : "N/A"}\n`;
      }
      
      if (execution?.error) {
        summary += `\n## Error\n\`\`\`\n${execution.error}\n\`\`\`\n`;
      }
      
      if (stepExecutions.length > 0) {
        summary += `\n## Step Executions (${stepExecutions.length})\n\n`;
        stepExecutions.forEach((step, index) => {
          summary += `### Step ${index + 1}: ${step.step_id || step.id || "unknown"}\n`;
          summary += `- **Module:** ${step.module || "N/A"}\n`;
          summary += `- **Action:** ${step.action || "N/A"}\n`;
          summary += `- **Status:** ${step.status || "unknown"}\n`;
          summary += `- **Return Code:** ${step.return_code !== undefined && step.return_code !== null ? step.return_code : (step.status === "completed" ? "0" : (step.status === "failed" ? "1" : "N/A"))} ${step.return_code === 0 ? "✓" : step.return_code > 0 ? "✗" : ""}\n`;
          if (step.started_at) {
            summary += `- **Started:** ${formatDate(step.started_at)}\n`;
          }
          if (step.completed_at) {
            summary += `- **Completed:** ${formatDate(step.completed_at)}\n`;
          }
          if (step.duration) {
            summary += `- **Duration:** ${step.duration}ms\n`;
          }
          if (step.inputs) {
            try {
              const inputs = typeof step.inputs === "string" ? JSON.parse(step.inputs) : step.inputs;
              summary += `- **Inputs:**\n\`\`\`json\n${JSON.stringify(inputs, null, 2)}\n\`\`\`\n`;
            } catch (e) {
              summary += `- **Inputs:** ${step.inputs}\n`;
            }
          }
          if (step.outputs) {
            try {
              const outputs = typeof step.outputs === "string" ? JSON.parse(step.outputs) : step.outputs;
              summary += `- **Outputs:**\n\`\`\`json\n${JSON.stringify(outputs, null, 2)}\n\`\`\`\n`;
            } catch (e) {
              summary += `- **Outputs:** ${step.outputs}\n`;
            }
          }
          if (step.error) {
            summary += `- **Error:**\n\`\`\`\n${step.error}\n\`\`\`\n`;
          }
          summary += `\n`;
        });
      }
      
      summary += `\n---\n`;
      summary += `*Generated from kaczmarek.ai-dev execution ${executionId}*\n`;
      
      return summary;
    },
    
    /**
     * Determine workflow outcome based on final state
     */
    determineOutcome(state, workflow) {
      // Check last step outputs to determine outcome
      const lastStepId = Object.keys(state.steps).pop();
      const lastStep = state.steps[lastStepId];
      
      if (!lastStep) {
        return "unknown";
      }
      
      // Check for common outcome indicators
      if (lastStep.outputs) {
        // Check if no tasks were found
        if (lastStep.outputs.count === 0 || lastStep.outputs.nextStepsCount === 0) {
          return "no-tasks";
        }
        
        // Check if all tasks are complete
        if (lastStep.outputs.allComplete === true) {
          return "all-complete";
        }
        
        // Check if version was created
        if (lastStep.outputs.versionTag) {
          return "version-created";
        }
      }
      
      // Check step ID for common patterns
      if (lastStepId === "no-tasks") {
        return "no-tasks";
      }
      
      if (lastStepId === "check-all-complete") {
        // Check the outputs of check-all-complete step
        if (lastStep.outputs && lastStep.outputs.allComplete === true) {
          return "all-complete";
        }
        return "no-tasks";
      }
      
      if (lastStepId === "create-next-version") {
        return "version-created";
      }
      
      if (lastStep.status === "failure") {
        return "failed";
      }
      
      // Check all steps to find outcome indicators
      for (const [stepId, step] of Object.entries(state.steps)) {
        if (step.outputs) {
          if (step.outputs.count === 0 || (step.outputs.nextSteps && Array.isArray(step.outputs.nextSteps) && step.outputs.nextSteps.length === 0)) {
            return "no-tasks";
          }
          if (step.outputs.allComplete === true) {
            return "all-complete";
          }
        }
      }
      
      return "completed";
    },
    
    /**
     * Get follow-up workflow suggestions based on outcome
     */
    getFollowUpSuggestions(outcome, workflow) {
      const suggestions = [];
      
      // Check if workflow defines follow-up workflows
      if (workflow.followUpWorkflows && Array.isArray(workflow.followUpWorkflows)) {
        workflow.followUpWorkflows.forEach(followUp => {
          // Check if this follow-up matches the outcome
          if (followUp.onOutcome) {
            const outcomes = Array.isArray(followUp.onOutcome) 
              ? followUp.onOutcome 
              : [followUp.onOutcome];
            
            if (outcomes.includes(outcome)) {
              suggestions.push({
                workflowId: followUp.workflowId,
                name: followUp.name || followUp.workflowId,
                description: followUp.description || `Run ${followUp.workflowId} workflow`,
                reason: followUp.reason || `Suggested because workflow completed with outcome: ${outcome}`
              });
            }
          }
        });
      }
      
      // Add default suggestions based on outcome
      if (suggestions.length === 0) {
        switch (outcome) {
          case "no-tasks":
            suggestions.push({
              workflowId: "review-self",
              name: "Review Self",
              description: "Run a new review to identify new tasks",
              reason: "No tasks found - run a review to identify new work"
            });
            break;
          case "all-complete":
            suggestions.push({
              workflowId: "review-self",
              name: "Review Self",
              description: "Start a new review cycle",
              reason: "All tasks completed - start a new review"
            });
            break;
          case "version-created":
            suggestions.push({
              workflowId: "execute-features",
              name: "Execute Features",
              description: "Implement features from the new version",
              reason: "New version created - implement features from it"
            });
            break;
        }
      }
      
      return suggestions;
    }
  };
}

module.exports = createOutcomeHandler;



