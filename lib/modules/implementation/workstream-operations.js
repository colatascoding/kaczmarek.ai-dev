/**
 * Workstream operations for implementation module
 * Handles workstream creation, management, and consolidation
 */

const fs = require("fs");
const path = require("path");
const versionOps = require("../../versions/file-operations");
const { generateId } = require("../../workflow/utils");

/**
 * Create a new workstream
 */
async function createWorkstream(inputs, context) {
  const { cwd = process.cwd(), versionTag, workstreamName, description = "" } = inputs;
  const { logger } = context;

  if (!versionTag) {
    throw new Error("Version tag required");
  }

  if (!workstreamName) {
    throw new Error("Workstream name required");
  }

  logger.info(`Creating workstream: ${workstreamName} for version ${versionTag}`);

  // Get workstream path
  const workstreamPath = versionOps.getWorkstreamPath(versionTag, workstreamName, cwd);
  
  if (!workstreamPath) {
    // Create workstream directory
    const implementPath = versionOps.getStagePath(versionTag, "02_implement", cwd);
    if (!implementPath) {
      throw new Error(`Implementation stage not found for version ${versionTag}`);
    }
    
    const workstreamsPath = path.join(implementPath, "workstreams");
    const newWorkstreamPath = path.join(workstreamsPath, workstreamName);
    
    fs.mkdirSync(newWorkstreamPath, { recursive: true });
    
    // Create workstream metadata
    const metadata = {
      id: workstreamName,
      name: workstreamName,
      description: description,
      versionTag: versionTag,
      status: "active",
      created: new Date().toISOString().split("T")[0],
      tasks: []
    };
    
    const metadataPath = path.join(newWorkstreamPath, "workstream.json");
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
    
    // Create progress.md
    const progressPath = path.join(newWorkstreamPath, "progress.md");
    const progressContent = `# Workstream: ${workstreamName}

**Version**: ${versionTag}  
**Status**: Active  
**Created**: ${metadata.created}

## Description

${description || "No description provided."}

## Progress

`;
    fs.writeFileSync(progressPath, progressContent, "utf8");
    
    logger.info(`Created workstream: ${newWorkstreamPath}`);
    
    return {
      success: true,
      workstreamId: workstreamName,
      workstreamPath: newWorkstreamPath,
      metadata: metadata
    };
  } else {
    // Workstream already exists
    return {
      success: false,
      error: `Workstream already exists: ${workstreamName}`,
      workstreamId: workstreamName,
      workstreamPath: workstreamPath
    };
  }
}

/**
 * Update workstream progress
 */
async function updateWorkstreamProgress(inputs, context) {
  const { cwd = process.cwd(), versionTag, workstreamId, entry } = inputs;
  const { logger } = context;

  if (!versionTag || !workstreamId || !entry) {
    throw new Error("Version tag, workstream ID, and entry are required");
  }

  const workstreamPath = versionOps.getWorkstreamPath(versionTag, workstreamId, cwd);
  if (!workstreamPath) {
    throw new Error(`Workstream not found: ${workstreamId}`);
  }

  const progressPath = path.join(workstreamPath, "progress.md");
  
  // Read existing content
  let content = "";
  if (fs.existsSync(progressPath)) {
    content = fs.readFileSync(progressPath, "utf8");
  } else {
    content = `# Workstream: ${workstreamId}\n\n`;
  }

  // Append entry
  const date = new Date().toISOString().split("T")[0];
  const newEntry = `\n## ${date}\n\n${entry}\n`;
  content += newEntry;

  fs.writeFileSync(progressPath, content, "utf8");

  logger.info(`Updated workstream progress: ${workstreamPath}`);

  return {
    success: true,
    workstreamId: workstreamId,
    progressPath: progressPath
  };
}

/**
 * List all workstreams for a version
 */
async function listWorkstreams(inputs, context) {
  const { cwd = process.cwd(), versionTag } = inputs;
  const { logger } = context;

  if (!versionTag) {
    throw new Error("Version tag required");
  }

  const implementPath = versionOps.getStagePath(versionTag, "02_implement", cwd);
  if (!implementPath) {
    return {
      success: true,
      workstreams: []
    };
  }

  const workstreamsPath = path.join(implementPath, "workstreams");
  if (!fs.existsSync(workstreamsPath)) {
    return {
      success: true,
      workstreams: []
    };
  }

  const workstreams = [];
  const entries = fs.readdirSync(workstreamsPath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const workstreamPath = path.join(workstreamsPath, entry.name);
      const metadataPath = path.join(workstreamPath, "workstream.json");
      
      let metadata = null;
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
        } catch (e) {
          // Skip invalid metadata
        }
      }
      
      workstreams.push({
        id: entry.name,
        name: metadata?.name || entry.name,
        description: metadata?.description || "",
        status: metadata?.status || "active",
        path: workstreamPath,
        metadata: metadata || {}
      });
    }
  }

  return {
    success: true,
    workstreams: workstreams
  };
}

