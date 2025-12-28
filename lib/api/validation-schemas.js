/**
 * Validation schemas for API endpoints
 */

const { string, enumValue, object, array } = require("../utils/validation");

/**
 * Schema for workflow run request
 */
const workflowRunSchema = {
  executionMode: (v, f) => {
    if (v === undefined || v === null) {
      return "auto"; // Default value
    }
    return enumValue(v, f, ["auto", "step"]);
  },
  // Allow any additional trigger data
  // We don't validate the structure as it's workflow-specific
};

/**
 * Schema for agent complete request
 */
const agentCompleteSchema = {
  notes: (v, f) => string(v, f, { required: false, maxLength: 1000 })
};

/**
 * Schema for version creation
 */
const versionCreateSchema = {
  versionTag: (v, f) => string(v, f, { 
    required: true, 
    pattern: /^(\d+)-(\d+)$/,
    minLength: 3,
    maxLength: 20
  }),
  goals: (v, f) => {
    if (v === undefined || v === null) {
      return []; // Default empty array
    }
    return array(v, f, { required: false });
  }
};

/**
 * Schema for version status update
 */
const versionStatusUpdateSchema = {
  status: (v, f) => enumValue(v, f, ["In Progress", "Complete", "Rejected", "On Hold"]),
  notes: (v, f) => string(v, f, { required: false, maxLength: 500 })
};

/**
 * Schema for plan goals save
 */
const planGoalsSaveSchema = {
  goals: (v, f) => array(v, f, { required: true, minLength: 1 })
};

/**
 * Schema for decision submission
 */
const decisionSubmitSchema = {
  choice: (v, f) => string(v, f, { required: true, minLength: 1, maxLength: 100 }),
  notes: (v, f) => string(v, f, { required: false, maxLength: 1000 })
};

/**
 * Schema for workstream creation
 */
const workstreamCreateSchema = {
  versionTag: (v, f) => string(v, f, { 
    required: true, 
    pattern: /^(\d+)-(\d+)$/,
    minLength: 3,
    maxLength: 20
  }),
  name: (v, f) => string(v, f, { required: true, minLength: 1, maxLength: 100 }),
  description: (v, f) => string(v, f, { required: false, maxLength: 500 })
};

module.exports = {
  workflowRunSchema,
  agentCompleteSchema,
  versionCreateSchema,
  versionStatusUpdateSchema,
  planGoalsSaveSchema,
  decisionSubmitSchema,
  workstreamCreateSchema
};

