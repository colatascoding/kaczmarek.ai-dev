/**
 * Version route handlers
 */

const { loadConfig } = require("../../../bin/utils");
const versionOps = require("../../versions/file-operations");
const stageOps = require("../../versions/stage-management");
const reviewModule = require("../../modules/review");
const fileOpsV2 = require("../../modules/review/file-operations-v2");

/**
 * Create version routes handler
 */
function createVersionRoutes(server) {
  return {
    /**
     * List versions
     */
    async handleListVersions(req, res) {
      try {
        const config = loadConfig(server.cwd);
        const versionsDir = config?.docs?.versionsDir || "versions";
        
        // Find all version folders
        const versions = [];
        const versionsPath = require("path").join(server.cwd, versionsDir);
        
        if (require("fs").existsSync(versionsPath)) {
          const fs = require("fs");
          const path = require("path");
          
          // Iterate through major version folders (v0, v1, etc.)
          const majorDirs = fs.readdirSync(versionsPath, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && entry.name.startsWith("v"));
          
          for (const majorDir of majorDirs) {
            const majorPath = path.join(versionsPath, majorDir.name);
            const versionDirs = fs.readdirSync(majorPath, { withFileTypes: true })
              .filter(entry => entry.isDirectory() && entry.name.match(/^\d+-\d+$/));
            
            for (const versionDir of versionDirs) {
              const versionTag = versionDir.name;
              const versionPath = path.join(majorPath, versionTag);
              
              // Read version metadata
              const metadata = versionOps.readVersionMetadata(versionTag, server.cwd, versionsDir);
              const stages = stageOps.getVersionStages(versionTag, server.cwd, versionsDir);
              
              versions.push({
                tag: versionTag,
                major: parseInt(versionTag.split("-")[0]),
                minor: parseInt(versionTag.split("-")[1]),
                status: metadata?.status || "unknown",
                description: metadata?.description || "",
                started: metadata?.started || null,
                stages: stages,
                metadata: metadata || {}
              });
            }
          }
        }
        
        // Sort by version (newest first)
        versions.sort((a, b) => {
          if (a.major !== b.major) return b.major - a.major;
          return b.minor - a.minor;
        });
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ versions }));
      } catch (error) {
        console.error("Failed to list versions:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
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
          const { major, minor, type, goals } = data;

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
          
          // Create initial stage files
          const fs = require("fs");
          const path = require("path");
          
          // Create plan stage with goals
          const planPath = versionOps.getStagePath(versionTag, "01_plan", server.cwd, versionsDir);
          if (planPath) {
            const goalsPath = path.join(planPath, "goals.md");
            const goalsContent = `# Version ${versionTag} Goals\n\n${(goals || []).map(g => `- [ ] ${g}`).join("\n")}\n`;
            fs.writeFileSync(goalsPath, goalsContent, "utf8");
            
            // Set plan stage status
            stageOps.setStageStatus(versionTag, "01_plan", "completed", server.cwd, versionsDir);
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
            }
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
