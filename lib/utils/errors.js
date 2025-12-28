/**
 * Standardized Error Classes for kaczmarek.ai-dev
 * Provides consistent error handling across the codebase
 */

/**
 * Base error class for all application errors
 */
class AppError extends Error {
  constructor(message, code = "APP_ERROR", statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Validation error - for input validation failures
 */
class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, "VALIDATION_ERROR", 400, { field, value });
    this.field = field;
    this.value = value;
  }
}

/**
 * Not found error - for missing resources
 */
class NotFoundError extends AppError {
  constructor(resource, id = null) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, "NOT_FOUND", 404, { resource, id });
    this.resource = resource;
    this.id = id;
  }
}

/**
 * Workflow error - for workflow execution failures
 */
class WorkflowError extends AppError {
  constructor(message, workflowId = null, stepId = null, executionId = null) {
    super(message, "WORKFLOW_ERROR", 500, { workflowId, stepId, executionId });
    this.workflowId = workflowId;
    this.stepId = stepId;
    this.executionId = executionId;
  }
}

/**
 * Agent error - for agent processing failures
 */
class AgentError extends AppError {
  constructor(message, agentId = null, taskId = null) {
    super(message, "AGENT_ERROR", 500, { agentId, taskId });
    this.agentId = agentId;
    this.taskId = taskId;
  }
}

/**
 * Database error - for database operation failures
 */
class DatabaseError extends AppError {
  constructor(message, operation = null, table = null) {
    super(message, "DATABASE_ERROR", 500, { operation, table });
    this.operation = operation;
    this.table = table;
  }
}

/**
 * Module error - for module loading/execution failures
 */
class ModuleError extends AppError {
  constructor(message, moduleName = null, actionName = null) {
    super(message, "MODULE_ERROR", 500, { moduleName, actionName });
    this.moduleName = moduleName;
    this.actionName = actionName;
  }
}

/**
 * Configuration error - for configuration issues
 */
class ConfigurationError extends AppError {
  constructor(message, configKey = null) {
    super(message, "CONFIGURATION_ERROR", 500, { configKey });
    this.configKey = configKey;
  }
}

/**
 * Path traversal error - for security violations
 */
class PathTraversalError extends AppError {
  constructor(path, basePath = null) {
    const message = `Path traversal attempt detected: ${path}`;
    super(message, "PATH_TRAVERSAL_ERROR", 403, { path, basePath });
    this.path = path;
    this.basePath = basePath;
  }
}

/**
 * Error handler utility
 */
class ErrorHandler {
  /**
   * Handle and format error for API response
   */
  static handleError(error, req = null) {
    // If it's already an AppError, return it
    if (error instanceof AppError) {
      return error;
    }

    // Handle known error types
    if (error.name === "SyntaxError" && error.message.includes("JSON")) {
      return new ValidationError("Invalid JSON in request body", "body", null);
    }

    if (error.code === "ENOENT") {
      return new NotFoundError("File", error.path);
    }

    if (error.code === "SQLITE_CONSTRAINT") {
      return new DatabaseError("Database constraint violation", null, null);
    }

    // Log unexpected errors
    console.error("[ErrorHandler] Unexpected error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      url: req?.url,
      method: req?.method
    });

    // Return generic error
    return new AppError(
      error.message || "An unexpected error occurred",
      "INTERNAL_ERROR",
      500,
      { originalError: error.name }
    );
  }

  /**
   * Format error response for API
   */
  static formatErrorResponse(error) {
    const appError = error instanceof AppError ? error : this.handleError(error);
    return appError.toJSON();
  }

  /**
   * Log error with context
   */
  static logError(error, context = {}) {
    const errorInfo = error instanceof AppError 
      ? error.toJSON().error
      : {
          name: error.name,
          message: error.message,
          stack: error.stack
        };

    console.error("[Error]", {
      ...errorInfo,
      context
    });
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  WorkflowError,
  AgentError,
  DatabaseError,
  ModuleError,
  ConfigurationError,
  PathTraversalError,
  ErrorHandler
};

