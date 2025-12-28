/**
 * Unit tests for decision API routes
 */

const { describe, test, expect, beforeEach, afterEach } = require("@jest/globals");

describe("Decision Routes", () => {
  let server;
  let decisionRoutes;

  beforeEach(() => {
    // Mock server
    server = {
      db: {
        getPendingDecisionsForExecution: jest.fn(() => []),
        getPendingDecision: jest.fn(() => null),
        updatePendingDecision: jest.fn()
      },
      engine: {
        workflowManager: {
          loadWorkflow: jest.fn(() => ({
            steps: []
          }))
        },
        executor: {
          resumeExecution: jest.fn()
        }
      }
    };
    
    // Load decision routes
    const createDecisionRoutes = require("../api/routes/decisions");
    decisionRoutes = createDecisionRoutes(server);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("handleGetPendingDecisions", () => {
    test("should return pending decisions for execution", async () => {
      const executionId = "test-execution-123";
      const mockDecisions = [
        {
          id: "decision-1",
          executionId: executionId,
          stepId: "step-1",
          proposals: [{ id: "proposal-1", description: "Option 1" }]
        }
      ];
      
      server.db.getPendingDecisionsForExecution.mockReturnValue(mockDecisions);

      const req = { url: `/api/executions/${executionId}/decisions` };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      await decisionRoutes.handleGetPendingDecisions(req, res, `/api/executions/${executionId}/decisions`);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.decisions).toHaveLength(1);
      expect(responseData.decisions[0].id).toBe("decision-1");
    });

    test("should return 400 if execution ID is missing", async () => {
      const req = { url: "/api/executions//decisions" };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      await decisionRoutes.handleGetPendingDecisions(req, res, "/api/executions//decisions");

      expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.error).toBe("Execution ID is required");
    });
  });

  describe("handleGetDecision", () => {
    test("should return decision if found", async () => {
      const decisionId = "decision-123";
      const mockDecision = {
        id: decisionId,
        executionId: "execution-123",
        stepId: "step-1",
        proposals: [{ id: "proposal-1", description: "Option 1" }]
      };
      
      server.db.getPendingDecision.mockReturnValue(mockDecision);

      const req = { url: `/api/decisions/${decisionId}` };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      await decisionRoutes.handleGetDecision(req, res, `/api/decisions/${decisionId}`);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.decision.id).toBe(decisionId);
    });

    test("should return 404 if decision not found", async () => {
      server.db.getPendingDecision.mockReturnValue(null);

      const req = { url: "/api/decisions/non-existent" };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      await decisionRoutes.handleGetDecision(req, res, "/api/decisions/non-existent");

      expect(res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.error).toBe("Decision not found");
    });
  });
});


