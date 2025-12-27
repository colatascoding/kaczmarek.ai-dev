/**
 * Workflow execution functions
 */

/**
 * Create workflow executor
 */
function createWorkflowExecutor(engine) {
  return {
    /**
     * Execute a workflow
     */
    async execute(workflowId, triggerData = {}, options = {}) {
      // Load workflow
      const workflow = engine.workflowManager.getWorkflowById(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      // Try to detect current version tag
      let versionTag = triggerData.versionTag || null;
      if (!versionTag) {
        try {
          const ModuleLoader = require("../modules/module-loader");
          const loader = new ModuleLoader(engine.cwd || process.cwd());
          const findVersionAction = loader.getAction("review", "find-current-version");
          if (findVersionAction) {
            const versionResult = await findVersionAction(
              { cwd: engine.cwd || process.cwd() },
              { logger: { info: () => {}, error: () => {}, warn: () => {} } }
            );
            if (versionResult && versionResult.found) {
              versionTag = versionResult.versionTag;
            }
          }
        } catch (e) {
          // Version detection failed, continue without it
        }
      }
      
      // Ensure workflow is saved to database (for foreign key constraint)
      engine.db.saveWorkflow(
        workflowId,
        workflow.name,
        workflow.version || "1.0.0",
        workflow,
        versionTag
      );
      
      // Create execution
      const executionId = engine.generateId();
      const executionMode = options.executionMode || "auto"; // auto | step
      engine.db.createExecution(
        executionId,
        workflowId,
        "cli",
        triggerData,
        versionTag,
        executionMode
      );
      
      engine.db.addHistory(executionId, "workflow_started");
      
      // Execute workflow with version tag in context
      try {
        if (executionMode === "step") {
          await this.executeNextStep(executionId, workflow, triggerData, versionTag);
        } else {
          await this.executeWorkflow(executionId, workflow, triggerData, versionTag);
          
          engine.db.updateExecution(executionId, { status: "completed" });
          engine.db.addHistory(executionId, "workflow_completed");
        }
      } catch (error) {
        // Even on failure, try to determine outcome and suggest follow-ups
        try {
          const execution = engine.db.getExecution(executionId);
          if (execution && execution.state) {
            const state = typeof execution.state === 'string' ? JSON.parse(execution.state) : execution.state;
            const outcome = engine.outcomeHandler.determineOutcome(state, workflow) || "failed";
            const followUpSuggestions = engine.outcomeHandler.getFollowUpSuggestions(outcome, workflow);
            
            engine.db.updateExecution(executionId, {
              status: "failed",
              error: error.message,
              outcome,
              followUpSuggestions
            });
          } else {
            engine.db.updateExecution(executionId, {
              status: "failed",
              error: error.message,
              outcome: "failed"
            });
          }
        } catch (e) {
          // If outcome determination fails, just update status
          engine.db.updateExecution(executionId, {
            status: "failed",
            error: error.message,
            outcome: "failed"
          });
        }
        engine.db.addHistory(executionId, "workflow_failed", null, { error: error.message });
        throw error;
      }
      
      return {
        id: executionId,
        workflowId,
        status: "completed"
      };
    },

    /**
     * Execute workflow steps (full run)
     */
    async executeWorkflow(executionId, workflow, triggerData, versionTag = null) {
      const state = {
        trigger: triggerData,
        steps: {},
        workflow: {
          executionId,
          cwd: process.cwd(),
          versionTag
        }
      };
      
      let currentStep = workflow.steps[0];
      
      while (currentStep) {
        engine.db.updateExecution(executionId, {
          currentStep: currentStep.id,
          state
        });
        
        engine.db.addHistory(executionId, "step_started", currentStep.id);
        
        // Execute step
        const result = await engine.stepExecutor.executeStep(
          executionId,
          currentStep,
          state,
          workflow
        );
        
        // Check if step is waiting for decision
        if (result.status === "pending" && result.decisionId) {
          // Pause workflow execution - wait for user decision
          engine.db.updateExecution(executionId, {
            status: "waiting",
            currentStep: currentStep.id,
            state: JSON.stringify(state)
          });
          
          // Workflow paused - will resume when decision is submitted
          return;
        }
        
        // Update state with full result (including outputs)
        state.steps[currentStep.id] = {
          ...result,
          outputs: result.outputs || {}
        };
        
        // Determine next step
        currentStep = engine.utils.determineNextStep(
          currentStep,
          result,
          workflow,
          (condition, result, workflow, state) => engine.utils.evaluateCondition(
            condition,
            result,
            workflow,
            (value, state, workflow) => engine.stepExecutor.resolveValue(value, state, workflow),
            state
          ),
          state
        );
      }
      
      // Workflow completed - determine outcome and suggest follow-ups
      const outcome = engine.outcomeHandler.determineOutcome(state, workflow);
      const followUpSuggestions = engine.outcomeHandler.getFollowUpSuggestions(outcome, workflow);
      
      // Generate execution summary
      const summary = engine.outcomeHandler.generateExecutionSummary(executionId, workflow, state, outcome, followUpSuggestions);
      
      engine.db.updateExecution(executionId, {
        outcome,
        followUpSuggestions,
        summary
      });
    },

    /**
     * Execute the next step for a step-mode execution.
     * If no more steps, finalizes the execution and marks it completed.
     */
    async executeNextStep(executionId, workflow, triggerData, versionTag = null) {
      // Load current execution and state
      const execution = engine.db.getExecution(executionId);
      if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      const executionMode = execution.executionMode || execution.execution_mode || "auto";
      if (executionMode !== "step") {
        throw new Error("executeNextStep called for non step-mode execution");
      }

      // Initialize state if first step
      let state = execution.state || {
        trigger: triggerData,
        steps: {},
        workflow: {
          executionId,
          cwd: process.cwd(),
          versionTag
        }
      };

      // Determine current step index
      const steps = workflow.steps || [];
      let currentStep = null;

      if (!execution.currentStep) {
        currentStep = steps[0] || null;
      } else {
        const lastStepIndex = steps.findIndex(s => s.id === execution.currentStep);
        if (lastStepIndex === -1) {
          throw new Error(`Current step ${execution.currentStep} not found in workflow`);
        }
        const lastStep = steps[lastStepIndex];
        const lastResult = state.steps[lastStep.id] || {};
        currentStep = engine.utils.determineNextStep(
          lastStep,
          lastResult,
          workflow,
          (condition, result, workflow, state) => engine.utils.evaluateCondition(
            condition,
            result,
            workflow,
            (value, state, workflow) => engine.stepExecutor.resolveValue(value, state, workflow),
            state
          ),
          state
        );
      }

      if (!currentStep) {
        // No more steps → finalize
        const outcome = engine.outcomeHandler.determineOutcome(state, workflow);
        const followUpSuggestions = engine.outcomeHandler.getFollowUpSuggestions(outcome, workflow);
        const summary = engine.outcomeHandler.generateExecutionSummary(executionId, workflow, state, outcome, followUpSuggestions);

        engine.db.updateExecution(executionId, {
          status: "completed",
          currentStep: null,
          state,
          outcome,
          followUpSuggestions,
          summary
        });
        engine.db.addHistory(executionId, "workflow_completed");
        return { done: true, currentStep: null, state };
      }

      // Mark step as current and running
      engine.db.updateExecution(executionId, {
        status: "running",
        currentStep: currentStep.id,
        state
      });
      engine.db.addHistory(executionId, "step_started", currentStep.id);

      // Execute step
      const result = await engine.stepExecutor.executeStep(
        executionId,
        currentStep,
        state,
        workflow
      );

      // Update state with full result (including outputs)
      state = {
        ...state,
        steps: {
          ...state.steps,
          [currentStep.id]: {
            ...result,
            outputs: result.outputs || {}
          }
        }
      };

      // Pause after this step (caller can request next step)
      engine.db.updateExecution(executionId, {
        status: "paused",
        currentStep: currentStep.id,
        state
      });
      engine.db.addHistory(executionId, "step_completed", currentStep.id);

      return {
        done: false,
        currentStep: currentStep.id,
        state
      };
    },

    /**
     * Resume workflow execution after decision
     */
    async resumeExecution(executionId, workflow, state, decisionData) {
      // Update execution status
      engine.db.updateExecution(executionId, {
        status: "running",
        state: JSON.stringify(state)
      });
      
      // Find the step that was waiting
      const waitingStepId = state.workflow?.waitingStepId || state.currentStep;
      const waitingStep = workflow.steps.find(s => s.id === waitingStepId);
      
      if (!waitingStep) {
        throw new Error(`Waiting step ${waitingStepId} not found in workflow`);
      }
      
      // Update step execution with decision result
      const stepExecutions = engine.db.getStepExecutions(executionId);
      const stepExecution = stepExecutions.find(se => se.step_id === waitingStepId);
      
      if (stepExecution) {
        const outputs = stepExecution.outputs ? JSON.parse(stepExecution.outputs) : {};
        outputs.decision = decisionData.choice;
        outputs.decisionId = decisionData.decisionId;
        outputs.notes = decisionData.notes;
        outputs.status = "resolved";
        
        engine.db.updateStepExecution(stepExecution.id, {
          status: "completed",
          outputs: JSON.stringify(outputs),
          returnCode: 0
        });
      }
      
      // Update state with decision
      state.steps[waitingStepId] = {
        ...state.steps[waitingStepId],
        outputs: {
          ...state.steps[waitingStepId]?.outputs,
          decision: decisionData.choice,
          decisionId: decisionData.decisionId,
          notes: decisionData.notes
        },
        status: "success"
      };
      
      // Continue from next step
      const result = {
        status: "success",
        outputs: {
          decision: decisionData.choice,
          decisionId: decisionData.decisionId,
          notes: decisionData.notes
        },
        returnCode: 0
      };
      
      let currentStep = engine.utils.determineNextStep(
        waitingStep,
        result,
        workflow,
        (condition, result, workflow, state) => engine.utils.evaluateCondition(
          condition,
          result,
          workflow,
          (value, state, workflow) => engine.stepExecutor.resolveValue(value, state, workflow),
          state
        ),
        state
      );
      
      // Continue execution
      while (currentStep) {
        engine.db.updateExecution(executionId, {
          currentStep: currentStep.id,
          state: JSON.stringify(state)
        });
        
        engine.db.addHistory(executionId, "step_started", currentStep.id);
        
        // Execute step
        const stepResult = await engine.stepExecutor.executeStep(
          executionId,
          currentStep,
          state,
          workflow
        );
        
        // Check if step is waiting for decision again
        if (stepResult.status === "pending" && stepResult.decisionId) {
          engine.db.updateExecution(executionId, {
            status: "waiting",
            currentStep: currentStep.id,
            state: JSON.stringify(state)
          });
          return;
        }
        
        // Update state
        state.steps[currentStep.id] = {
          ...stepResult,
          outputs: stepResult.outputs || {}
        };
        
        // Determine next step
        currentStep = engine.utils.determineNextStep(
          currentStep,
          stepResult,
          workflow,
          (condition, result, workflow, state) => engine.utils.evaluateCondition(
            condition,
            result,
            workflow,
            (value, state, workflow) => engine.stepExecutor.resolveValue(value, state, workflow),
            state
          ),
          state
        );
      }
      
      // Workflow completed
      const outcome = engine.outcomeHandler.determineOutcome(state, workflow);
      const followUpSuggestions = engine.outcomeHandler.getFollowUpSuggestions(outcome, workflow);
      const summary = engine.outcomeHandler.generateExecutionSummary(executionId, workflow, state, outcome, followUpSuggestions);
      
      engine.db.updateExecution(executionId, {
        status: "completed",
        outcome,
        followUpSuggestions,
        summary,
        completed_at: new Date().toISOString()
      });
    }
  };
}

module.exports = createWorkflowExecutor;

