/**
 * Version route handlers
 */

const path = require("path");
const fs = require("fs");

/**
 * Create version routes handler
 */
function createVersionRoutes(server) {
  return {
    /**
     * List versions (review/progress files)
     */
    async handleListVersions(req, res) {
      const reviewDir = path.join(server.cwd, "review");
      const progressDir = path.join(server.cwd, "progress");
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
            const allWorkflows = server.db.listWorkflows();
            workflows = allWorkflows
              .filter(w => w.version_tag === version.tag)
              .map(w => ({
                id: w.id,
                name: w.name,
                version: w.version
              }));
          } catch (e) {
            workflows = [];
          }
          
          // Get executions for this version
          const executions = server.db.listExecutions(null, null, version.tag) || [];
          
          // Get agents for this version
          const agents = [];
          const queueDir = path.join(server.cwd, ".kaczmarek-ai", "agent-queue");
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
  };
}

module.exports = createVersionRoutes;

