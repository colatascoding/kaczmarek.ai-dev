/**
 * Version route handlers (Updated for new structure)
 */

const path = require("path");
const fs = require("fs");
const { loadConfig } = require("../../bin/utils");
const versionOps = require("../../versions/file-operations");
const stageOps = require("../../versions/stage-management");

/**
 * Create version routes handler
 */
function createVersionRoutes(server) {
  return {
    /**
     * List versions (from new version folder structure)
     */
    async handleListVersions(req, res) {
      const config = loadConfig(server.cwd);
      const versionsDir = config?.docs?.versionsDir || "versions";
      const versionsPath = path.join(server.cwd, versionsDir);
      const versions = [];

      if (!fs.existsSync(versionsPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ versions: [] }));
        return;
      }

      // Find all major version directories
      const majorDirs = fs.readdirSync(versionsPath, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name.startsWith("v"))
        .map(entry => {
          const majorMatch = entry.name.match(/^v(\d+)$/);
          if (!majorMatch) return null;
          return {
            major: parseInt(majorMatch[1], 10),
            path: path.join(versionsPath, entry.name)
          };
        })
        .filter(v => v !== null)
        .sort((a, b) => b.major - a.major);

      // Collect all versions
      const allVersions = [];
      for (const majorDir of majorDirs) {
        const versionDirs = fs.readdirSync(majorDir.path, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && entry.name.match(/^\d+-\d+$/))
          .map(entry => {
            const match = entry.name.match(/^(\d+)-(\d+)$/);
            if (!match) return null;
            return {
              major: parseInt(match[1], 10),
              minor: parseInt(match[2], 10),
              tag: `${match[1]}-${match[2]}`,
              path: path.join(majorDir.path, entry.name)
            };
          })
          .filter(v => v !== null);
        
        allVersions.push(...versionDirs);
      }

      // Sort by version (latest first)
      allVersions.sort((a, b) => {
        if (a.major !== b.major) return b.major - a.major;
        return b.minor - a.minor;
      });

      // Process each version
      for (const version of allVersions) {
        const versionTag = version.tag;
        const versionPath = version.path;
        const reviewFile = path.join(versionPath, "04_review", "review.md");
        const progressFile = path.join(versionPath, "02_implement", "progress.md");
        const goalsFile = path.join(versionPath, "01_plan", "goals.md");
        
        // Read version metadata
        const metadata = versionOps.readVersionMetadata(versionTag, server.cwd, versionsDir) || {};
        const stages = stageOps.getVersionStages(versionTag, server.cwd, versionsDir);
        
        // Get workflows for this version
        let workflows = [];
        try {
          const allWorkflows = server.db.listWorkflows();
          workflows = allWorkflows
            .filter(w => w.version_tag === `version${versionTag}`)
            .map(w => ({
              id: w.id,
              name: w.name,
              version: w.version
            }));
        } catch (e) {
          workflows = [];
        }
        
        // Get executions for this version
        const executions = server.db.listExecutions(null, null, `version${versionTag}`) || [];
        
        // Get agents for this version
        const agents = [];
        const queueDir = path.join(server.cwd, ".kaczmarek-ai", "agent-queue");
        if (fs.existsSync(queueDir)) {
          const files = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
          for (const file of files) {
            try {
              const task = JSON.parse(fs.readFileSync(path.join(queueDir, file), "utf8"));
              if (task.versionTag === `version${versionTag}`) {
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
        
        // Extract information from review file
        let summary = "";
        let status = metadata.status || "Unknown";
        let started = metadata.started || null;
        let completed = metadata.completed || null;
        let nextStepsCount = 0;
        let completedStepsCount = 0;
        
        if (fs.existsSync(reviewFile)) {
          const content = fs.readFileSync(reviewFile, "utf8");
          
          // Extract summary (first paragraph after "## Summary")
          const summaryMatch = content.match(/## Summary\s*\n\n(.+?)(?:\n\n|##)/s);
          if (summaryMatch) {
            summary = summaryMatch[1].trim();
          }
          
          // Extract status from file if not in metadata
          if (!metadata.status) {
            const statusMatch = content.match(/\*\*Status\*\*:\s*(.+?)(?:\n|$)/);
            if (statusMatch) {
              status = statusMatch[1].trim();
            }
          }
          
          // Extract started date from file if not in metadata
          if (!metadata.started) {
            const startedMatch = content.match(/\*\*Started\*\*:\s*(\d{4}-\d{2}-\d{2})/);
            if (startedMatch) {
              started = startedMatch[1];
            }
          }
          
          // Extract completed date from file if not in metadata
          if (!metadata.completed) {
            const completedMatch = content.match(/\*\*Completed\*\*:\s*(\d{4}-\d{2}-\d{2})/);
            if (completedMatch) {
              completed = completedMatch[1];
            }
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
          tag: `version${versionTag}`,
          versionTag,
          versionPath,
          reviewFile: fs.existsSync(reviewFile) ? reviewFile : null,
          progressFile: fs.existsSync(progressFile) ? progressFile : null,
          goalsFile: fs.existsSync(goalsFile) ? goalsFile : null,
          hasReview: fs.existsSync(reviewFile),
          hasProgress: fs.existsSync(progressFile),
          hasGoals: fs.existsSync(goalsFile),
          summary: summary.substring(0, 200) + (summary.length > 200 ? "..." : ""),
          status,
          started,
          completed,
          nextStepsCount,
          completedStepsCount,
          stages,
          metadata,
          workflows: workflows || [],
          workflowCount: workflows.length,
          executions: executions || [],
          executionCount: executions.length,
          agents: agents || [],
          agentCount: agents.length
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ versions }));
    },

    /**
     * Get version details
     */
    async handleGetVersion(req, res) {
      const urlParts = req.url.split("/");
      const versionTag = urlParts[urlParts.length - 1].replace("version", "");
      const config = loadConfig(server.cwd);
      const versionsDir = config?.docs?.versionsDir || "versions";
      
      const versionPath = versionOps.findVersionFolder(versionTag, server.cwd, versionsDir);
      if (!versionPath) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Version not found" }));
        return;
      }

      const metadata = versionOps.readVersionMetadata(versionTag, server.cwd, versionsDir);
      const stages = stageOps.getVersionStages(versionTag, server.cwd, versionsDir);
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        versionTag,
        versionPath,
        metadata,
        stages
      }));
    },

    /**
     * Get version stages
     */
    async handleGetVersionStages(req, res) {
      const urlParts = req.url.split("/");
      const versionTag = urlParts[urlParts.length - 2].replace("version", "");
      const config = loadConfig(server.cwd);
      const versionsDir = config?.docs?.versionsDir || "versions";
      
      const stages = stageOps.getVersionStages(versionTag, server.cwd, versionsDir);
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ versionTag, stages }));
    },

    /**
     * Get version stage details
     */
    async handleGetVersionStage(req, res) {
      const urlParts = req.url.split("/");
      const versionTag = urlParts[urlParts.length - 3].replace("version", "");
      const stage = urlParts[urlParts.length - 1];
      const config = loadConfig(server.cwd);
      const versionsDir = config?.docs?.versionsDir || "versions";
      
      const stagePath = versionOps.getStagePath(versionTag, stage, server.cwd, versionsDir);
      if (!stagePath) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Stage not found" }));
        return;
      }

      const stageStatus = stageOps.getStageStatus(versionTag, stage, server.cwd, versionsDir);
      const validation = stageOps.validateStage(versionTag, stage, server.cwd, versionsDir);
      const files = fs.readdirSync(stagePath).filter(f => f !== ".status");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        versionTag,
        stage,
        stagePath,
        status: stageStatus,
        validation,
        files
      }));
    }
  };
}

module.exports = createVersionRoutes;
