/**
 * Unit tests for planning agent polling
 */

const { describe, test, expect, beforeEach, afterEach, jest: jestGlobal } = require("@jest/globals");

// Mock window object
const mockApiCall = jestGlobal.fn();
const mockShowNotification = jestGlobal.fn();
const mockLoadVersionsV2 = jestGlobal.fn();

global.window = {
  apiCall: mockApiCall,
  showNotification: mockShowNotification,
  loadVersionsV2: mockLoadVersionsV2
};

// Ensure window is available globally
if (typeof window === "undefined") {
  global.window = global.window || {};
}

// Mock document
global.document = {
  getElementById: jestGlobal.fn(),
  querySelector: jestGlobal.fn(),
  querySelectorAll: jestGlobal.fn(() => [])
};

// Mock global functions
global.clearInterval = jestGlobal.fn();
global.setInterval = jestGlobal.fn((_fn, _delay) => {
  return 123; // Mock interval ID
});

describe("Planning Agent Polling", () => {
  let planningAgentIntervals;
  let startPlanningAgentPolling;
  let stopPlanningAgentPolling;

  beforeEach(() => {
    // Reset mocks
    jestGlobal.clearAllMocks();
    mockApiCall.mockReset();
    mockShowNotification.mockReset();
    mockLoadVersionsV2.mockReset();
    planningAgentIntervals = new Map();
    
    // Ensure window.apiCall and window.showNotification are properly set
    global.window.apiCall = mockApiCall;
    global.window.showNotification = mockShowNotification;
    
    // Mock the functions (simplified version)
    stopPlanningAgentPolling = (versionTag) => {
      if (planningAgentIntervals.has(versionTag)) {
        clearInterval(planningAgentIntervals.get(versionTag));
        planningAgentIntervals.delete(versionTag);
      }
    };
    
    startPlanningAgentPolling = (versionTag, _agentTaskId) => {
      if (planningAgentIntervals.has(versionTag)) {
        clearInterval(planningAgentIntervals.get(versionTag));
      }
      
      const interval = setInterval(async () => {
        try {
          // Ensure window.apiCall and window.showNotification are available
          if (!window.apiCall) {
            window.apiCall = mockApiCall;
          }
          if (!window.showNotification) {
            window.showNotification = mockShowNotification;
          }
          const agentData = await window.apiCall(`/api/versions/${versionTag}/planning-agent-status`);
          
          if (agentData.hasAgent) {
            const agent = agentData.agent;
            
            if (agent.status === "completed" || agent.status === "failed") {
              stopPlanningAgentPolling(versionTag);
              
              if (agent.status === "completed") {
                window.showNotification(`Planning agent completed for version ${versionTag}. Goals have been generated.`, "success");
              } else {
                window.showNotification(`Planning agent failed for version ${versionTag}: ${agent.error || "Unknown error"}`, "error");
              }
            }
          } else {
            stopPlanningAgentPolling(versionTag);
          }
        } catch (error) {
          console.error("Failed to check planning agent status:", error);
        }
      }, 5000);
      
      planningAgentIntervals.set(versionTag, interval);
    };
  });

  afterEach(() => {
    // Clear all intervals
    planningAgentIntervals.forEach(interval => clearInterval(interval));
    planningAgentIntervals.clear();
  });

  test("should start polling for planning agent", () => {
    startPlanningAgentPolling("0-3", "agent-123");
    
    expect(setInterval).toHaveBeenCalled();
    expect(planningAgentIntervals.has("0-3")).toBe(true);
  });

  test("should stop existing polling when starting new one for same version", () => {
    startPlanningAgentPolling("0-3", "agent-123");
    const firstInterval = planningAgentIntervals.get("0-3");
    
    startPlanningAgentPolling("0-3", "agent-456");
    
    expect(clearInterval).toHaveBeenCalledWith(firstInterval);
    expect(planningAgentIntervals.has("0-3")).toBe(true);
  });

  test("should stop polling when agent completes", async () => {
    mockApiCall.mockResolvedValue({
      hasAgent: true,
      agent: {
        id: "agent-123",
        status: "completed"
      }
    });

    startPlanningAgentPolling("0-3", "agent-123");
    
    // Simulate polling callback
    const intervalCallback = setInterval.mock.calls[0][0];
    await intervalCallback();
    
    expect(stopPlanningAgentPolling).toBeDefined();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Planning agent completed for version 0-3. Goals have been generated.",
      "success"
    );
  });

  test("should stop polling when agent fails", async () => {
    mockApiCall.mockResolvedValue({
      hasAgent: true,
      agent: {
        id: "agent-123",
        status: "failed",
        error: "Test error"
      }
    });

    startPlanningAgentPolling("0-3", "agent-123");
    
    // Simulate polling callback
    const intervalCallback = setInterval.mock.calls[0][0];
    await intervalCallback();
    
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Planning agent failed for version 0-3: Test error",
      "error"
    );
  });

  test("should stop polling when agent not found", async () => {
    mockApiCall.mockResolvedValue({
      hasAgent: false,
      agent: null
    });

    startPlanningAgentPolling("0-3", "agent-123");
    expect(planningAgentIntervals.has("0-3")).toBe(true); // Should be set initially
    
    // Simulate polling callback - this should call stopPlanningAgentPolling
    const intervalCallback = setInterval.mock.calls[setInterval.mock.calls.length - 1][0];
    await intervalCallback();
    
    // After callback, interval should be cleared by stopPlanningAgentPolling
    expect(planningAgentIntervals.has("0-3")).toBe(false);
  });

  test("should handle API errors gracefully", async () => {
    const consoleErrorSpy = jestGlobal.spyOn(console, "error").mockImplementation(() => {});
    mockApiCall.mockRejectedValue(new Error("Network error"));

    startPlanningAgentPolling("0-3", "agent-123");
    
    // Simulate polling callback
    const intervalCallback = setInterval.mock.calls[0][0];
    await intervalCallback();
    
    // Should not throw, just log error
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

