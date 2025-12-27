/**
 * Version route handlers (Updated for new structure)
 */

const path = require("path");
const fs = require("fs");
const { loadConfig } = require("../../../bin/utils");
const versionOps = require("../../versions/file-operations");
const stageOps = require("../../versions/stage-management");
const {
  generateStageSummary,
  calculateStageProgress,
  generateSummaryText
} = require("./versions-stage-summaries");

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

      // Pre-compile regex patterns for better performance
      const MAJOR_VERSION_PATTERN = /^v(\d+)$/;
      const VERSION_TAG_PATTERN = /^(\d+)-(\d+)$/;
      
      // Find all major version directories
      const majorDirs = fs.readdirSync(versionsPath, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name.startsWith("v"))
        .map(entry => {
          const majorMatch = entry.name.match(MAJOR_VERSION_PATTERN);
          if (!majorMatch) return null;
          return {
            major: parseInt(majorMatch[1], 10),
            path: path.join(versionsPath, entry.name)
          };
        })
        .filter(v => v !== null)
        .sort((a, b) => b.major - a.major);

      // Collect all versions - optimized to reduce file system calls
      const allVersions = [];
      for (const majorDir of majorDirs) {
        const versionDirs = fs.readdirSync(majorDir.path, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && VERSION_TAG_PATTERN.test(entry.name))
          .map(entry => {
            const match = entry.name.match(VERSION_TAG_PATTERN);
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
        
        // Optimize: Check file existence once and cache results
        const reviewFileExists = fs.existsSync(reviewFile);
        const progressFileExists = fs.existsSync(progressFile);
        const goalsFileExists = fs.existsSync(goalsFile);
        
        // Read version metadata
        const metadata = versionOps.readVersionMetadata(versionTag, server.cwd, versionsDir) || {};
        const stages = stageOps.getVersionStages(versionTag, server.cwd, versionsDir);
        
        // Extract information from review file
        let summary = "";
        let status = metadata.status || "Unknown";
        let started = metadata.started || null;
        let completed = metadata.completed || null;
        let nextStepsCount = 0;
        let completedStepsCount = 0;
        
        if (reviewFileExists) {
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
        
        // Check for planning agent status
        let planningAgent = null;
        try {
          const queueDir = path.join(server.cwd, ".kaczmarek-ai", "agent-queue");
          if (fs.existsSync(queueDir)) {
            // Optimize: Use withFileTypes to avoid stat calls
            const taskFiles = fs.readdirSync(queueDir, { withFileTypes: true })
              .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
              .map(entry => {
                try {
                  const content = fs.readFileSync(path.join(queueDir, entry.name), "utf8");
                  return JSON.parse(content);
                } catch (e) {
                  return null;
                }
              })
              .filter(t => t && t.versionTag === versionTag && t.taskType === "planning");
            
            if (taskFiles.length > 0) {
              planningAgent = {
                id: taskFiles[0].id,
                status: taskFiles[0].status || "unknown",
                cloudAgentId: taskFiles[0].cloudAgentId
              };
            }
          }
        } catch (e) {
          // Ignore errors when checking for planning agent
        }
        
        versions.push({
          tag: versionTag,
          versionTag,
          versionPath,
          reviewFile: reviewFileExists ? reviewFile : null,
          progressFile: progressFileExists ? progressFile : null,
          goalsFile: goalsFileExists ? goalsFile : null,
          hasReview: reviewFileExists,
          hasProgress: progressFileExists,
          hasGoals: goalsFileExists,
          summary: summary.substring(0, 200) + (summary.length > 200 ? "..." : ""),
          status,
          started,
          completed,
          nextStepsCount,
          completedStepsCount,
          stages,
          metadata,
          planningAgent
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ versions }));
    },

    /**
     * Get planning agent status for a version
     */
    async handleGetPlanningAgentStatus(req, res) {
      try {
        const urlParts = req.url.split("/").filter(p => p);
        // URL format: /api/versions/0-5/planning-agent-status
        // urlParts: ["api", "versions", "0-5", "planning-agent-status"]
        const versionTag = urlParts[urlParts.length - 2];
        
        const config = loadConfig(server.cwd);
        const versionsDir = config?.docs?.versionsDir || "versions";
        
        // Find planning agent task for this version
        const queueDir = path.join(server.cwd, ".kaczmarek-ai", "agent-queue");
        if (!fs.existsSync(queueDir)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ 
            hasAgent: false,
            agent: null
          }));
          return;
        }
        
        // Find agent task with matching versionTag
        // Look for tasks that are either:
        // 1. Explicitly marked with taskType="planning" and matching versionTag
        // 2. Cloud agents with matching versionTag (even if taskType is missing)
        // 3. Cloud agents where the prompt contains "plan" or "version" and matches versionTag
        // Optimize: Use withFileTypes to avoid stat calls
        const taskFiles = fs.readdirSync(queueDir, { withFileTypes: true })
          .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
          .map(entry => {
            try {
              const content = fs.readFileSync(path.join(queueDir, entry.name), "utf8");
              return JSON.parse(content);
            } catch (e) {
              return null;
            }
          })
          .filter(t => {
            if (!t) return false;
            
            // Exact match: taskType="planning" and versionTag matches
            if (t.taskType === "planning" && t.versionTag === versionTag) {
              return true;
            }
            
            // Cloud agent with matching versionTag (even if taskType is missing)
            if (t.type === "cursor-cloud" && t.versionTag === versionTag) {
              return true;
            }
            
            // Cloud agent where prompt suggests it's a planning agent
            if (t.type === "cursor-cloud" && t.prompt) {
              const promptLower = t.prompt.toLowerCase();
              const isPlanningPrompt = promptLower.includes("plan") || 
                                       promptLower.includes("generate a comprehensive plan") ||
                                       promptLower.includes("goals.md");
              if (isPlanningPrompt && (t.versionTag === versionTag || promptLower.includes(`version ${versionTag}`))) {
                return true;
              }
            }
            
            return false;
          });
        
        if (taskFiles.length === 0) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ 
            hasAgent: false,
            agent: null
          }));
          return;
        }
        
        const task = taskFiles[0];
        
        // If it's a Cloud Agent, check status via API
        let agentStatus = {
          id: task.id,
          status: task.status || "unknown",
          type: task.type,
          cloudAgentId: task.cloudAgentId,
          executionId: task.executionId,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          error: task.error,
          lastSynced: task.lastStatusCheck || task.lastSynced || null,
          syncHistory: task.syncHistory || []
        };
        
        if (task.type === "cursor-cloud" && task.cloudAgentId && process.env.CURSOR_API_KEY) {
          try {
            const cursorCloudAgent = require("../../modules/cursor-cloud-agent");
            const statusResult = await cursorCloudAgent.actions["get-status"]({
              agentId: task.cloudAgentId
            }, {
              logger: {
                info: () => {},
                error: () => {},
                warn: () => {}
              }
            });
            
            const syncTime = new Date().toISOString();
            const previousStatus = task.status;
            const newStatus = statusResult.status;
            
            // Update task file with latest status
            task.status = newStatus;
            task.cloudStatus = statusResult.data;
            task.lastStatusCheck = syncTime;
            task.lastSynced = syncTime;
            
            // Add to sync history (keep last 20 entries)
            if (!task.syncHistory) {
              task.syncHistory = [];
            }
            task.syncHistory.push({
              timestamp: syncTime,
              status: newStatus,
              previousStatus: previousStatus,
              changed: previousStatus !== newStatus,
              cloudStatus: statusResult.data,
              success: true
            });
            
            // Keep only last 20 sync entries
            if (task.syncHistory.length > 20) {
              task.syncHistory = task.syncHistory.slice(-20);
            }
            
            if (statusResult.status === "completed" || statusResult.status === "failed") {
              task.completedAt = new Date().toISOString();
              if (statusResult.status === "failed") {
                task.error = statusResult.data?.error || "Agent failed";
              }
              
              // Auto-merge if enabled and not already attempted
              if (statusResult.status === "completed" && task.autoMerge === true && !task.mergeAttempted) {
                try {
                  const AgentProcessor = require("../../agent/processor");
                  const processor = new AgentProcessor({ cwd: server.cwd });
                  await processor.handleAutoMerge(task, path.join(queueDir, `${task.id}.json`));
                } catch (mergeError) {
                  console.error("Failed to auto-merge:", mergeError);
                }
              }
            }
            
            fs.writeFileSync(path.join(queueDir, `${task.id}.json`), JSON.stringify(task, null, 2));
            
            agentStatus.status = statusResult.status;
            agentStatus.cloudStatus = statusResult.data;
            agentStatus.completedAt = task.completedAt;
            agentStatus.error = task.error;
            agentStatus.lastSynced = syncTime;
            agentStatus.syncHistory = task.syncHistory;
          } catch (error) {
            console.error("Failed to get Cloud Agent status:", error);
            
            // Record failed sync in history
            const syncTime = new Date().toISOString();
            if (!task.syncHistory) {
              task.syncHistory = [];
            }
            task.syncHistory.push({
              timestamp: syncTime,
              status: task.status,
              previousStatus: task.status,
              changed: false,
              error: error.message,
              success: false
            });
            
            // Keep only last 20 sync entries
            if (task.syncHistory.length > 20) {
              task.syncHistory = task.syncHistory.slice(-20);
            }
            
            task.lastStatusCheck = syncTime;
            task.lastSynced = syncTime;
            fs.writeFileSync(path.join(queueDir, `${task.id}.json`), JSON.stringify(task, null, 2));
            
            // Use cached status but include sync failure info
            agentStatus.lastSynced = syncTime;
            agentStatus.syncHistory = task.syncHistory;
            agentStatus.lastSyncError = error.message;
          }
        }
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          hasAgent: true,
          agent: agentStatus
        }));
      } catch (error) {
        console.error("Failed to get planning agent status:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    },

    /**
     * Get version stage summary
     */
    async handleGetStageSummary(req, res) {
      // Parse URL: /api/versions/:versionTag/:stage/summary
      // Example: /api/versions/0-3/plan/summary
      const urlParts = req.url.split("/").filter(p => p);
      // Find index of "versions" and "summary"
      const versionsIndex = urlParts.indexOf("versions");
      if (versionsIndex === -1 || versionsIndex + 1 >= urlParts.length) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid URL format" }));
        return;
      }
      const versionTag = urlParts[versionsIndex + 1];
      const summaryIndex = urlParts.indexOf("summary");
      if (summaryIndex === -1 || summaryIndex - 1 <= versionsIndex) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid URL format" }));
        return;
      }
      const stage = urlParts[summaryIndex - 1];
      const config = loadConfig(server.cwd);
      const versionsDir = config?.docs?.versionsDir || "versions";
      
      const versionPath = versionOps.findVersionFolder(versionTag, server.cwd, versionsDir);
      if (!versionPath) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Version not found" }));
        return;
      }
      
      // Map stage names
      const stageMap = {
        plan: "01_plan",
        implement: "02_implement",
        test: "03_test",
        review: "04_review"
      };
      
      const stageFolder = stageMap[stage] || stage;
      const stagePath = versionOps.getStagePath(versionTag, stageFolder, server.cwd, versionsDir);
      
      if (!stagePath) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Stage not found" }));
        return;
      }
      
      const summary = await generateStageSummary(versionTag, stage, stagePath, server.cwd, versionsDir);
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ versionTag, stage, summary }));
    },

    /**
     * Save goals to plan stage
     * POST /api/versions/:versionTag/plan/goals
     */
    async handleSavePlanGoals(req, res) {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      
      req.on("end", async () => {
        try {
          const urlParts = req.url.split("/").filter(p => p);
          const versionsIndex = urlParts.indexOf("versions");
          if (versionsIndex === -1 || versionsIndex + 1 >= urlParts.length) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid URL format" }));
            return;
          }
          const versionTag = urlParts[versionsIndex + 1];
          
          const data = JSON.parse(body || "{}");
          const goals = data.goals || [];
          
          const config = loadConfig(server.cwd);
          const versionsDir = config?.docs?.versionsDir || "versions";
          
          const stagePath = versionOps.getStagePath(versionTag, "01_plan", server.cwd, versionsDir);
          if (!stagePath) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Plan stage not found" }));
            return;
          }
          
          const goalsFile = path.join(stagePath, "goals.md");
          const goalsContent = `# Version ${versionTag} Goals\n\n${goals.map(g => `- [ ] ${g}`).join("\n")}\n`;
          fs.writeFileSync(goalsFile, goalsContent, "utf8");
          
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: "Goals saved" }));
        } catch (error) {
          console.error("Failed to save goals:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },

    /**
     * Update stage status
     * PUT /api/versions/:versionTag/:stage/status
     */
    async handleUpdateStageStatus(req, res) {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      
      req.on("end", async () => {
        try {
          const urlParts = req.url.split("/").filter(p => p);
          const versionsIndex = urlParts.indexOf("versions");
          const statusIndex = urlParts.indexOf("status");
          
          if (versionsIndex === -1 || statusIndex === -1 || versionsIndex + 1 >= urlParts.length || statusIndex - 1 <= versionsIndex) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid URL format" }));
            return;
          }
          
          const versionTag = urlParts[versionsIndex + 1];
          const stage = urlParts[statusIndex - 1];
          
          const data = JSON.parse(body || "{}");
          const status = data.status || "in-progress";
          
          const config = loadConfig(server.cwd);
          const versionsDir = config?.docs?.versionsDir || "versions";
          
          const stageMap = {
            plan: "01_plan",
            implement: "02_implement",
            test: "03_test",
            review: "04_review"
          };
          
          const stageFolder = stageMap[stage] || stage;
          stageOps.setStageStatus(versionTag, stageFolder, status, server.cwd, versionsDir);
          
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: `Stage ${stage} status updated to ${status}` }));
        } catch (error) {
          console.error("Failed to update stage status:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },

    /**
     * Get suggested next version
     */
    async handleGetNextVersion(req, res) {
      try {
        const config = loadConfig(server.cwd);
        const versionsDir = config?.docs?.versionsDir || "versions";
        const versionsPath = path.join(server.cwd, versionsDir);
        
        if (!fs.existsSync(versionsPath)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ 
            suggested: { major: 0, minor: 0 },
            currentVersion: null,
            canCreate: true
          }));
          return;
        }

        // Find current version
        const fileOpsV2 = require("../../modules/review/file-operations-v2");
        const currentVersion = await fileOpsV2.findCurrentVersion(
          { cwd: server.cwd, versionsDir },
          { logger: { info: () => {}, error: () => {} } }
        );

        let suggestedMajor = 0;
        let suggestedMinor = 0;
        let canCreate = true;
        let currentVersionTag = null;
        let currentStatus = null;

        if (currentVersion.found) {
          currentVersionTag = currentVersion.versionTag;
          const metadata = versionOps.readVersionMetadata(currentVersionTag, server.cwd, versionsDir) || {};
          currentStatus = metadata.status || "in-progress";
          
          // Only allow creating new version if current is completed or rejected
          canCreate = currentStatus === "completed" || currentStatus === "rejected";
          
          // Suggest next version
          if (currentStatus === "completed" && metadata.type === "major") {
            suggestedMajor = currentVersion.major + 1;
            suggestedMinor = 0;
          } else {
            suggestedMajor = currentVersion.major;
            suggestedMinor = currentVersion.minor + 1;
          }
        } else {
          // No current version, suggest 0-0
          suggestedMajor = 0;
          suggestedMinor = 0;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          suggested: { major: suggestedMajor, minor: suggestedMinor },
          currentVersion: currentVersionTag,
          canCreate,
          reason: canCreate ? null : `Current version ${currentVersionTag} is ${currentStatus || "in-progress"}. Complete or reject it first.`
        }));
      } catch (error) {
        console.error("Failed to get next version:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    },

    /**
     * Reject version
     */
    async handleRejectVersion(req, res) {
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const urlParts = req.url.split("/");
          // URL is /api/versions/:versionTag/reject, so versionTag is second to last
          const versionTag = urlParts[urlParts.length - 2];
          const data = body ? JSON.parse(body) : {};
          const { reason } = data;

          const config = loadConfig(server.cwd);
          const versionsDir = config?.docs?.versionsDir || "versions";
          
          const versionPath = versionOps.findVersionFolder(versionTag, server.cwd, versionsDir);
          if (!versionPath) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Version ${versionTag} not found` }));
            return;
          }

          // Read current metadata
          const metadata = versionOps.readVersionMetadata(versionTag, server.cwd, versionsDir) || {};
          
          // Update status to rejected
          metadata.status = "rejected";
          metadata.rejected = new Date().toISOString().split("T")[0];
          if (reason) {
            metadata.rejectionReason = reason;
          }
          
          // Mark all stages as rejected
          if (metadata.stages) {
            Object.keys(metadata.stages).forEach(stageKey => {
              if (metadata.stages[stageKey].status !== "completed") {
                metadata.stages[stageKey].status = "rejected";
              }
            });
          }
          
          versionOps.writeVersionMetadata(versionTag, metadata, server.cwd, versionsDir);
          
          // Update review file
          const reviewPath = path.join(versionPath, "04_review", "review.md");
          if (fs.existsSync(reviewPath)) {
            let reviewContent = fs.readFileSync(reviewPath, "utf8");
            reviewContent = reviewContent.replace(/\*\*Status\*\*:\s*.+/, `**Status**: Rejected`);
            if (reason) {
              reviewContent += `\n\n## Rejection Reason\n\n${reason}\n`;
            }
            fs.writeFileSync(reviewPath, reviewContent, "utf8");
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            version: {
              tag: versionTag,
              ...metadata
            }
          }));
        } catch (error) {
          console.error("Failed to reject version:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },

    /**
     * Create new version
     */
    async handleCreateVersion(req, res) {
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const { major, minor, type, goals, launchPlanningAgent = false } = data;

          if (major === undefined || minor === undefined) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Major and minor version numbers are required" }));
            return;
          }

          const versionTag = `${major}-${minor}`;
          const config = loadConfig(server.cwd);
          const versionsDir = config?.docs?.versionsDir || "versions";
          
          // Check if version already exists
          const existingVersion = versionOps.findVersionFolder(versionTag, server.cwd, versionsDir);
          if (existingVersion) {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Version ${versionTag} already exists` }));
            return;
          }

          // Check if we can create a new version (current must be completed or rejected)
          const fileOpsV2 = require("../../modules/review/file-operations-v2");
          const currentVersion = await fileOpsV2.findCurrentVersion(
            { cwd: server.cwd, versionsDir },
            { logger: { info: () => {}, error: () => {} } }
          );

          let currentVersionTag = null;
          if (currentVersion.found) {
            currentVersionTag = currentVersion.versionTag;
            const currentMetadata = versionOps.readVersionMetadata(currentVersionTag, server.cwd, versionsDir) || {};
            const status = currentMetadata.status || "in-progress";
            
            if (status !== "completed" && status !== "rejected") {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ 
                error: `Cannot create new version. Current version ${currentVersionTag} is ${status}. Complete or reject it first.` 
              }));
              return;
            }
          }

          // Create version folder structure
          const versionPath = versionOps.createVersionFolder(versionTag, server.cwd, versionsDir);
          
          // Create version metadata
          const metadata = {
            version: versionTag,
            type: type || "minor",
            status: "in-progress",
            started: new Date().toISOString().split("T")[0],
            description: "",
            goals: goals || []
          };
          
          versionOps.writeVersionMetadata(versionTag, metadata, server.cwd, versionsDir);
          
          // Launch planning agent if requested
          let agentTaskId = null;
          if (launchPlanningAgent) {
            try {
              const implementationModule = require("../../modules/implementation");
              const agentResult = await implementationModule.actions["launch-planning-agent"]({
                versionTag,
                currentVersionTag,
                cwd: server.cwd,
                agentType: "cursor"
              }, {
                logger: {
                  info: (msg) => console.log(`[Planning Agent] ${msg}`),
                  error: (msg) => console.error(`[Planning Agent] ${msg}`),
                  warn: (msg) => console.warn(`[Planning Agent] ${msg}`)
                }
              });
              
              if (agentResult.success) {
                agentTaskId = agentResult.agentTaskId;
              }
            } catch (agentError) {
              console.error("Failed to launch planning agent:", agentError);
              // Don't fail version creation if agent launch fails
            }
          }
          
          // Create initial stage files
          // Create plan stage with goals
          const planPath = versionOps.getStagePath(versionTag, "01_plan", server.cwd, versionsDir);
          if (planPath) {
            const goalsPath = path.join(planPath, "goals.md");
            if (launchPlanningAgent) {
              // If using AI, create placeholder goals file - agent will update it
              const goalsContent = `# Version ${versionTag} Goals\n\n## Primary Objectives\n\n*Planning agent is generating goals...*\n\n## Success Criteria\n\n*To be defined by planning agent*\n`;
              fs.writeFileSync(goalsPath, goalsContent, "utf8");
              // Keep plan stage as in-progress until agent completes
              stageOps.setStageStatus(versionTag, "01_plan", "in-progress", server.cwd, versionsDir);
            } else {
              // Manual entry - mark as completed if goals provided
              const goalsContent = `# Version ${versionTag} Goals\n\n${(goals || []).map(g => `- [ ] ${g}`).join("\n")}\n`;
              fs.writeFileSync(goalsPath, goalsContent, "utf8");
              // Set plan stage status based on whether goals were provided
              if (goals && goals.length > 0) {
                stageOps.setStageStatus(versionTag, "01_plan", "completed", server.cwd, versionsDir);
              } else {
                stageOps.setStageStatus(versionTag, "01_plan", "in-progress", server.cwd, versionsDir);
              }
            }
          }
          
          // Create implement stage
          const implementPath = versionOps.getStagePath(versionTag, "02_implement", server.cwd, versionsDir);
          if (implementPath) {
            const progressPath = path.join(implementPath, "progress.md");
            const progressContent = `# Progress Log - Version ${versionTag}\n\n## ${metadata.started}\n\n**Version Started**\n\nStarting version ${versionTag}.\n`;
            fs.writeFileSync(progressPath, progressContent, "utf8");
            
            // Set implement stage status
            stageOps.setStageStatus(versionTag, "02_implement", "in-progress", server.cwd, versionsDir);
          }
          
          // Create test stage
          const testPath = versionOps.getStagePath(versionTag, "03_test", server.cwd, versionsDir);
          if (testPath) {
            const testPlanPath = path.join(testPath, "test-plan.md");
            const testPlanContent = `# Test Plan - Version ${versionTag}\n\n## Test Cases\n\n(To be filled)\n`;
            fs.writeFileSync(testPlanPath, testPlanContent, "utf8");
          }
          
          // Create review stage
          const reviewPath = versionOps.getStagePath(versionTag, "04_review", server.cwd, versionsDir);
          if (reviewPath) {
            const reviewPathFile = path.join(reviewPath, "review.md");
            const reviewContent = `# Version ${versionTag}\n\n**Status**: In Progress\n**Started**: ${metadata.started}\n\n## Summary\n\n(To be filled)\n`;
            fs.writeFileSync(reviewPathFile, reviewContent, "utf8");
          }
          
          // Create README
          const readmePath = path.join(versionPath, "README.md");
          const readmeContent = `# Version ${versionTag}\n\n**Status**: ${metadata.status}\n**Started**: ${metadata.started}\n**Type**: ${metadata.type}\n\n## Quick Links\n\n- [Planning](./01_plan/goals.md)\n- [Implementation](./02_implement/progress.md)\n- [Testing](./03_test/test-plan.md)\n- [Review](./04_review/review.md)\n\n## Goals\n\n${(goals || []).map(g => `- [ ] ${g}`).join("\n")}\n`;
          fs.writeFileSync(readmePath, readmeContent, "utf8");
          
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            version: {
              tag: versionTag,
              ...metadata,
              stages: stageOps.getVersionStages(versionTag, server.cwd, versionsDir)
            },
            agentTaskId: agentTaskId || null
          }));
        } catch (error) {
          console.error("Failed to create version:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  };
}

module.exports = createVersionRoutes;
