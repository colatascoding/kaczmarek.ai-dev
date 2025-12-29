/**
 * Stage summary generators for version routes
 */

const path = require("path");
const fs = require("fs");
const stageOps = require("../../versions/stage-management");

// Pre-compile regex patterns for better performance
const GOAL_PATTERN = /^[-*]\s*\[([\sx])\]\s*(.+)$/;
const TEST_PATTERN = /^[-*]\s*\[([\sx])\]\s*(.+)$/;
const STEP_PATTERN = /^[-*]\s*\[([\sx])\]\s*(.+)$/;
const DATE_HEADER_PATTERN = /^##\s+(\d{4}-\d{2}-\d{2})/;
const DATE_HEADER_GLOBAL_PATTERN = /^## \d{4}-\d{2}-\d{2}/gm;
const STATUS_PATTERN = /\*\*Status\*\*:\s*(\w+)/i;
const SUMMARY_PATTERN = /## Summary\s*\n\n(.+?)(?:\n\n|##)/s;
const NEXT_STEPS_PATTERN = /## Next Steps\s*\n([\s\S]*?)(?=\n##|\n*$)/;
const VERSION_TAG_PATTERN = /^(\d+)-(\d+)$/;
const MAJOR_VERSION_PATTERN = /^v(\d+)$/;

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
      case "plan": {
        summary.details = await generatePlanSummary(stagePath);
        break;
      }
      case "implement": {
        summary.details = await generateImplementSummary(stagePath, versionTag, cwd, versionsDir);
        break;
      }
      case "test": {
        summary.details = await generateTestSummary(stagePath);
        break;
      }
      case "review": {
        summary.details = await generateReviewSummary(stagePath);
        break;
      }
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
      const goalMatch = line.match(GOAL_PATTERN);
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
    const entryMatches = content.match(DATE_HEADER_GLOBAL_PATTERN);
    details.progressEntries = entryMatches ? entryMatches.length : 0;
    
    // Extract recent activity (last 5 entries)
    const lines = content.split("\n");
    let currentEntry = null;
    const entries = [];
    
    for (let i = 0; i < lines.length; i++) {
      const entryMatch = lines[i].match(DATE_HEADER_PATTERN);
      if (entryMatch) {
        if (currentEntry) entries.push(currentEntry);
        currentEntry = {
          date: entryMatch[1],
          content: []
        };
      } else if (currentEntry && lines[i].trim()) {
        currentEntry.content.push(lines[i]);
      }
    }
    if (currentEntry) entries.push(currentEntry);
    
    details.recentActivity = entries.slice(-5).reverse();
  }
  
  // Count workstreams
  if (fs.existsSync(workstreamsPath)) {
    const workstreamDirs = fs.readdirSync(workstreamsPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory());
    
    details.totalWorkstreams = workstreamDirs.length;
    
    // Process workstreams
    for (const workstreamDir of workstreamDirs) {
      const metadataFile = path.join(workstreamsPath, workstreamDir.name, "workstream.json");
      if (fs.existsSync(metadataFile)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
          const status = metadata.status || "active";
          const isActive = status === "active" || status === "in-progress";
          
          details.workstreams.push({
            id: workstreamDir.name,
            name: metadata.name || workstreamDir.name,
            description: metadata.description || "",
            status: status,
            progress: metadata.progress || 0,
            metadata: metadata // Include full metadata for agent info
          });
          
          if (isActive) details.activeWorkstreams++;
        } catch (error) {
          // Skip invalid metadata, but still add basic entry
          details.workstreams.push({
            id: workstreamDir.name,
            name: workstreamDir.name,
            status: "active",
            progress: 0
          });
          details.activeWorkstreams++;
        }
      } else {
        // No metadata file, add default entry
        details.workstreams.push({
          id: workstreamDir.name,
          name: workstreamDir.name,
          status: "active",
          progress: 0
        });
        details.activeWorkstreams++;
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
    tests: [],
    totalTests: 0,
    passedTests: 0,
    failedTests: 0
  };
  
  if (fs.existsSync(testPlanFile)) {
    const content = fs.readFileSync(testPlanFile, "utf8");
    const lines = content.split("\n");
    
    for (const line of lines) {
      const testMatch = line.match(TEST_PATTERN);
      if (testMatch) {
        const isPassed = testMatch[1] === "x";
        const testText = testMatch[2].trim();
        details.tests.push({
          text: testText,
          passed: isPassed
        });
        details.totalTests++;
        if (isPassed) {
          details.passedTests++;
        } else {
          details.failedTests++;
        }
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
    nextSteps: [],
    totalNextSteps: 0,
    completedNextSteps: 0,
    status: "pending",
    summary: ""
  };
  
  if (fs.existsSync(reviewFile)) {
    const content = fs.readFileSync(reviewFile, "utf8");
    const lines = content.split("\n");
    
    // Extract next steps
    let inNextStepsSection = false;
    for (const line of lines) {
      if (line.match(/^##\s+Next\s+Steps/i)) {
        inNextStepsSection = true;
        continue;
      }
      if (inNextStepsSection && line.match(/^##/)) {
        inNextStepsSection = false;
        continue;
      }
      
      if (inNextStepsSection) {
        const stepMatch = line.match(STEP_PATTERN);
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
    
    // Extract status
    const statusMatch = content.match(STATUS_PATTERN);
    if (statusMatch) {
      details.status = statusMatch[1].toLowerCase();
    }
    
    // Extract summary (first paragraph after title)
    const summaryMatch = content.match(SUMMARY_PATTERN);
    if (summaryMatch) {
      details.summary = summaryMatch[1];
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
    case "implement": {
      // Progress based on workstreams and activity
      if (details.totalWorkstreams === 0) {
        return details.progressEntries > 0 ? 10 : 0;
      }
      const workstreamProgress = (details.activeWorkstreams / details.totalWorkstreams) * 50;
      const activityProgress = Math.min(details.progressEntries * 5, 50);
      return Math.round(workstreamProgress + activityProgress);
    }
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
    case "implement": {
      const wsText = details.totalWorkstreams > 0 
        ? `${details.activeWorkstreams} active workstream${details.activeWorkstreams !== 1 ? "s" : ""} out of ${details.totalWorkstreams} total. `
        : "No workstreams created yet. ";
      const activityText = details.progressEntries > 0 
        ? `${details.progressEntries} progress entr${details.progressEntries !== 1 ? "ies" : "y"} logged.`
        : "No progress entries yet.";
      return wsText + activityText;
    }
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
      return "";
  }
}

module.exports = {
  generateStageSummary,
  generatePlanSummary,
  generateImplementSummary,
  generateTestSummary,
  generateReviewSummary,
  calculateStageProgress,
  generateSummaryText
};
