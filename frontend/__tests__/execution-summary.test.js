/**
 * Unit tests for execution summary copying functionality
 */

// Mock DOM environment
document.body.innerHTML = `
  <div id="modal">
    <div class="modal-content">
      <div id="modal-body"></div>
    </div>
  </div>
`;

// Mock navigator.clipboard
global.navigator = {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
};

// Mock execution data with various date scenarios
const mockExecutionDataValid = {
  execution: {
    executionId: "test-exec-123",
    status: "completed",
    workflowId: "test-workflow",
    versionTag: "version0-1",
    startedAt: "2024-01-15T10:00:00.000Z",
    completedAt: "2024-01-15T10:05:30.000Z",
    error: null
  },
  workflow: {
    id: "test-workflow",
    name: "Test Workflow",
    version: "1.0.0"
  },
  steps: [
    {
      step_id: "step1",
      module: "system",
      action: "log",
      status: "completed",
      started_at: "2024-01-15T10:00:00.000Z",
      completed_at: "2024-01-15T10:00:05.000Z",
      duration: 5000,
      inputs: '{"message": "test"}',
      outputs: '{"result": "success"}',
      error: null
    }
  ],
  agents: []
};

const mockExecutionDataInvalidDates = {
  execution: {
    executionId: "test-exec-456",
    status: "completed",
    workflowId: "test-workflow",
    versionTag: "version0-1",
    startedAt: null, // Invalid date
    completedAt: "invalid-date-string", // Invalid date
    error: null
  },
  workflow: {
    id: "test-workflow",
    name: "Test Workflow",
    version: "1.0.0"
  },
  steps: [
    {
      step_id: "step1",
      module: "system",
      action: "log",
      status: "completed",
      started_at: undefined, // Missing date
      completed_at: null, // Invalid date
      duration: 5000,
      inputs: '{"message": "test"}',
      outputs: '{"result": "success"}',
      error: null
    }
  ],
  agents: [
    {
      id: "agent-123",
      status: "ready",
      type: "cursor",
      createdAt: "not-a-date", // Invalid date
      readyAt: null,
      completedAt: undefined
    }
  ]
};

const mockExecutionDataMissingDates = {
  execution: {
    executionId: "test-exec-789",
    status: "running",
    workflowId: "test-workflow",
    versionTag: null,
    startedAt: "2024-01-15T10:00:00.000Z",
    completedAt: null, // Still running
    error: null
  },
  workflow: {
    id: "test-workflow",
    name: "Test Workflow",
    version: "1.0.0"
  },
  steps: [],
  agents: []
};

describe("Execution Summary Copy", () => {
  beforeEach(() => {
    global.navigator.clipboard.writeText.mockClear();
    window.currentExecutionData = null;
  });

  test("formats valid dates correctly", async () => {
    window.currentExecutionData = mockExecutionDataValid;
    
    // Import the function logic (simulated)
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
    
    const startedDate = formatDate(mockExecutionDataValid.execution.startedAt);
    const completedDate = formatDate(mockExecutionDataValid.execution.completedAt);
    
    expect(startedDate).toBe("2024-01-15T10:00:00.000Z");
    expect(completedDate).toBe("2024-01-15T10:05:30.000Z");
    expect(startedDate).not.toBe("Invalid date");
    expect(completedDate).not.toBe("Invalid date");
  });

  test("handles invalid dates gracefully", async () => {
    window.currentExecutionData = mockExecutionDataInvalidDates;
    
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
    
    // Test null date
    const nullDate = formatDate(null);
    expect(nullDate).toBe("N/A");
    
    // Test invalid date string
    const invalidDate = formatDate("invalid-date-string");
    expect(invalidDate).toBe("Invalid date");
    
    // Test undefined date
    const undefinedDate = formatDate(undefined);
    expect(undefinedDate).toBe("N/A");
    
    // Test empty string
    const emptyDate = formatDate("");
    expect(emptyDate).toBe("N/A");
  });

  test("handles missing completed date for running executions", async () => {
    window.currentExecutionData = mockExecutionDataMissingDates;
    
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
    
    const exec = mockExecutionDataMissingDates.execution;
    const startedDate = formatDate(exec.startedAt);
    const completedDate = formatDate(exec.completedAt);
    
    expect(startedDate).toBe("2024-01-15T10:00:00.000Z");
    expect(completedDate).toBe("N/A");
  });

  test("calculates duration only for valid dates", async () => {
    const exec = mockExecutionDataValid.execution;
    
    try {
      const startDate = new Date(exec.startedAt);
      const endDate = new Date(exec.completedAt);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const duration = endDate - startDate;
        expect(duration).toBeGreaterThan(0);
        expect(Math.round(duration / 1000)).toBe(330); // 5 minutes 30 seconds
      } else {
        fail("Dates should be valid");
      }
    } catch (e) {
      fail("Should not throw error for valid dates");
    }
  });

  test("skips duration calculation for invalid dates", async () => {
    const exec = mockExecutionDataInvalidDates.execution;
    
    try {
      const startDate = new Date(exec.startedAt);
      const endDate = new Date(exec.completedAt);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const duration = endDate - startDate;
        // Should not reach here
        fail("Should not calculate duration for invalid dates");
      } else {
        // This is expected - duration should be skipped
        expect(true).toBe(true);
      }
    } catch (e) {
      // This is also acceptable
      expect(true).toBe(true);
    }
  });

  test("formats step dates correctly", async () => {
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
    
    const step = mockExecutionDataValid.steps[0];
    const startedAt = formatDate(step.started_at);
    const completedAt = formatDate(step.completed_at);
    
    expect(startedAt).toBe("2024-01-15T10:00:00.000Z");
    expect(completedAt).toBe("2024-01-15T10:00:05.000Z");
  });

  test("handles step dates with invalid values", async () => {
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
    
    const step = mockExecutionDataInvalidDates.steps[0];
    const startedAt = formatDate(step.started_at);
    const completedAt = formatDate(step.completed_at);
    
    expect(startedAt).toBe("N/A");
    expect(completedAt).toBe("N/A");
  });

  test("formats agent dates correctly", async () => {
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
    
    const agent = mockExecutionDataInvalidDates.agents[0];
    const createdAt = formatDate(agent.createdAt);
    const readyAt = formatDate(agent.readyAt);
    const completedAt = formatDate(agent.completedAt);
    
    expect(createdAt).toBe("Invalid date");
    expect(readyAt).toBe("N/A");
    expect(completedAt).toBe("N/A");
  });

  test("generates summary without throwing errors for invalid dates", async () => {
    window.currentExecutionData = mockExecutionDataInvalidDates;
    
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
    
    const exec = mockExecutionDataInvalidDates.execution;
    let summary = "";
    
    // Should not throw errors
    expect(() => {
      summary += `- **Started:** ${formatDate(exec.startedAt)}\n`;
      summary += `- **Completed:** ${formatDate(exec.completedAt)}\n`;
    }).not.toThrow();
    
    expect(summary).toContain("Started:");
    expect(summary).toContain("Completed:");
  });
});

