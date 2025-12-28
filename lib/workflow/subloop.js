/**
 * Subloop/iteration support for workflows
 * Allows repeating steps based on conditions
 */

/**
 * Create subloop handler
 */
function createSubloopHandler(engine) {
  return {
    /**
     * Execute a subloop (repeat steps until condition is met)
     * 
     * @param {string} executionId - Execution ID
     * @param {Object} workflow - Workflow definition
     * @param {Object} state - Current workflow state
     * @param {Object} subloopConfig - Subloop configuration
     * @param {Array} stepsToRepeat - Steps to repeat
     * @returns {Promise<Object>} Final state after subloop
     */
    async executeSubloop(executionId, workflow, state, subloopConfig, stepsToRepeat) {
      const {
        maxIterations = 10,
        condition = null,
        breakOnDecision = false
      } = subloopConfig;
      
      let iteration = 0;
      let shouldContinue = true;
      
      while (iteration < maxIterations && shouldContinue) {
        iteration++;
        
        engine.db.addHistory(executionId, "subloop_iteration_start", null, {
          iteration,
          maxIterations
        });
        
        // Execute each step in the subloop
        for (const step of stepsToRepeat) {
          engine.db.updateExecution(executionId, {
            currentStep: step.id,
            state: JSON.stringify(state)
          });
          
          engine.db.addHistory(executionId, "step_started", step.id, {
            iteration,
            subloop: true
          });
          
          // Execute step
          const result = await engine.stepExecutor.executeStep(
            executionId,
            step,
            state,
            workflow
          );
          
          // Check if step is waiting for decision
          if (result.status === "pending" && result.decisionId) {
            if (breakOnDecision) {
              // Pause subloop and wait for decision
              engine.db.updateExecution(executionId, {
                status: "waiting",
                currentStep: step.id,
                state: JSON.stringify(state)
              });
              return {
                status: "paused",
                iteration,
                waitingForDecision: true,
                decisionId: result.decisionId
              };
            }
            // Continue subloop but mark as waiting
            state.steps[step.id] = {
              ...result,
              outputs: result.outputs || {},
              iteration
            };
            continue;
          }
          
          // Update state
          state.steps[step.id] = {
            ...result,
            outputs: result.outputs || {},
            iteration
          };
          
          // Check if step failed
          if (result.status === "failure") {
            shouldContinue = false;
            break;
          }
        }
        
        // Evaluate condition to continue
        if (condition) {
          const conditionMet = engine.utils.evaluateCondition(
            condition,
            { status: "success", outputs: state.steps },
            workflow,
            (value, state, workflow) => engine.stepExecutor.resolveValue(value, state, workflow),
            state
          );
          
          if (!conditionMet) {
            shouldContinue = false;
          }
        }
        
        engine.db.addHistory(executionId, "subloop_iteration_complete", null, {
          iteration,
          shouldContinue
        });
      }
      
      return {
        status: "completed",
        iteration,
        maxIterationsReached: iteration >= maxIterations
      };
    }
  };
}

module.exports = createSubloopHandler;