/**
 * Consolidate workstreams into main progress file
 */
async function consolidateWorkstreams(inputs, context) {
  const { cwd = process.cwd(), versionTag } = inputs;
  const { logger } = context;

  if (!versionTag) {
    throw new Error("Version tag required");
  }

  logger.info(`Consolidating workstreams for version ${versionTag}`);

  // Get all workstreams
  const workstreamsResult = await listWorkstreams({ cwd, versionTag }, context);
  const workstreams = workstreamsResult.workstreams || [];

  if (workstreams.length === 0) {
    return {
      success: true,
      message: "No workstreams to consolidate",
      consolidated: false
    };
  }

  // Get main progress file
  const versionPath = versionOps.findVersionFolder(versionTag, cwd);
  if (!versionPath) {
    throw new Error(`Version folder not found: ${versionTag}`);
  }

  const mainProgressPath = path.join(versionPath, "02_implement", "progress.md");
  
  // Read main progress
  let mainProgress = "";
  if (fs.existsSync(mainProgressPath)) {
    mainProgress = fs.readFileSync(mainProgressPath, "utf8");
  } else {
    mainProgress = `# Progress Log - Version ${versionTag}\n\n`;
  }

  // Consolidate workstream progress
  const consolidatedSection = `\n## Workstream Consolidation (${new Date().toISOString().split("T")[0]})\n\n`;
  let consolidatedContent = consolidatedSection;

  for (const workstream of workstreams) {
    const workstreamProgressPath = path.join(workstream.path, "progress.md");
    if (fs.existsSync(workstreamProgressPath)) {
      const workstreamProgress = fs.readFileSync(workstreamProgressPath, "utf8");
      consolidatedContent += `### Workstream: ${workstream.name}\n\n`;
      consolidatedContent += workstreamProgress;
      consolidatedContent += "\n\n---\n\n";
    }
  }

  mainProgress += consolidatedContent;
  fs.writeFileSync(mainProgressPath, mainProgress, "utf8");

  logger.info(`Consolidated ${workstreams.length} workstream(s) into main progress`);

  return {
    success: true,
    consolidated: true,
    workstreamCount: workstreams.length,
    progressPath: mainProgressPath
  };
}

/**
 * Extract goals from plan stage goals.md file
 */
function extractGoals(versionTag, cwd = process.cwd()) {
  const planPath = versionOps.getStagePath(versionTag, "01_plan", cwd);
  if (!planPath) {
    return { goals: [], totalGoals: 0 };
  }

  const goalsFile = path.join(planPath, "goals.md");
  if (!fs.existsSync(goalsFile)) {
    return { goals: [], totalGoals: 0 };
  }

  const content = fs.readFileSync(goalsFile, "utf8");
  const lines = content.split("\n");
  const GOAL_PATTERN = /^[-*]\s*\[([\sx])\]\s*(.+)$/;
  
  const goals = [];
  for (const line of lines) {
    const goalMatch = line.match(GOAL_PATTERN);
    if (goalMatch) {
      const isCompleted = goalMatch[1] === "x";
      const goalText = goalMatch[2].trim();
      if (!isCompleted && goalText) {
        goals.push({
          text: goalText,
          completed: false
        });
      }
    }
  }

  return {
    goals,
    totalGoals: goals.length
  };
}

/**
 * Launch agent for a workstream based on goals
 */
