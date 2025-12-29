/**
 * Workstream route handlers
 */

const { loadConfig } = require("../../../bin/utils");
const versionOps = require("../../versions/file-operations");
const workstreamOps = require("../../modules/implementation/workstream-operations");

/**
 * Create workstream routes handler
 */
function createWorkstreamRoutes(server) {
  return {
    /**
     * List workstreams for a version
     */
    async handleListWorkstreams(req, res) {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const versionTag = parsedUrl.searchParams.get("versionTag");
      
      if (!versionTag) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Version tag required" }));
        return;
      }

      try {
        const result = await workstreamOps.listWorkstreams(
          { cwd: server.cwd, versionTag },
          { logger: console }
        );
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ workstreams: result.workstreams || [] }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    },

    /**
     * Get workstream details
     */
    async handleGetWorkstream(req, res) {
      const urlParts = req.url.split("/");
      const versionTag = urlParts[urlParts.length - 3];
      const workstreamId = urlParts[urlParts.length - 1];
      
      const workstreamPath = versionOps.getWorkstreamPath(versionTag, workstreamId, server.cwd);
      if (!workstreamPath) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Workstream not found" }));
        return;
      }

      const fs = require("fs");
      const path = require("path");
      
      // Load workstream metadata
      const metadataPath = path.join(workstreamPath, "workstream.json");
      let metadata = null;
      if (fs.existsSync(metadataPath)) {
        try {
          const metadataContent = fs.readFileSync(metadataPath, "utf8");
          if (metadataContent.trim()) {
            metadata = JSON.parse(metadataContent);
          }
        } catch (e) {
          console.error(`Failed to parse workstream metadata for ${workstreamId}: ${e.message}`);
          // Use defaults - metadata will be {}
        }
      }

      // Load progress
      const progressPath = path.join(workstreamPath, "progress.md");
      let progress = "";
      if (fs.existsSync(progressPath)) {
        try {
          progress = fs.readFileSync(progressPath, "utf8");
        } catch (e) {
          console.error(`Failed to read workstream progress for ${workstreamId}: ${e.message}`);
          progress = "";
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        workstreamId,
        versionTag,
        workstreamPath,
        metadata: metadata || {},
        progress
      }));
    },

    /**
     * Create workstream
     */
    async handleCreateWorkstream(req, res) {
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          let data;
          try {
            data = body ? JSON.parse(body) : {};
          } catch (parseError) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON in request body", details: parseError.message }));
            return;
          }
          
          const { versionTag, workstreamName, description } = data;

          if (!versionTag || !workstreamName) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Version tag and workstream name required" }));
            return;
          }

          // Validate version tag format
          if (!/^\d+-\d+$/.test(versionTag)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid version tag format. Expected format: major-minor (e.g., 0-14)" }));
            return;
          }

          // Validate workstream name
          if (workstreamName.length === 0 || workstreamName.length > 100) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Workstream name must be between 1 and 100 characters" }));
            return;
          }

          // Check for invalid characters (will be sanitized, but warn user)
          if (/[/\\:*?"<>|]/.test(workstreamName)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
              error: "Workstream name contains invalid characters. Cannot contain: / \\ : * ? \" < > |",
              suggestion: "These characters will be replaced with hyphens"
            }));
            return;
          }

          const result = await workstreamOps.createWorkstream(
            { cwd: server.cwd, versionTag, workstreamName, description },
            { logger: console }
          );

          if (result.success) {
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } else {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          }
        } catch (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },

    /**
     * Consolidate workstreams
     */
    async handleConsolidateWorkstreams(req, res) {
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          let data = {};
          if (body) {
            try {
              data = JSON.parse(body);
            } catch (parseError) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid JSON in request body", details: parseError.message }));
              return;
            }
          }
          
          const { extractVersionTagFromUrl } = require("../../utils/formatting");
          const urlParts = req.url.split("/").filter(p => p);
          const versionTag = data.versionTag || extractVersionTagFromUrl(urlParts, "workstreams");

          if (!versionTag) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Version tag required" }));
            return;
          }

          const result = await workstreamOps.consolidateWorkstreams(
            { cwd: server.cwd, versionTag },
            { logger: console }
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },

    /**
     * Launch agent for a workstream
     * POST /api/workstreams/:versionTag/:workstreamId/launch
     */
    async handleLaunchWorkstreamAgent(req, res) {
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const urlParts = req.url.split("/").filter(p => p);
          const workstreamsIndex = urlParts.indexOf("workstreams");
          if (workstreamsIndex === -1 || workstreamsIndex + 2 >= urlParts.length) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid URL format" }));
            return;
          }
          
          const versionTag = urlParts[workstreamsIndex + 1];
          const workstreamId = urlParts[workstreamsIndex + 2];
          
          // Validate versionTag and workstreamId format
          if (!versionTag || !/^\d+-\d+$/.test(versionTag)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid version tag format. Expected format: major-minor (e.g., 0-14)" }));
            return;
          }
          
          if (!workstreamId || workstreamId.includes("/") || workstreamId.includes("..") || workstreamId.length > 100) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid workstream ID. Must not contain slashes, dots, or be longer than 100 characters" }));
            return;
          }
          
          let data = {};
          if (body) {
            try {
              data = JSON.parse(body);
            } catch (parseError) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid JSON in request body", details: parseError.message }));
              return;
            }
          }
          
          const { agentType = "cursor", autoMerge = false, mergeStrategy = "merge" } = data;

          const result = await workstreamOps.launchWorkstreamAgent(
            {
              cwd: server.cwd,
              versionTag,
              workstreamId,
              agentType,
              autoMerge,
              mergeStrategy
            },
            { logger: console }
          );

          if (result.success) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          }
        } catch (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },

    /**
     * Manually create workstreams from goals.md
     * POST /api/workstreams/:versionTag/create-from-goals
     */
    async handleCreateWorkstreamsFromGoals(req, res) {
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const pathParts = parsedUrl.pathname.split("/").filter(p => p);
        
        // Expected structure: ["api", "workstreams", "versionTag", "create-from-goals"]
        if (pathParts.length < 4 || pathParts[0] !== "api" || pathParts[1] !== "workstreams" || pathParts[3] !== "create-from-goals") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid URL format" }));
          return;
        }
        
        const versionTag = pathParts[2];
        
        // Validate versionTag format
        if (!versionTag || !/^\d+-\d+$/.test(versionTag)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid version tag format. Expected format: major-minor (e.g., 0-15)" }));
          return;
        }

        const implementationModule = require("../../modules/implementation");
        const result = await implementationModule.actions["create-workstreams-from-goals"]({
          cwd: server.cwd,
          versionTag: versionTag
        }, {
          logger: server.logger || console
        });

        if (result.success) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            message: result.message,
            workstreamsCreated: result.workstreamsCreated,
            workstreams: result.workstreams,
            errors: result.errors
          }));
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            error: result.error || "Failed to create workstreams",
            workstreamsCreated: result.workstreamsCreated || 0,
            errors: result.errors
          }));
        }
      } catch (error) {
        server.logger?.error(`Failed to create workstreams from goals: ${error.message}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          success: false,
          error: error.message 
        }));
      }
    },

    /**
     * Set goals for a workstream (for sequence mode)
     * POST /api/workstreams/:versionTag/:workstreamId/goals
     */
    async handleSetWorkstreamGoals(req, res) {
      const urlParts = req.url.split("/");
      const versionTag = decodeURIComponent(urlParts[urlParts.length - 3]);
      const workstreamId = decodeURIComponent(urlParts[urlParts.length - 1]);
      
      if (!versionTag || !workstreamId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Version tag and workstream ID are required" }));
        return;
      }

      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const { goals } = data;

          if (!Array.isArray(goals)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Goals must be an array" }));
            return;
          }

          const result = await workstreamOps.setWorkstreamGoals(
            {
              cwd: server.cwd,
              versionTag,
              workstreamId,
              goals
            },
            { logger: server.logger || console }
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          server.logger?.error(`Failed to set workstream goals: ${error.message}`);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ 
            success: false,
            error: error.message 
          }));
        }
      });
    }
  };
}

module.exports = createWorkstreamRoutes;


