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
      } else if (pathname.startsWith("/api/workflows/") && pathname.includes("/run") && method === "POST") {
        await this.handleRunWorkflow(req, res, pathname);
      } else if (pathname === "/api/executions" && method === "GET") {
        await this.handleListExecutions(req, res);
      } else if (pathname.startsWith("/api/executions/") && method === "GET") {
        await this.handleGetExecution(req, res, pathname);
      } else if (pathname === "/api/agents" && method === "GET") {
        await this.handleListAgents(req, res);
      } else if (pathname.startsWith("/api/agents/") && method === "GET") {
        await this.handleGetAgent(req, res, pathname);
      } else if (pathname.startsWith("/api/agents/") && pathname.includes("/complete") && method === "POST") {
        await this.handleCompleteAgent(req, res, pathname);
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
    const YAMLParser = require("../workflow/yaml-parser");
    
    const files = fs.readdirSync(this.workflowsDir)
      .filter(f => f.endsWith(".yaml") || f.endsWith(".yml"))
      .map(f => {
        const filePath = path.join(this.workflowsDir, f);
        const stats = fs.statSync(filePath);
        const workflowId = f.replace(/\.(yaml|yml)$/, "");
        
        // Load workflow YAML to get name and description
        let workflowName = f;
        let workflowDescription = "";
        try {
          const workflow = YAMLParser.loadFromFile(filePath);
          workflowName = workflow.name || workflowName;
          workflowDescription = workflow.description || "";
        } catch (e) {
          // If loading fails, use defaults
          console.warn(`Failed to load workflow ${workflowId}:`, e.message);
        }
        
        // Get workflow from database for version_tag
        const workflowDb = this.db.getWorkflow(workflowId);
        
        // Get executions count
        const executions = this.db.getExecutionsByWorkflow(workflowId) || [];
        
        return {
          id: workflowId,
          name: workflowName,
          description: workflowDescription,
          path: filePath,
          modified: stats.mtime.toISOString(),
          versionTag: workflowDb?.version_tag || null,
          executionCount: executions.length
        };
      });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ workflows: files }));
  }

  /**
   * Find related files for a workflow
   */
  findRelatedFiles(workflowId, workflow) {
    const relatedFiles = [];
    const cwd = this.cwd;
    
    // Built-in file finders
    const finders = {
      // Find latest review file
      "latest-review": () => {
        const reviewDir = path.join(cwd, "review");
        if (!fs.existsSync(reviewDir)) return null;
        
        const files = fs.readdirSync(reviewDir)
          .filter(f => f.match(/^version\d+-\d+\.md$/))
          .map(f => {
            const match = f.match(/^version(\d+)-(\d+)\.md$/);
            return {
              file: f,
              path: path.join(reviewDir, f),
              major: parseInt(match[1], 10),
              minor: parseInt(match[2], 10)
            };
          })
          .sort((a, b) => {
            if (a.major !== b.major) return b.major - a.major;
            return b.minor - a.minor;
          });
        
        if (files.length === 0) return null;
        return {
          type: "review",
          path: files[0].path,
          name: files[0].file,
          relative: path.relative(cwd, files[0].path),
          version: `version${files[0].major}-${files[0].minor}`
        };
      },
      
      // Find latest progress file
      "latest-progress": () => {
        const progressDir = path.join(cwd, "progress");
        if (!fs.existsSync(progressDir)) return null;
        
        const files = fs.readdirSync(progressDir)
          .filter(f => f.match(/^version\d+-\d+\.md$/))
          .map(f => {
            const match = f.match(/^version(\d+)-(\d+)\.md$/);
            return {
              file: f,
              path: path.join(progressDir, f),
              major: parseInt(match[1], 10),
              minor: parseInt(match[2], 10)
            };
          })
          .sort((a, b) => {
            if (a.major !== b.major) return b.major - a.major;
            return b.minor - a.minor;
          });
        
        if (files.length === 0) return null;
        return {
          type: "progress",
          path: files[0].path,
          name: files[0].file,
          relative: path.relative(cwd, files[0].path),
          version: `version${files[0].major}-${files[0].minor}`
        };
      },
      
      // Find workflow file itself
      "workflow-file": () => {
        const workflowPath = path.join(this.workflowsDir, `${workflowId}.yaml`);
        if (!fs.existsSync(workflowPath)) return null;
        return {
          type: "workflow",
          path: workflowPath,
          name: `${workflowId}.yaml`,
          relative: path.relative(cwd, workflowPath)
        };
      }
    };
    
    // Check for custom file patterns in workflow metadata
    const customPatterns = workflow.relatedFiles || workflow.metadata?.relatedFiles || [];
    
    // Add built-in patterns for review-related workflows
    if (workflowId.includes("review") || workflow.description?.toLowerCase().includes("review")) {
      const reviewFile = finders["latest-review"]();
      if (reviewFile) relatedFiles.push(reviewFile);
      
      const progressFile = finders["latest-progress"]();
      if (progressFile) relatedFiles.push(progressFile);
    }
    
    // Process custom patterns
    for (const pattern of customPatterns) {
      if (typeof pattern === "string") {
        // Function name
        if (finders[pattern]) {
          const file = finders[pattern]();
          if (file) relatedFiles.push(file);
        } else {
          // Regex or glob pattern
          try {
            const regex = new RegExp(pattern);
            const searchDirs = [
              path.join(cwd, "review"),
              path.join(cwd, "progress"),
              path.join(cwd, "docs"),
              cwd
            ];
            
            for (const dir of searchDirs) {
              if (!fs.existsSync(dir)) continue;
              const files = fs.readdirSync(dir, { withFileTypes: true });
              for (const file of files) {
                if (file.isFile() && regex.test(file.name)) {
                  const filePath = path.join(dir, file.name);
                  relatedFiles.push({
                    type: "custom",
                    path: filePath,
                    name: file.name,
                    relative: path.relative(cwd, filePath),
                    pattern: pattern
                  });
                }
              }
            }
          } catch (e) {
            // Invalid regex, skip
          }
        }
      } else if (typeof pattern === "object") {
        // Pattern object with type, path, etc.
        if (pattern.function && finders[pattern.function]) {
          const file = finders[pattern.function]();
          if (file) {
            Object.assign(file, pattern);
            relatedFiles.push(file);
          }
        } else if (pattern.path) {
          const filePath = path.isAbsolute(pattern.path) 
            ? pattern.path 
            : path.join(cwd, pattern.path);
          if (fs.existsSync(filePath)) {
            relatedFiles.push({
              type: pattern.type || "custom",
              path: filePath,
              name: path.basename(filePath),
              relative: path.relative(cwd, filePath),
              label: pattern.label || pattern.name
            });
          }
        }
      }
    }
    
    // Always add workflow file
    const workflowFile = finders["workflow-file"]();
    if (workflowFile) relatedFiles.push(workflowFile);
    
    return relatedFiles;
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
    const workflow = YAMLParser.loadFromFile(workflowPath);

    // Get workflow from database to get version_tag
    const workflowDb = this.db.getWorkflow(workflowId);
    const versionTag = workflowDb?.version_tag || null;

    // Get execution history with agent links
    const executions = this.db.getExecutionsByWorkflow(workflowId) || [];
    
    // For each execution, find linked agents
    const executionsWithAgents = executions.map(exec => {
      const agents = this.getAgentsByExecutionId(exec.executionId);
      return {
        ...exec,
        agents: agents || [],
        agentCount: agents.length
      };
    });

    // Find related files
    const relatedFiles = this.findRelatedFiles(workflowId, workflow);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      workflow,
      versionTag,
      executions: executionsWithAgents,
      relatedFiles
    }));
  }
  
  /**
   * Get agents by execution ID
   */
  getAgentsByExecutionId(executionId) {
    const queueDir = path.join(this.cwd, ".kaczmarek-ai", "agent-queue");
    const agents = [];
    
    if (!fs.existsSync(queueDir)) {
      return agents;
    }
    
    const files = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const task = JSON.parse(fs.readFileSync(path.join(queueDir, file), "utf8"));
        if (task.executionId === executionId) {
          agents.push({
            id: task.id,
            status: task.status,
            type: task.type,
            versionTag: task.versionTag,
            createdAt: task.startedAt,
            readyAt: task.readyAt,
            completedAt: task.completedAt
          });
        }
      } catch (e) {
        // Skip invalid files
      }
    }
    
    return agents;
  }
  
  /**
   * Get agents by execution ID (alias for consistency)
   */
  getAgentsByExecution(executionId) {
    return this.getAgentsByExecutionId(executionId);
  }

  /**
   * Run workflow
   */
  async handleRunWorkflow(req, res, pathname) {
    // Extract workflow ID from path like /api/workflows/{id}/run
    const parts = pathname.split("/");
    const workflowId = parts[parts.length - 2]; // Get ID before "run"
    
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const params = body ? JSON.parse(body) : {};
        
        // Execute workflow asynchronously
        this.engine.execute(workflowId, params).then(result => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            executionId: result.id,
            workflowId: result.workflowId,
            message: "Workflow execution started"
          }));
        }).catch(error => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        });
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
      
      // Add workflow and agent links
      const executionsWithLinks = executions.map(exec => {
        const workflow = this.db.getWorkflow(exec.workflowId);
        const agents = this.getAgentsByExecutionId(exec.executionId);
        return {
          ...exec,
          workflow: workflow ? {
            id: workflow.id,
            name: workflow.name,
            version: workflow.version,
            versionTag: workflow.version_tag
          } : null,
          agents: agents || [],
          agentCount: agents.length
        };
      });
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ executions: executionsWithLinks }));
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

      // Get workflow details
      const workflow = execution.workflow_id ? this.db.getWorkflow(execution.workflow_id) : null;
      
      // Get linked agents
      const agents = this.getAgentsByExecutionId(executionId);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        execution: {
          ...execution,
          executionId: execution.id,
          workflowId: execution.workflow_id,
          versionTag: execution.version_tag
        },
        workflow: workflow ? {
          id: workflow.id,
          name: workflow.name,
          version: workflow.version
        } : null,
        steps: stepExecutions,
        agents
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
            const agent = {
              id: task.id,
              executionId: task.executionId || null,
              versionTag: task.versionTag || null,
              status: task.status,
              type: task.type,
              tasks: task.tasks || [],
              createdAt: task.startedAt,
              readyAt: task.readyAt,
              completedAt: task.completedAt
            };
            
            // Get execution details if linked
            if (agent.executionId) {
              const execution = this.db.getExecution(agent.executionId);
              if (execution) {
                agent.execution = {
                  id: execution.id,
                  workflowId: execution.workflow_id,
                  status: execution.status,
                  startedAt: execution.started_at
                };
                // Get workflow details
                if (execution.workflow_id) {
                  const workflow = this.db.getWorkflow(execution.workflow_id);
                  if (workflow) {
                    agent.workflow = {
                      id: workflow.id,
                      name: workflow.name
                    };
                  }
                }
              }
            }
            
            return agent;
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
    
    // Get execution and workflow info
    let execution = null;
    let workflow = null;
    if (task.executionId) {
      execution = this.db.getExecution(task.executionId);
      if (execution) {
        workflow = this.db.getWorkflow(execution.workflow_id);
      }
    }
    
    const agentWithLinks = {
      ...task,
      execution: execution ? {
        executionId: execution.id,
        workflowId: execution.workflow_id,
        status: execution.status,
        versionTag: execution.version_tag
      } : null,
      workflow: workflow ? {
        id: workflow.id,
        name: workflow.name,
        version: workflow.version,
        versionTag: workflow.version_tag
      } : null
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ agent: agentWithLinks }));
  }

  /**
   * Complete an agent task
   */
  async handleCompleteAgent(req, res, pathname) {
    // Extract agent ID from path like /api/agents/{id}/complete
    const parts = pathname.split("/");
    const agentId = parts[parts.length - 2]; // Get ID before "complete"
    
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const queueDir = path.join(this.cwd, ".kaczmarek-ai", "agent-queue");
        const taskFile = path.join(queueDir, `${agentId}.json`);

        if (!fs.existsSync(taskFile)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Agent task not found" }));
          return;
        }

        const task = JSON.parse(fs.readFileSync(taskFile, "utf8"));

        // Find review and progress files
        let reviewFile = null;
        let progressFile = null;

        // Try to get from version tag
        if (task.versionTag) {
          const reviewPath = path.join(this.cwd, "review", `${task.versionTag}.md`);
          const progressPath = path.join(this.cwd, "progress", `${task.versionTag}.md`);
          
          if (fs.existsSync(reviewPath)) {
            reviewFile = reviewPath;
          }
          if (fs.existsSync(progressPath)) {
            progressFile = progressPath;
          }
        }

        // If not found, try to find latest version
        if (!reviewFile || !progressFile) {
          try {
            const ModuleLoader = require("../modules/module-loader");
            const loader = new ModuleLoader(this.cwd);
            const findVersionAction = loader.getAction("review", "find-current-version");
            
            if (findVersionAction) {
              const versionResult = await findVersionAction(
                { cwd: this.cwd, reviewDir: "review", progressDir: "progress" },
                { logger: { info: () => {}, error: () => {}, warn: () => {} } }
              );
              
              if (versionResult && versionResult.found) {
                reviewFile = reviewFile || versionResult.reviewFile;
                progressFile = progressFile || versionResult.progressFile;
              }
            }
          } catch (e) {
            // If finding version fails, continue without it
          }
        }

        // Use provided files or found files
        reviewFile = params.reviewFile || reviewFile;
        progressFile = params.progressFile || progressFile;

        // Get task completion module
        const ModuleLoader = require("../modules/module-loader");
        const loader = new ModuleLoader(this.cwd);
        const completeAction = loader.getAction("task-completion", "complete-task-workflow");

        if (!completeAction) {
          throw new Error("Task completion module not found");
        }

        // Execute completion
        const result = await completeAction(
          {
            taskId: agentId,
            progressFile,
            reviewFile,
            results: params.results || {},
            cwd: this.cwd
          },
          {
            logger: {
              info: (msg) => console.log(`[API] ${msg}`),
              error: (msg) => console.error(`[API] ${msg}`),
              warn: (msg) => console.warn(`[API] ${msg}`)
            }
          }
        );

        if (result.success) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            taskId: agentId,
            completedAt: result.completedAt,
            message: "Task completed successfully"
          }));
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: result.error || "Failed to complete task" }));
        }
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
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
        
        // Get workflows for this version
        let workflows = [];
        try {
          const allWorkflows = this.db.listWorkflows();
          workflows = allWorkflows
            .filter(w => w.version_tag === version.tag)
            .map(w => ({
              id: w.id,
              name: w.name,
              version: w.version
            }));
        } catch (e) {
          // If query fails, workflows will be empty array
          workflows = [];
        }
        
        // Get executions for this version
        const executions = this.db.listExecutions(null, null, version.tag) || [];
        
        // Get agents for this version
        const agents = [];
        const queueDir = path.join(this.cwd, ".kaczmarek-ai", "agent-queue");
        if (fs.existsSync(queueDir)) {
          const files = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
          for (const file of files) {
            try {
              const task = JSON.parse(fs.readFileSync(path.join(queueDir, file), "utf8"));
              if (task.versionTag === version.tag) {
                agents.push({
                  id: task.id,
                  status: task.status,
                  executionId: task.executionId
                });
              }
            } catch (e) {
              // Skip invalid files
            }
          }
        }
        
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
          completedStepsCount,
          workflows: workflows || [],
          workflowCount: workflows.length,
          executions: executions || [],
          executionCount: executions.length,
          agents: agents || [],
          agentCount: agents.length
        });
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ versions }));
  }
}

module.exports = APIServer;

