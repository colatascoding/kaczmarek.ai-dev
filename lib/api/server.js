/**
 * API Server for kaczmarek.ai-dev Frontend
 * Exposes workflow engine, agents, and execution data via HTTP
 */

const http = require("http");
const url = require("url");
const path = require("path");
const fs = require("fs");
const WorkflowEngine = require("../workflow/engine");
const WorkflowDatabase = require("../db/database");
const ModuleLoader = require("../modules/module-loader");

class APIServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.cwd = options.cwd || process.cwd();
    this.workflowsDir = path.join(this.cwd, "workflows");
    this.dbPath = path.join(this.cwd, ".kaczmarek-ai", "workflows.db");
    
    // Initialize workflow engine
    this.db = new WorkflowDatabase(this.dbPath);
    this.engine = new WorkflowEngine({
      dbPath: this.dbPath,
      workflowsDir: this.workflowsDir,
      cwd: this.cwd
    });
    
    this.server = null;
  }

  /**
   * Start the API server
   */
  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch(err => {
        console.error("[API Server] Request error:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    });

    this.server.listen(this.port, () => {
      console.log(`[API Server] Started on http://localhost:${this.port}`);
    });

    this.server.on("error", (err) => {
      console.error("[API Server] Server error:", err);
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
      console.log("[API Server] Stopped");
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
      this.serveStaticFile(req, res, pathname);
      return;
    }

    // API routes
    try {
      if (pathname === "/api/workflows" && method === "GET") {
        await this.handleListWorkflows(req, res);
      } else if (pathname.startsWith("/api/workflows/") && method === "GET") {
        await this.handleGetWorkflow(req, res, pathname);
      } else if (pathname.startsWith("/api/workflows/") && method === "POST") {
        await this.handleRunWorkflow(req, res, pathname);
      } else if (pathname === "/api/executions" && method === "GET") {
        await this.handleListExecutions(req, res);
      } else if (pathname.startsWith("/api/executions/") && method === "GET") {
        await this.handleGetExecution(req, res, pathname);
      } else if (pathname === "/api/agents" && method === "GET") {
        await this.handleListAgents(req, res);
      } else if (pathname.startsWith("/api/agents/") && method === "GET") {
        await this.handleGetAgent(req, res, pathname);
      } else if (pathname === "/api/versions" && method === "GET") {
        await this.handleListVersions(req, res);
      } else if (pathname === "/" || pathname === "/index.html") {
        await this.serveIndex(req, res);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (error) {
      console.error("[API Server] Error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message, stack: error.stack }));
    }
  }

  /**
   * Serve static files
   */
  serveStaticFile(req, res, pathname) {
    const filePath = path.join(__dirname, "..", "..", "frontend", pathname.replace("/static/", ""));
    
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml"
    };

    res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain" });
    fs.createReadStream(filePath).pipe(res);
  }

  /**
   * Serve index.html
   */
  async serveIndex(req, res) {
    const indexPath = path.join(__dirname, "..", "..", "frontend", "index.html");
    
    if (!fs.existsSync(indexPath)) {
      res.writeHead(404);
      res.end("Frontend not found. Run 'npm run build-frontend' first.");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(indexPath).pipe(res);
  }

  /**
   * List all workflows
   */
  async handleListWorkflows(req, res) {
    const files = fs.readdirSync(this.workflowsDir)
      .filter(f => f.endsWith(".yaml") || f.endsWith(".yml"))
      .map(f => {
        const filePath = path.join(this.workflowsDir, f);
        const stats = fs.statSync(filePath);
        return {
          id: f.replace(/\.(yaml|yml)$/, ""),
          name: f,
          path: filePath,
          modified: stats.mtime.toISOString()
        };
      });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ workflows: files }));
  }

  /**
   * Get workflow details
   */
  async handleGetWorkflow(req, res, pathname) {
    const workflowId = pathname.split("/").pop();
    const workflowPath = path.join(this.workflowsDir, `${workflowId}.yaml`);

    if (!fs.existsSync(workflowPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Workflow not found" }));
      return;
    }

    const YAMLParser = require("../workflow/yaml-parser");
    const parser = new YAMLParser();
    const workflow = parser.load(workflowPath);

    // Get execution history
    const executions = this.db.getExecutionsByWorkflow(workflowId) || [];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      workflow,
      executions: executions || []
    }));
  }

  /**
   * Run workflow
   */
  async handleRunWorkflow(req, res, pathname) {
    const workflowId = pathname.split("/").pop().replace("/run", "");
    
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const executionId = await this.engine.execute(workflowId, params);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          executionId,
          message: "Workflow execution started"
        }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  /**
   * List executions
   */
  async handleListExecutions(req, res) {
    try {
      const executions = this.db.getAllExecutions() || [];
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ executions }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Get execution details
   */
  async handleGetExecution(req, res, pathname) {
    try {
      const executionId = pathname.split("/").pop();
      const execution = this.db.getExecution(executionId);
      const stepExecutions = this.db.getStepExecutions(executionId) || [];

      if (!execution) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Execution not found" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        execution,
        steps: stepExecutions
      }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * List agent tasks
   */
  async handleListAgents(req, res) {
    const queueDir = path.join(this.cwd, ".kaczmarek-ai", "agent-queue");
    const agents = [];

    if (fs.existsSync(queueDir)) {
      const files = fs.readdirSync(queueDir)
        .filter(f => f.endsWith(".json"))
        .map(f => {
          const filePath = path.join(queueDir, f);
          try {
            const task = JSON.parse(fs.readFileSync(filePath, "utf8"));
            return {
              id: task.id,
              status: task.status,
              type: task.type,
              tasks: task.tasks || [],
              createdAt: task.startedAt,
              readyAt: task.readyAt,
              completedAt: task.completedAt
            };
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);

      agents.push(...files);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ agents }));
  }

  /**
   * Get agent task details
   */
  async handleGetAgent(req, res, pathname) {
    const agentId = pathname.split("/").pop();
    const queueDir = path.join(this.cwd, ".kaczmarek-ai", "agent-queue");
    const taskFile = path.join(queueDir, `${agentId}.json`);

    if (!fs.existsSync(taskFile)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Agent task not found" }));
      return;
    }

    const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ agent: task }));
  }

  /**
   * List versions (review/progress files)
   */
  async handleListVersions(req, res) {
    const reviewDir = path.join(this.cwd, "review");
    const progressDir = path.join(this.cwd, "progress");
    const versions = [];

    if (fs.existsSync(reviewDir)) {
      const reviewFiles = fs.readdirSync(reviewDir)
        .filter(f => f.match(/^version\d+-\d+\.md$/))
        .map(f => {
          const match = f.match(/^version(\d+)-(\d+)\.md$/);
          return {
            file: f,
            major: parseInt(match[1], 10),
            minor: parseInt(match[2], 10),
            tag: `version${match[1]}-${match[2]}`
          };
        })
        .sort((a, b) => {
          if (a.major !== b.major) return b.major - a.major;
          return b.minor - a.minor;
        });

      for (const version of reviewFiles) {
        const reviewPath = path.join(reviewDir, version.file);
        const progressPath = path.join(progressDir, version.file);
        
        let summary = "";
        let status = "Unknown";
        let started = null;
        let completed = null;
        let nextStepsCount = 0;
        let completedStepsCount = 0;
        
        if (fs.existsSync(reviewPath)) {
          const content = fs.readFileSync(reviewPath, "utf8");
          
          // Extract summary (first paragraph after "## Summary")
          const summaryMatch = content.match(/## Summary\s*\n\n(.+?)(?:\n\n|##)/s);
          if (summaryMatch) {
            summary = summaryMatch[1].trim();
          }
          
          // Extract status
          const statusMatch = content.match(/\*\*Status\*\*:\s*(.+?)(?:\n|$)/);
          if (statusMatch) {
            status = statusMatch[1].trim();
          }
          
          // Extract started date
          const startedMatch = content.match(/\*\*Started\*\*:\s*(\d{4}-\d{2}-\d{2})/);
          if (startedMatch) {
            started = startedMatch[1];
          }
          
          // Extract completed date
          const completedMatch = content.match(/\*\*Completed\*\*:\s*(\d{4}-\d{2}-\d{2})/);
          if (completedMatch) {
            completed = completedMatch[1];
          }
          
          // Count next steps
          const nextStepsMatch = content.match(/## Next Steps\s*\n([\s\S]*?)(?=\n##|\n*$)/);
          if (nextStepsMatch) {
            const nextStepsContent = nextStepsMatch[1];
            const allTasks = nextStepsContent.match(/^[-*]\s*\[([\sx])\]/gm) || [];
            nextStepsCount = allTasks.length;
            completedStepsCount = allTasks.filter(t => t.includes("x")).length;
          }
        }
        
        versions.push({
          tag: version.tag,
          reviewFile: reviewPath,
          progressFile: fs.existsSync(progressPath) ? progressPath : null,
          hasReview: fs.existsSync(reviewPath),
          hasProgress: fs.existsSync(progressPath),
          summary: summary.substring(0, 200) + (summary.length > 200 ? "..." : ""),
          status,
          started,
          completed,
          nextStepsCount,
          completedStepsCount
        });
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ versions }));
  }
}

module.exports = APIServer;

