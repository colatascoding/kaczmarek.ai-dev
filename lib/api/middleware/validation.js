/**
 * Validation middleware for API routes
 */

const { validateBody, validateQuery, validateParams } = require("../../utils/validation");
const { ErrorHandler } = require("../../utils/errors");

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    
    req.on("data", chunk => {
      body += chunk.toString();
    });
    
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON in request body"));
      }
    });
    
    req.on("error", reject);
  });
}

/**
 * Middleware to validate request body
 */
function validateRequestBody(schema) {
  return async (req, res, next) => {
    try {
      const body = await parseBody(req);
      req.body = validateBody(body, schema);
      next();
    } catch (error) {
      const appError = ErrorHandler.handleError(error, req);
      res.writeHead(appError.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(ErrorHandler.formatErrorResponse(appError)));
    }
  };
}

/**
 * Middleware to validate query parameters
 */
function validateQueryParams(schema) {
  return (req, res, next) => {
    try {
      const url = require("url");
      const parsedUrl = url.parse(req.url, true);
      req.query = validateQuery(parsedUrl.query || {}, schema);
      next();
    } catch (error) {
      const appError = ErrorHandler.handleError(error, req);
      res.writeHead(appError.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(ErrorHandler.formatErrorResponse(appError)));
    }
  };
}

/**
 * Middleware to validate path parameters
 */
function validatePathParams(schema) {
  return (req, res, next) => {
    try {
      // Extract path params from URL (basic implementation)
      // In a full implementation, you'd use a router that provides req.params
      const url = require("url");
      const parsedUrl = url.parse(req.url, true);
      const pathParts = parsedUrl.pathname.split("/").filter(p => p);
      
      // This is a simplified version - in practice, you'd extract params based on route pattern
      req.params = validateParams({}, schema); // Placeholder
      next();
    } catch (error) {
      const appError = ErrorHandler.handleError(error, req);
      res.writeHead(appError.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(ErrorHandler.formatErrorResponse(appError)));
    }
  };
}

module.exports = {
  parseBody,
  validateRequestBody,
  validateQueryParams,
  validatePathParams
};

