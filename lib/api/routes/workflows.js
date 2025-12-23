/**
 * Workflow route handlers
 */

const path = require("path");
const fs = require("fs");

/**
 * Create workflow routes handler
 */
function createWorkflowRoutes(server) {
  return {
    /**
     * List all workflows
     */
    async handleListWorkflows(req, res) {
      const YAMLParser = require("../../workflow/yaml-parser");
      
      const files = fs.readdirSync(server.workflowsDir)
        .filter(f => f.endsWith(".yaml") || f.endsWith(".yml"))
        .map(f => {
          const filePath = path.join(server.workflowsDir, f);
          const stats = fs.statSync(filePath);
          const workflowId = f.replace(/\.(yaml|yml)$/, "");
          
          // Load workflow YAML to get name and description
          let workflowName = f;
          let workflowDescription = "";
          let automationMode = "human-in-the-loop";
          try {
            const workflow = YAMLParser.loadFromFile(filePath);
            workflowName = workflow.name || workflowName;
            workflowDescription = workflow.description || "";

            // Prefer explicit interaction/automation mode if provided in YAML
            const explicitMode =
              workflow.interactionMode ||
              workflow.automationMode ||
              workflow.executionMode;

            if (explicitMode && typeof explicitMode === "string") {
              automationMode = explicitMode;
            } else if (Array.isArray(workflow.steps)) {
              // Heuristic: mark as automated if it uses background agents or Claude
              const hasAgentAutomation = workflow.steps.some(
                s => s && s.module === "agent" && s.action === "launch-background"
              );
              const hasClaude = workflow.steps.some(
                s => s && s.module === "claude"
              );

              if (hasAgentAutomation || hasClaude) {
                automationMode = "automated";
              }
            }
          } catch (e) {
            // If loading fails, use defaults
            console.warn(`Failed to load workflow ${workflowId}:`, e.message);
          }
          
          // Get workflow from database for version_tag
          const workflowDb = server.db.getWorkflow(workflowId);
          
          // Get executions count
          const executions = server.db.getExecutionsByWorkflow(workflowId) || [];
          
          return {
            id: workflowId,
            name: workflowName,
            description: workflowDescription,
            path: filePath,
            modified: stats.mtime.toISOString(),
            versionTag: workflowDb?.version_tag || null,
            executionCount: executions.length,
            automationMode
          };
        });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ workflows: files }));
    },

    /**
     * Find related files for a workflow
     */
    findRelatedFiles(workflowId, workflow) {
      const relatedFiles = [];
      const cwd = server.cwd;
      
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
          const workflowPath = path.join(server.workflowsDir, `${workflowId}.yaml`);
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
    },

    /**
     * Get workflow details
     */
    async handleGetWorkflow(req, res, pathname) {
      const workflowId = pathname.split("/").pop();
      const workflowPath = path.join(server.workflowsDir, `${workflowId}.yaml`);

      if (!fs.existsSync(workflowPath)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Workflow not found" }));
        return;
      }

      const YAMLParser = require("../../workflow/yaml-parser");
      const workflow = YAMLParser.loadFromFile(workflowPath);

      // Get workflow from database to get version_tag
      const workflowDb = server.db.getWorkflow(workflowId);
      const versionTag = workflowDb?.version_tag || null;

      // Get execution history with agent links
      const executions = server.db.getExecutionsByWorkflow(workflowId) || [];
      
      // For each execution, find linked agents
      const executionsWithAgents = executions.map(exec => {
        const agents = server.getAgentsByExecutionId(exec.executionId);
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
    },

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
          const executionMode = params.executionMode || "auto";
          delete params.executionMode;
          
          // Execute workflow asynchronously
          server.engine.execute(workflowId, params, { executionMode }).then(result => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              success: true,
              executionId: result.id,
              workflowId: result.workflowId,
              executionMode,
              message: executionMode === "step" ? "Workflow step-by-step execution started" : "Workflow execution started"
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
  };
}

module.exports = createWorkflowRoutes;

