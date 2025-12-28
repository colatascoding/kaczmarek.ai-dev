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
          metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
        } catch (e) {
          // Use defaults
        }
      }

      // Load progress
      const progressPath = path.join(workstreamPath, "progress.md");
      let progress = "";
      if (fs.existsSync(progressPath)) {
        progress = fs.readFileSync(progressPath, "utf8");
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
          const data = JSON.parse(body);
          const { versionTag, workstreamName, description } = data;

          if (!versionTag || !workstreamName) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Version tag and workstream name required" }));
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
          const data = body ? JSON.parse(body) : {};
          const versionTag = data.versionTag || req.url.split("/")[req.url.split("/").length - 2];

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
          
          const data = body ? JSON.parse(body) : {};
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
    }
  };
}

module.exports = createWorkstreamRoutes;


