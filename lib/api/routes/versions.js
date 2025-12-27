/**
 * Version route handlers (Updated for new structure)
 */

const path = require("path");
const fs = require("fs");
const { loadConfig } = require("../../../bin/utils");
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
          tag: versionTag,
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
          metadata
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ versions }));
    },

    /**
     * Get version stage summary
     */
    async handleGetStageSummary(req, res) {
      const urlParts = req.url.split("/");
      const versionTag = urlParts[urlParts.length - 2];
      const stage = urlParts[urlParts.length - 1];
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

        if (currentVersion.found) {
          currentVersionTag = currentVersion.versionTag;
          const metadata = versionOps.readVersionMetadata(currentVersionTag, server.cwd, versionsDir) || {};
          const status = metadata.status || "in-progress";
          
          // Only allow creating new version if current is completed or rejected
          canCreate = status === "completed" || status === "rejected";
          
          // Suggest next version
          if (status === "completed" && metadata.type === "major") {
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
          reason: canCreate ? null : `Current version ${currentVersionTag} is ${metadata.status || "in-progress"}. Complete or reject it first.`
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
          const versionTag = urlParts[urlParts.length - 1];
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

          // Check if we can create a new version (current must be completed or rejected)
          const fileOpsV2 = require("../../modules/review/file-operations-v2");
          const currentVersion = await fileOpsV2.findCurrentVersion(
            { cwd: server.cwd, versionsDir },
            { logger: { info: () => {}, error: () => {} } }
          );

          if (currentVersion.found) {
            const currentMetadata = versionOps.readVersionMetadata(currentVersion.versionTag, server.cwd, versionsDir) || {};
            const status = currentMetadata.status || "in-progress";
            
            if (status !== "completed" && status !== "rejected") {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ 
                error: `Cannot create new version. Current version ${currentVersion.versionTag} is ${status}. Complete or reject it first.` 
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
          
          // Create initial stage files
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

/**
 * Generate stage summary
 */
async function generateStageSummary(versionTag, stage, stagePath, cwd, versionsDir) {
  const summary = {
    stage,
    status: "unknown",
    progress: 0,
    summary: "",
    details: {}
  };
  
  try {
    // Get stage status
    const stageStatus = stageOps.getStageStatus(versionTag, path.basename(stagePath), cwd, versionsDir);
    summary.status = stageStatus || "pending";
    
    switch (stage) {
      case "plan":
        summary.details = await generatePlanSummary(stagePath);
        break;
      case "implement":
        summary.details = await generateImplementSummary(stagePath, versionTag, cwd, versionsDir);
        break;
      case "test":
        summary.details = await generateTestSummary(stagePath);
        break;
      case "review":
        summary.details = await generateReviewSummary(stagePath);
        break;
    }
    
    // Calculate overall progress
    summary.progress = calculateStageProgress(summary.details, stage);
    summary.summary = generateSummaryText(summary.details, stage);
  } catch (error) {
    console.error(`Failed to generate ${stage} summary:`, error);
    summary.summary = `Failed to load ${stage} summary: ${error.message}`;
  }
  
  return summary;
}

/**
 * Generate plan stage summary
 */
async function generatePlanSummary(stagePath) {
  const goalsFile = path.join(stagePath, "goals.md");
  const details = {
    goals: [],
    totalGoals: 0,
    completedGoals: 0
  };
  
  if (fs.existsSync(goalsFile)) {
    const content = fs.readFileSync(goalsFile, "utf8");
    const lines = content.split("\n");
    
    for (const line of lines) {
      const goalMatch = line.match(/^[-*]\s*\[([\sx])\]\s*(.+)$/);
      if (goalMatch) {
        const isCompleted = goalMatch[1] === "x";
        const goalText = goalMatch[2].trim();
        details.goals.push({
          text: goalText,
          completed: isCompleted
        });
        details.totalGoals++;
        if (isCompleted) details.completedGoals++;
      }
    }
  }
  
  return details;
}

/**
 * Generate implement stage summary
 */
async function generateImplementSummary(stagePath, versionTag, cwd, versionsDir) {
  const progressFile = path.join(stagePath, "progress.md");
  const workstreamsPath = path.join(stagePath, "workstreams");
  const details = {
    progressEntries: 0,
    workstreams: [],
    totalWorkstreams: 0,
    activeWorkstreams: 0,
    recentActivity: []
  };
  
  // Count progress entries
  if (fs.existsSync(progressFile)) {
    const content = fs.readFileSync(progressFile, "utf8");
    // Count date headers (## YYYY-MM-DD)
    const dateHeaders = content.match(/^## \d{4}-\d{2}-\d{2}/gm) || [];
    details.progressEntries = dateHeaders.length;
    
    // Get recent entries (last 3)
    const sections = content.split(/^## \d{4}-\d{2}-\d{2}/m);
    details.recentActivity = sections.slice(-4).slice(0, 3).map(section => {
      const lines = section.trim().split("\n").slice(0, 3);
      return lines.join(" ").substring(0, 100);
    }).filter(Boolean);
  }
  
  // Count workstreams
  if (fs.existsSync(workstreamsPath)) {
    const entries = fs.readdirSync(workstreamsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const workstreamPath = path.join(workstreamsPath, entry.name);
        const metadataPath = path.join(workstreamPath, "workstream.json");
        
        let metadata = { status: "active" };
        if (fs.existsSync(metadataPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
          } catch (e) {
            // Use defaults
          }
        }
        
        details.workstreams.push({
          id: entry.name,
          name: metadata.name || entry.name,
          status: metadata.status || "active"
        });
        details.totalWorkstreams++;
        if (metadata.status === "active") details.activeWorkstreams++;
      }
    }
  }
  
  return details;
}

/**
 * Generate test stage summary
 */
async function generateTestSummary(stagePath) {
  const testPlanFile = path.join(stagePath, "test-plan.md");
  const details = {
    testCases: [],
    totalTests: 0,
    passedTests: 0,
    failedTests: 0
  };
  
  if (fs.existsSync(testPlanFile)) {
    const content = fs.readFileSync(testPlanFile, "utf8");
    const lines = content.split("\n");
    
    for (const line of lines) {
      const testMatch = line.match(/^[-*]\s*\[([\sx])\]\s*(.+)$/);
      if (testMatch) {
        const isPassed = testMatch[1] === "x";
        const testText = testMatch[2].trim();
        details.testCases.push({
          text: testText,
          passed: isPassed
        });
        details.totalTests++;
        if (isPassed) details.passedTests++;
        else details.failedTests++;
      }
    }
  }
  
  return details;
}

/**
 * Generate review stage summary
 */
async function generateReviewSummary(stagePath) {
  const reviewFile = path.join(stagePath, "review.md");
  const details = {
    status: "unknown",
    summary: "",
    nextSteps: [],
    totalNextSteps: 0,
    completedNextSteps: 0
  };
  
  if (fs.existsSync(reviewFile)) {
    const content = fs.readFileSync(reviewFile, "utf8");
    
    // Extract status
    const statusMatch = content.match(/\*\*Status\*\*:\s*(.+?)(?:\n|$)/);
    if (statusMatch) {
      details.status = statusMatch[1].trim();
    }
    
    // Extract summary
    const summaryMatch = content.match(/## Summary\s*\n\n(.+?)(?:\n\n|##)/s);
    if (summaryMatch) {
      details.summary = summaryMatch[1].trim();
    }
    
    // Extract next steps
    const nextStepsMatch = content.match(/## Next Steps\s*\n([\s\S]*?)(?=\n##|\n*$)/);
    if (nextStepsMatch) {
      const nextStepsContent = nextStepsMatch[1];
      const lines = nextStepsContent.split("\n");
      
      for (const line of lines) {
        const stepMatch = line.match(/^[-*]\s*\[([\sx])\]\s*(.+)$/);
        if (stepMatch) {
          const isCompleted = stepMatch[1] === "x";
          const stepText = stepMatch[2].trim();
          details.nextSteps.push({
            text: stepText,
            completed: isCompleted
          });
          details.totalNextSteps++;
          if (isCompleted) details.completedNextSteps++;
        }
      }
    }
  }
  
  return details;
}

/**
 * Calculate stage progress percentage
 */
function calculateStageProgress(details, stage) {
  switch (stage) {
    case "plan":
      if (details.totalGoals === 0) return 0;
      return Math.round((details.completedGoals / details.totalGoals) * 100);
    case "implement":
      // Progress based on workstreams and activity
      if (details.totalWorkstreams === 0) {
        return details.progressEntries > 0 ? 10 : 0;
      }
      const workstreamProgress = (details.activeWorkstreams / details.totalWorkstreams) * 50;
      const activityProgress = Math.min(details.progressEntries * 5, 50);
      return Math.round(workstreamProgress + activityProgress);
    case "test":
      if (details.totalTests === 0) return 0;
      return Math.round((details.passedTests / details.totalTests) * 100);
    case "review":
      if (details.totalNextSteps === 0) return 0;
      return Math.round((details.completedNextSteps / details.totalNextSteps) * 100);
    default:
      return 0;
  }
}

/**
 * Generate summary text
 */
function generateSummaryText(details, stage) {
  switch (stage) {
    case "plan":
      if (details.totalGoals === 0) {
        return "No goals defined yet. Add goals to start planning.";
      }
      return `${details.completedGoals} of ${details.totalGoals} goals completed. ${details.totalGoals - details.completedGoals} goals remaining.`;
    case "implement":
      const wsText = details.totalWorkstreams > 0 
        ? `${details.activeWorkstreams} active workstream${details.activeWorkstreams !== 1 ? "s" : ""} out of ${details.totalWorkstreams} total. `
        : "No workstreams created yet. ";
      const activityText = details.progressEntries > 0 
        ? `${details.progressEntries} progress entr${details.progressEntries !== 1 ? "ies" : "y"} logged.`
        : "No progress entries yet.";
      return wsText + activityText;
    case "test":
      if (details.totalTests === 0) {
        return "No test cases defined yet. Add tests to the test plan.";
      }
      return `${details.passedTests} of ${details.totalTests} tests passing. ${details.failedTests} test${details.failedTests !== 1 ? "s" : ""} failing.`;
    case "review":
      if (details.totalNextSteps === 0) {
        return details.summary || "Review in progress. No next steps defined yet.";
      }
      return `${details.completedNextSteps} of ${details.totalNextSteps} next steps completed. Status: ${details.status}.`;
    default:
      return "Stage summary not available.";
  }
}

module.exports = createVersionRoutes;
