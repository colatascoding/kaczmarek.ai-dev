/**
 * Input validation utilities for API endpoints
 */

const { ValidationError, PathTraversalError } = require("./errors");
const path = require("path");

/**
 * Validate that a value is not empty
 */
function required(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    throw new ValidationError(`${fieldName} is required`, fieldName, value);
  }
  return value;
}

/**
 * Validate string type
 */
function string(value, fieldName, options = {}) {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, value);
    }
    return options.default || null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
  }

  if (options.minLength && value.length < options.minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${options.minLength} characters`,
      fieldName,
      value
    );
  }

  if (options.maxLength && value.length > options.maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${options.maxLength} characters`,
      fieldName,
      value
    );
  }

  if (options.pattern && !options.pattern.test(value)) {
    throw new ValidationError(
      `${fieldName} does not match required pattern`,
      fieldName,
      value
    );
  }

  return value;
}

/**
 * Validate number type
 */
function number(value, fieldName, options = {}) {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, value);
    }
    return options.default || null;
  }

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName, value);
  }

  if (options.min !== undefined && num < options.min) {
    throw new ValidationError(
      `${fieldName} must be at least ${options.min}`,
      fieldName,
      value
    );
  }

  if (options.max !== undefined && num > options.max) {
    throw new ValidationError(
      `${fieldName} must be at most ${options.max}`,
      fieldName,
      value
    );
  }

  return num;
}

/**
 * Validate boolean type
 */
function boolean(value, fieldName, options = {}) {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, value);
    }
    return options.default || false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }

  throw new ValidationError(`${fieldName} must be a boolean`, fieldName, value);
}

/**
 * Validate array type
 */
function array(value, fieldName, options = {}) {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, value);
    }
    return options.default || [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`, fieldName, value);
  }

  if (options.minLength && value.length < options.minLength) {
    throw new ValidationError(
      `${fieldName} must have at least ${options.minLength} items`,
      fieldName,
      value
    );
  }

  if (options.maxLength && value.length > options.maxLength) {
    throw new ValidationError(
      `${fieldName} must have at most ${options.maxLength} items`,
      fieldName,
      value
    );
  }

  return value;
}

/**
 * Validate object type
 */
function object(value, fieldName, options = {}) {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, value);
    }
    return options.default || null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object`, fieldName, value);
  }

  return value;
}

/**
 * Validate enum value
 */
function enumValue(value, fieldName, allowedValues) {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`, fieldName, value);
  }

  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`,
      fieldName,
      value
    );
  }

  return value;
}

/**
 * Validate UUID format
 */
function uuid(value, fieldName) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`, fieldName, value);
  }
  return value;
}

/**
 * Validate and sanitize file path (prevent path traversal)
 */
function sanitizePath(filePath, baseDir) {
  if (!filePath) {
    throw new ValidationError("Path is required", "path", filePath);
  }

  // Resolve to absolute path
  const resolvedPath = path.resolve(baseDir, filePath);
  const resolvedBase = path.resolve(baseDir);

  // Check if resolved path is within base directory
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new PathTraversalError(filePath, baseDir);
  }

  return resolvedPath;
}

/**
 * Validate request body
 */
function validateBody(body, schema) {
  const validated = {};
  const errors = [];

  for (const [field, validator] of Object.entries(schema)) {
    try {
      const value = validator(body[field], field);
      if (value !== undefined) {
        validated[field] = value;
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      } else {
        errors.push(new ValidationError(`Validation failed for ${field}`, field, body[field]));
      }
    }
  }

  if (errors.length > 0) {
    const firstError = errors[0];
    if (errors.length === 1) {
      throw firstError;
    }
    // Multiple errors - create a combined error
    throw new ValidationError(
      `Multiple validation errors: ${errors.map(e => e.message).join("; ")}`,
      "body",
      body
    );
  }

  return validated;
}

/**
 * Validate query parameters
 */
function validateQuery(query, schema) {
  return validateBody(query, schema);
}

/**
 * Validate path parameters
 */
function validateParams(params, schema) {
  return validateBody(params, schema);
}

module.exports = {
  required,
  string,
  number,
  boolean,
  array,
  object,
  enumValue,
  uuid,
  sanitizePath,
  validateBody,
  validateQuery,
  validateParams
};