async function launchWorkstreamAgent(inputs, context) {
  const { 
    cwd = process.cwd(), 
    versionTag, 
    workstreamId,
    agentType = "cursor",
    autoMerge = false,
    mergeStrategy = "merge"
  } = inputs;
  const { logger } = context;

  if (!versionTag || !workstreamId) {
    throw new Error("Version tag and workstream ID are required");
  }

  logger.info(`Launching agent for workstream: ${workstreamId} (version: ${versionTag})`);

  // Get workstream metadata
  const workstreamPath = versionOps.getWorkstreamPath(versionTag, workstreamId, cwd);
  if (!workstreamPath) {
    throw new Error(`Workstream not found: ${workstreamId}`);
  }

  const metadataPath = path.join(workstreamPath, "workstream.json");
  let metadata = {};
  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    } catch (e) {
      logger.warn(`Failed to parse workstream metadata: ${e.message}`);
    }
  }

  // Extract goals from plan stage
  const goalsData = extractGoals(versionTag, cwd);
  const uncompletedGoals = goalsData.goals.filter(g => !g.completed);

  if (uncompletedGoals.length === 0) {
    return {
      success: false,
      error: "No uncompleted goals found in plan stage"
    };
  }

  // If agentType is "cursor" and CURSOR_API_KEY is available, use Cloud Agents API
  if (agentType === "cursor" && process.env.CURSOR_API_KEY) {
    try {
      const cursorCloudAgent = require("../cursor-cloud-agent");
      const { execSync } = require("child_process");
      
      // Get repository identifier
      let repository;
      try {
        const remoteUrl = execSync("git config --get remote.origin.url", {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        }).trim();
        const match = remoteUrl.match(/(?:github\.com[/:]|gitlab\.com[/:]|bitbucket\.org[/:])([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (match) {
          repository = `${match[1]}/${match[2]}`;
        } else {
          repository = remoteUrl;
        }
      } catch (e) {
        repository = path.basename(cwd);
      }

      // Build implementation prompt from workstream and goals
      const goalsList = uncompletedGoals.map((g, i) => `${i + 1}. ${g.text}`).join("\n");
      
      const implementationPrompt = `Implement workstream: ${workstreamId} for version ${versionTag}

Workstream Description:
${metadata.description || "No description provided"}

Goals to Implement:
${goalsList}

Context:
- Version: ${versionTag}
- Workstream: ${workstreamId}
- Project location: ${cwd}

Task:
1. Review the goals above and implement the features/tasks for this workstream
2. Make small, incremental changes following kaczmarek.ai-dev principles
3. Update the workstream progress file: versions/v${versionTag.split("-")[0]}/${versionTag}/02_implement/workstreams/${workstreamId}/progress.md
4. Keep changes focused on the workstream scope
5. Write tests where appropriate
6. Update documentation as needed

Follow kaczmarek.ai-dev principles:
- Small, incremental changes
- Test-driven approach
- Update progress file after completion
- Keep review/progress docs in sync`;

      logger.info(`Launching Cursor Cloud Agent for workstream: ${repository}`);
      
      const result = await cursorCloudAgent.actions["launch"]({
        prompt: implementationPrompt,
        repository,
        branch: null // Will auto-detect from git or default to "main"
      }, context);

      // Store agent info for status tracking
      const agentTask = {
        id: result.agentId,
        versionTag: versionTag,
        workstreamId: workstreamId,
        type: "cursor-cloud",
        prompt: implementationPrompt,
        goals: uncompletedGoals,
        cwd,
        status: result.status,
        cloudAgentId: result.agentId,
        startedAt: new Date().toISOString(),
        autoMerge: autoMerge,
        mergeStrategy: mergeStrategy
      };

      // Save to queue for status tracking
      const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
      if (!fs.existsSync(queueDir)) {
        fs.mkdirSync(queueDir, { recursive: true });
      }
      const taskFile = path.join(queueDir, `${agentTask.id}.json`);
      fs.writeFileSync(taskFile, JSON.stringify(agentTask, null, 2));

      // Update workstream metadata with agent info
      metadata.agentId = result.agentId;
      metadata.agentStatus = result.status;
      metadata.agentStartedAt = agentTask.startedAt;
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info(`Workstream agent launched: ${result.agentId}`);
      logger.info(`Monitor status at: https://cursor.com/agents/${result.agentId}`);

      return {
        success: true,
        agentTaskId: result.agentId,
        cloudAgentId: result.agentId,
        status: result.status,
        message: `Agent launched for workstream. Monitor at: https://cursor.com/agents/${result.agentId}`
      };
    } catch (error) {
      logger.error(`Failed to launch workstream Cloud Agent: ${error.message}`);
      throw error;
    }
  } else {
    logger.warn(`CURSOR_API_KEY not set or agentType is not "cursor". Cannot launch workstream agent.`);
    return {
      success: false,
      error: "CURSOR_API_KEY environment variable is required for workstream agent"
    };
  }
}

module.exports = {
  createWorkstream,
  updateWorkstreamProgress,
  listWorkstreams,
  consolidateWorkstreams,
  extractGoals,
  launchWorkstreamAgent
};


