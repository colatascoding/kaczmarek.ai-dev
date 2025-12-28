/**
 * API Server for kaczmarek.ai-dev Frontend
 * Exposes workflow engine, agents, and execution data via HTTP
 */

const http = require("http");
const url = require("url");
const path = require("path");
const WorkflowEngine = require("../workflow/engine");
const WorkflowDatabase = require("../db/database");
const { loadEnvFile, validateApiKeys } = require("./utils");
const { getAgentsByExecutionId: getAgentsByExecutionIdHelper } = require("./agent-helpers");
const { ErrorHandler } = require("../utils/errors");
const { createLogger } = require("../utils/logger");
const createWorkflowRoutes = require("./routes/workflows");
const createExecutionRoutes = require("./routes/executions");
const createAgentRoutes = require("./routes/agents");
const createVersionRoutes = require("./routes/versions");
const createLibraryRoutes = require("./routes/library");
const createWorkstreamRoutes = require("./routes/workstreams");
const createRepoStatusRoutes = require("./routes/repo-status");
const createStaticRoutes = require("./routes/static");

class APIServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.cwd = options.cwd || process.cwd();
    this.workflowsDir = path.join(this.cwd, "workflows");
    this.dbPath = path.join(this.cwd, ".kaczmarek-ai", "workflows.db");

    // Initialize logger
    this.logger = createLogger({ prefix: "API Server", context: { port: this.port } });

    // Load environment variables from .env in the project root (if present)
    loadEnvFile(this.cwd);
    
    // Validate required API keys (skip for tests)
    const skipValidation = options.skipApiKeyValidation || process.env.NODE_ENV === "test";
    validateApiKeys(this.cwd, skipValidation);
    
    // Initialize workflow engine
    this.db = new WorkflowDatabase(this.dbPath);
    this.engine = new WorkflowEngine({
      dbPath: this.dbPath,
      workflowsDir: this.workflowsDir,
      cwd: this.cwd
    });
    
    // Initialize route handlers
    this.workflowRoutes = createWorkflowRoutes(this);
    this.executionRoutes = createExecutionRoutes(this);
    this.agentRoutes = createAgentRoutes(this);
    this.versionRoutes = createVersionRoutes(this);
    this.libraryRoutes = createLibraryRoutes(this);
    this.workstreamRoutes = createWorkstreamRoutes(this);
    this.repoStatusRoutes = createRepoStatusRoutes(this);
    this.staticRoutes = createStaticRoutes(this);
    this.decisionRoutes = require("./routes/decisions")(this);
    
    this.server = null;
  }

  /**
   * Get agents by execution ID
   */
  getAgentsByExecutionId(executionId) {
    return getAgentsByExecutionIdHelper(this.cwd, executionId);
  }

  /**
   * Get agents by execution ID (alias for consistency)
   */
  getAgentsByExecution(executionId) {
    return this.getAgentsByExecutionId(executionId);
  }

  /**
   * Start the API server
   */
  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch(err => {
        const appError = ErrorHandler.handleError(err, req);
        ErrorHandler.logError(appError, { url: req.url, method: req.method });
        
        if (!res.headersSent) {
          const errorResponse = ErrorHandler.formatErrorResponse(appError);
          res.writeHead(appError.statusCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify(errorResponse));
        }
      });
    });

    this.server.listen(this.port, () => {
      this.logger.info(`Server started on http://localhost:${this.port}`);
    });

    this.server.on("error", (err) => {
      this.logger.error("Server error", err);
      throw err;
    });

    return this.server;
  }

  /**
   * Stop the API server
   */
  stop() {
    if (this.server) {
      this.server.close();
      this.logger.info("Server stopped");
    }
  }

  /**
   * Handle HTTP request
   */
  async handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Serve static files
    if (pathname.startsWith("/static/")) {
      this.staticRoutes.serveStaticFile(req, res, pathname);
      return;
    }

    // API routes
    try {
      if (pathname === "/api/workflows" && method === "GET") {
        await this.workflowRoutes.handleListWorkflows(req, res);
      } else if (pathname.startsWith("/api/workflows/") && method === "GET") {
        await this.workflowRoutes.handleGetWorkflow(req, res, pathname);
      } else if (pathname.startsWith("/api/workflows/") && pathname.includes("/run") && method === "POST") {
        await this.workflowRoutes.handleRunWorkflow(req, res, pathname);
      } else if (pathname === "/api/executions" && method === "GET") {
        await this.executionRoutes.handleListExecutions(req, res);
      } else if (pathname.startsWith("/api/executions/") && pathname.endsWith("/decisions") && method === "GET") {
        await this.decisionRoutes.handleGetPendingDecisions(req, res, pathname);
      } else if (pathname.startsWith("/api/executions/") && pathname.endsWith("/next-step") && method === "POST") {
        await this.executionRoutes.handleNextStep(req, res, pathname);
      } else if (pathname.startsWith("/api/executions/") && method === "GET") {
        await this.executionRoutes.handleGetExecution(req, res, pathname);
      } else if (pathname === "/api/agents" && method === "GET") {
        await this.agentRoutes.handleListAgents(req, res);
      } else if (pathname.startsWith("/api/agents/") && method === "GET") {
        await this.agentRoutes.handleGetAgent(req, res, pathname);
      } else if (pathname.startsWith("/api/agents/") && pathname.includes("/complete") && method === "POST") {
        await this.agentRoutes.handleCompleteAgent(req, res, pathname);
            } else if (pathname === "/api/versions/next" && method === "GET") {
              await this.versionRoutes.handleGetNextVersion(req, res);
            } else if (pathname.startsWith("/api/versions/") && pathname.includes("/plan/goals") && method === "POST") {
              await this.versionRoutes.handleSavePlanGoals(req, res);
            } else if (pathname.startsWith("/api/versions/") && pathname.endsWith("/status") && method === "PUT") {
              await this.versionRoutes.handleUpdateStageStatus(req, res);
            } else if (pathname.startsWith("/api/versions/") && pathname.endsWith("/reject") && method === "POST") {
              await this.versionRoutes.handleRejectVersion(req, res);
            } else if (pathname === "/api/versions" && method === "GET") {
              await this.versionRoutes.handleListVersions(req, res);
            } else if (pathname === "/api/versions" && method === "POST") {
              await this.versionRoutes.handleCreateVersion(req, res);
            } else if (pathname.startsWith("/api/versions/") && pathname.endsWith("/planning-agent-status") && method === "GET") {
              await this.versionRoutes.handleGetPlanningAgentStatus(req, res);
            } else if (pathname.startsWith("/api/versions/") && pathname.endsWith("/planning-agent-merge") && method === "POST") {
              await this.versionRoutes.handleMergePlanningAgentBranch(req, res);
            } else if (pathname.match(/^\/api\/versions\/[^/]+\/(plan|implement|test|review)\/summary$/) && method === "GET") {
              await this.versionRoutes.handleGetStageSummary(req, res);
            } else if (pathname.startsWith("/api/library") && method === "GET") {
              if (pathname === "/api/library/workflows") {
                await this.libraryRoutes.handleListLibraryWorkflows(req, res);
              } else if (pathname === "/api/library/items") {
                await this.libraryRoutes.handleListLibraryItems(req, res);
              } else if (pathname.startsWith("/api/library/workflows/")) {
                const workflowId = pathname.split("/").pop();
                if (workflowId === "discover") {
                  await this.libraryRoutes.handleListDiscoveredWorkflows(req, res);
                } else {
                  await this.libraryRoutes.handleGetWorkflowById(req, res);
                }
              } else if (pathname.startsWith("/api/library/dashboards/") && pathname.endsWith("/render")) {
                await this.libraryRoutes.handleRenderDashboard(req, res);
              } else if (pathname === "/api/library/dashboards") {
                await this.libraryRoutes.handleListDashboards(req, res);
              } else if (pathname.startsWith("/api/library/dashboards/")) {
                await this.libraryRoutes.handleGetDashboard(req, res);
              } else if (pathname.startsWith("/api/library/")) {
                await this.libraryRoutes.handleGetLibraryItem(req, res);
              } else {
                await this.libraryRoutes.handleListLibraryItems(req, res);
              }
            } else if (pathname.startsWith("/api/workstreams") && method === "GET") {
              if (pathname.includes("/consolidate")) {
                await this.workstreamRoutes.handleConsolidateWorkstreams(req, res);
              } else if (pathname.split("/").length === 4) {
                // /api/workstreams/:versionTag/:workstreamId
                await this.workstreamRoutes.handleGetWorkstream(req, res);
              } else {
                await this.workstreamRoutes.handleListWorkstreams(req, res);
              }
            } else if (pathname.startsWith("/api/workstreams") && method === "POST") {
              if (pathname.includes("/consolidate")) {
                await this.workstreamRoutes.handleConsolidateWorkstreams(req, res);
              } else {
                await this.workstreamRoutes.handleCreateWorkstream(req, res);
              }
            } else if (pathname === "/api/repo-status" && method === "GET") {
              await this.repoStatusRoutes.handleGetRepoStatus(req, res);
            } else if (pathname.startsWith("/api/decisions/") && pathname.endsWith("/submit") && method === "POST") {
              await this.decisionRoutes.handleSubmitDecision(req, res, pathname);
            } else if (pathname.startsWith("/api/decisions/") && method === "GET") {
              await this.decisionRoutes.handleGetDecision(req, res, pathname);
            } else if (pathname === "/" || pathname === "/index.html") {
              await this.staticRoutes.serveIndex(req, res);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (error) {
      const appError = ErrorHandler.handleError(error, req);
      ErrorHandler.logError(appError, { url: pathname, method });
      
      if (!res.headersSent) {
        const errorResponse = ErrorHandler.formatErrorResponse(appError);
        res.writeHead(appError.statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(errorResponse));
      }
    }
  }
}

module.exports = APIServer;
