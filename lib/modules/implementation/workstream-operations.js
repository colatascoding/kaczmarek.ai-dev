/**
 * Workstream operations for implementation module
 * Handles workstream creation, management, and consolidation
 */

const fs = require("fs");
const path = require("path");
const versionOps = require("../../versions/file-operations");
const { generateId } = require("../../workflow/utils");

/**
 * Sanitize workstream name for filesystem use
 */
function sanitizeWorkstreamName(name) {
  if (!name) return null;
  // Remove invalid filesystem characters: / \ : * ? " < > |
  // Also remove leading/trailing spaces and dots
  return name
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100); // Limit length
}

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

  // Sanitize workstream name
  const sanitizedName = sanitizeWorkstreamName(workstreamName);
  if (!sanitizedName || sanitizedName.length === 0) {
    throw new Error("Invalid workstream name. Name must contain valid characters and cannot be empty after sanitization.");
  }

  if (sanitizedName !== workstreamName) {
    logger.warn(`Workstream name sanitized: "${workstreamName}" -> "${sanitizedName}"`);
  }

  logger.info(`Creating workstream: ${sanitizedName} for version ${versionTag}`);

  // Get workstream path (use sanitized name)
  const workstreamPath = versionOps.getWorkstreamPath(versionTag, sanitizedName, cwd);
  
  if (!workstreamPath) {
    // Create workstream directory
    const implementPath = versionOps.getStagePath(versionTag, "02_implement", cwd);
    if (!implementPath) {
      throw new Error(`Implementation stage not found for version ${versionTag}`);
    }
    
    const workstreamsPath = path.join(implementPath, "workstreams");
    const newWorkstreamPath = path.join(workstreamsPath, sanitizedName);
    
    try {
      fs.mkdirSync(newWorkstreamPath, { recursive: true });
    } catch (mkdirError) {
      logger.error(`Failed to create workstream directory: ${mkdirError.message}`);
      throw new Error(`Failed to create workstream directory: ${mkdirError.message}`);
    }
    
    // Create workstream metadata
    const metadata = {
      id: sanitizedName,
      name: workstreamName, // Store original name
      sanitizedName: sanitizedName, // Store sanitized name
      description: description,
      versionTag: versionTag,
      status: "active",
      created: new Date().toISOString().split("T")[0],
      tasks: [],
      goals: [], // Workstream-specific goals (for sequence mode)
      currentTaskIndex: 0, // Initialize task index for sequential tasks
      totalTasks: 0 // Will be set when goals are loaded
    };
    
    const metadataPath = path.join(newWorkstreamPath, "workstream.json");
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
    } catch (writeError) {
      logger.error(`Failed to write workstream metadata: ${writeError.message}`);
      // Try to clean up directory
      try {
        fs.rmdirSync(newWorkstreamPath);
      } catch (cleanupError) {
        logger.error(`Failed to cleanup workstream directory: ${cleanupError.message}`);
      }
      throw new Error(`Failed to create workstream metadata: ${writeError.message}`);
    }
    
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
    try {
      fs.writeFileSync(progressPath, progressContent, "utf8");
    } catch (writeError) {
      logger.error(`Failed to write workstream progress: ${writeError.message}`);
      // Metadata already written, so we'll continue
    }
    
    logger.info(`Created workstream: ${newWorkstreamPath}`);
    
    return {
      success: true,
      workstreamId: sanitizedName,
      workstreamPath: newWorkstreamPath,
      metadata: metadata
    };
  } else {
    // Workstream already exists
    return {
      success: false,
      error: `Workstream already exists: ${sanitizedName}`,
      workstreamId: sanitizedName,
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
  let entries = [];
  
  try {
    entries = fs.readdirSync(workstreamsPath, { withFileTypes: true });
  } catch (readError) {
    logger.error(`Failed to read workstreams directory: ${readError.message}`);
    return {
      success: true,
      workstreams: [],
      error: `Failed to read workstreams directory: ${readError.message}`
    };
  }
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const workstreamPath = path.join(workstreamsPath, entry.name);
      const metadataPath = path.join(workstreamPath, "workstream.json");
      
      let metadata = null;
      let metadataError = null;
      
      if (fs.existsSync(metadataPath)) {
        try {
          const metadataContent = fs.readFileSync(metadataPath, "utf8");
          if (metadataContent.trim()) {
            metadata = JSON.parse(metadataContent);
          } else {
            metadataError = "Metadata file is empty";
            logger.warn(`Empty metadata file for workstream: ${entry.name}`);
          }
        } catch (parseError) {
          metadataError = `Failed to parse metadata: ${parseError.message}`;
          logger.warn(`Invalid metadata for workstream ${entry.name}: ${parseError.message}`);
          // Continue with default metadata
        }
      }
      
      workstreams.push({
        id: entry.name,
        name: metadata?.name || entry.name,
        description: metadata?.description || "",
        status: metadata?.status || "active",
        path: workstreamPath,
        metadata: metadata || {},
        metadataError: metadataError || null
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
  const consolidatedParts = [consolidatedSection]; // Use array for efficient concatenation

  for (const workstream of workstreams) {
    const workstreamProgressPath = path.join(workstream.path, "progress.md");
    if (fs.existsSync(workstreamProgressPath)) {
      try {
        const workstreamProgress = fs.readFileSync(workstreamProgressPath, "utf8");
        consolidatedParts.push(`### Workstream: ${workstream.name}\n\n`);
        consolidatedParts.push(workstreamProgress);
        consolidatedParts.push("\n\n---\n\n");
      } catch (readError) {
        logger.warn(`Failed to read progress for workstream ${workstream.name}: ${readError.message}`);
        consolidatedParts.push(`### Workstream: ${workstream.name}\n\n`);
        consolidatedParts.push(`*Error reading progress file: ${readError.message}*\n\n`);
        consolidatedParts.push("\n\n---\n\n");
      }
    }
  }

  const consolidatedContent = consolidatedParts.join("");
  mainProgress += consolidatedContent;
  try {
    fs.writeFileSync(mainProgressPath, mainProgress, "utf8");
  } catch (writeError) {
    logger.error(`Failed to write consolidated progress: ${writeError.message}`);
    throw new Error(`Failed to consolidate workstreams: ${writeError.message}`);
  }

  logger.info(`Consolidated ${workstreams.length} workstream(s) into main progress`);

  return {
    success: true,
    consolidated: true,
    workstreamCount: workstreams.length,
    progressPath: mainProgressPath
  };
}

// Goal pattern constant (shared with versions-stage-summaries.js)
const GOAL_PATTERN = /^[-*]\s*\[([\sx])\]\s*(.+)$/;
const WORKSTREAM_PATTERN = /^###\s*Workstream\s+([A-J]):\s*(.+)$/i;

/**
 * Extract goals from plan stage goals.md file
 * Returns both flat goals list and workstream-organized goals
 */
function extractGoals(versionTag, cwd = process.cwd()) {
  const planPath = versionOps.getStagePath(versionTag, "01_plan", cwd);
  if (!planPath) {
    return { goals: [], totalGoals: 0, workstreams: {} };
  }

  const goalsFile = path.join(planPath, "goals.md");
  if (!fs.existsSync(goalsFile)) {
    return { goals: [], totalGoals: 0, workstreams: {} };
  }

  let content;
  try {
    content = fs.readFileSync(goalsFile, "utf8");
  } catch (readError) {
    const logger = require("../../utils/logger").createLogger();
    logger.warn(`Failed to read goals file: ${readError.message}`);
    return { goals: [], totalGoals: 0, workstreams: {} };
  }
  
  const lines = content.split("\n");
  
  const goals = [];
  // Dynamically create workstreams object based on found workstreams (supports A-J)
  const workstreams = {};
  let currentWorkstream = null;
  
  for (const line of lines) {
    // Check for workstream header
    const workstreamMatch = line.match(WORKSTREAM_PATTERN);
    if (workstreamMatch) {
      const workstreamId = workstreamMatch[1].toUpperCase();
      const workstreamName = workstreamMatch[2].trim();
      // Initialize workstream if not exists
      if (!workstreams[workstreamId]) {
        workstreams[workstreamId] = { name: "", goals: [] };
      }
      currentWorkstream = workstreamId;
      workstreams[workstreamId].name = workstreamName;
      continue;
    }
    
    // Check for goal
    const goalMatch = line.match(GOAL_PATTERN);
    if (goalMatch) {
      const isCompleted = goalMatch[1] === "x";
      const goalText = goalMatch[2].trim();
      if (!isCompleted && goalText) {
        // Determine task sequence number within workstream (1, 2, 3, etc.)
        // Count ALL goals (including completed) to maintain correct sequence even if some are completed
        // This ensures sequence numbers are stable and don't change when goals are marked complete
        let taskSequence = null;
        if (currentWorkstream && workstreams[currentWorkstream]) {
          // Use total goals count (not just uncompleted) to maintain stable sequence numbers
          taskSequence = workstreams[currentWorkstream].goals.length + 1;
        }
        
        const goal = {
          text: goalText,
          completed: false,
          workstream: currentWorkstream || null,
          taskSequence: taskSequence // Track order within workstream (1-based)
        };
        goals.push(goal);
        
        // Add to workstream if we're in one
        if (currentWorkstream && workstreams[currentWorkstream]) {
          workstreams[currentWorkstream].goals.push(goal);
        }
      }
    }
    
    // Reset current workstream if we hit a new section (e.g., "## Success Criteria")
    if (line.match(/^##\s+/)) {
      currentWorkstream = null;
    }
  }
  
  // Clean up empty workstreams
  const activeWorkstreams = {};
  for (const [id, ws] of Object.entries(workstreams)) {
    if (ws.name && ws.goals.length > 0) {
      activeWorkstreams[id] = ws;
    }
  }

  return {
    goals,
    totalGoals: goals.length,
    workstreams: activeWorkstreams
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
    mergeStrategy = "merge",
    currentTaskIndex: requestedTaskIndex = null // Optional: specify which task index to launch
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

  // Check if agent is already running
  if (metadata.agentId && metadata.agentStatus && 
      (metadata.agentStatus === "running" || metadata.agentStatus === "pending")) {
    return {
      success: false,
      error: `Agent already running for this workstream: ${metadata.agentId}`,
      agentId: metadata.agentId,
      agentStatus: metadata.agentStatus
    };
  }

  // Check if workstream has its own goals (sequence mode)
  let workstreamGoals = [];
  let workstreamLabel = null;
  
  if (metadata.goals && Array.isArray(metadata.goals) && metadata.goals.length > 0) {
    // Use workstream-specific goals (sequence mode)
    logger.info(`Using workstream-specific goals for ${workstreamId} (${metadata.goals.length} goals)`);
    workstreamGoals = metadata.goals;
  } else {
    // Fall back to extracting goals from plan stage
    const goalsData = extractGoals(versionTag, cwd);
    
    // Get workstream label from metadata (A, B, C) - this is the key in goalsData.workstreams
    // If not found, try to find workstream by matching name/sanitizedName
    workstreamLabel = metadata.workstreamLabel;
    if (!workstreamLabel) {
      // Try to find workstream by matching name or sanitizedName
      for (const [label, wsData] of Object.entries(goalsData.workstreams || {})) {
        // Check if workstream name matches (case-insensitive, trimmed)
        const wsName = (wsData.name || "").trim().toLowerCase();
        const metaName = (metadata.name || "").trim().toLowerCase();
        const metaSanitizedName = (metadata.sanitizedName || "").trim().toLowerCase();
        
        if (wsName === metaName || wsName === metaSanitizedName) {
          workstreamLabel = label;
          // Update metadata with label for future lookups
          metadata.workstreamLabel = label;
          try {
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
            logger.info(`Matched workstream ${workstreamId} to label ${label} by name`);
          } catch (e) {
            logger.warn(`Failed to save workstream label: ${e.message}`);
          }
          break;
        }
      }
    }
    
    if (!workstreamLabel) {
      return {
        success: false,
        error: `Could not find workstream label for ${workstreamId} and no workstream-specific goals found. Workstream may not have been created from goals or goals need to be set.`
      };
    }
    
    // Get workstream-specific goals from plan stage
    workstreamGoals = goalsData.workstreams[workstreamLabel]?.goals || [];
  }
  
  // Sort by taskSequence first, then filter uncompleted
  // This ensures we get tasks in the correct order even if some are completed
  const workstreamGoalsOrdered = workstreamGoals
    .sort((a, b) => (a.taskSequence || 999) - (b.taskSequence || 999))
    .filter(g => !g.completed);
  
  // Determine current task index: use requested index if provided, otherwise use metadata
  let currentTaskIndex = requestedTaskIndex !== null ? requestedTaskIndex : (metadata.currentTaskIndex || 0);
  
  // Validate current task index
  if (currentTaskIndex < 0) {
    logger.warn(`Invalid currentTaskIndex ${currentTaskIndex}, resetting to 0`);
    currentTaskIndex = 0;
  }
  
  // Check if currentTaskIndex is out of bounds
  if (currentTaskIndex >= workstreamGoalsOrdered.length) {
    logger.warn(`Current task index ${currentTaskIndex} is out of bounds (max: ${workstreamGoalsOrdered.length - 1}). Resetting to last valid index.`);
    currentTaskIndex = Math.max(0, workstreamGoalsOrdered.length - 1);
  }
  
  // Update metadata if we're using a different index than stored
  if (requestedTaskIndex !== null && requestedTaskIndex !== (metadata.currentTaskIndex || 0)) {
    metadata.currentTaskIndex = currentTaskIndex;
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
    } catch (e) {
      logger.warn(`Failed to update workstream metadata: ${e.message}`);
    }
  }
  
  // Get the next task to execute (first uncompleted task in sequence)
  const nextTask = workstreamGoalsOrdered[currentTaskIndex];
  
  if (!nextTask && workstreamGoalsOrdered.length === 0) {
    return {
      success: false,
      error: `No uncompleted goals found for workstream ${workstreamId}`
    };
  }
  
  if (!nextTask) {
    // All tasks completed
    logger.info(`All tasks completed for workstream ${workstreamId}`);
    // Update metadata to mark workstream as complete
    metadata.status = "completed";
    metadata.completedAt = new Date().toISOString();
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
    } catch (e) {
      logger.warn(`Failed to update workstream completion status: ${e.message}`);
    }
    return {
      success: false,
      error: `All tasks completed for workstream ${workstreamId}`,
      allTasksCompleted: true
    };
  }
  
  // Validate task sequence (warn if mismatch, but continue)
  if (nextTask.taskSequence && nextTask.taskSequence !== currentTaskIndex + 1) {
    logger.warn(`Task sequence mismatch for workstream ${workstreamId}: expected sequence ${currentTaskIndex + 1}, got ${nextTask.taskSequence}. Using current index.`);
  }
  
  // Get all remaining tasks for context (but only execute the next one)
  const remainingTasks = workstreamGoalsOrdered.slice(currentTaskIndex);

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

      // Build implementation prompt - focus on current task, but show sequence
      const currentTaskNum = currentTaskIndex + 1;
      // Use metadata.totalTasks if available (total tasks in workstream), otherwise use ordered length
      // This ensures totalTasks reflects the original count, not just remaining tasks
      const totalTasks = metadata.totalTasks || workstreamGoalsOrdered.length;
      const isLastTask = currentTaskIndex >= workstreamGoalsOrdered.length - 1;
      
      const currentTaskDescription = `**CURRENT TASK (${currentTaskNum}/${totalTasks}):** ${nextTask.text}`;
      const remainingTasksList = remainingTasks.length > 1 
        ? `\n\n**REMAINING TASKS (will be executed sequentially after this task completes and merges):**\n${remainingTasks.slice(1).map((g, i) => `${i + 2}. ${g.text}`).join("\n")}`
        : "\n\n**This is the final task for this workstream.**";
      
      const implementationPrompt = `Implement workstream: ${workstreamId} for version ${versionTag}

Workstream Description:
${metadata.description || "No description provided"}

${currentTaskDescription}${remainingTasksList}

Context:
- Version: ${versionTag}
- Workstream: ${workstreamId}
- Task Sequence: ${currentTaskNum} of ${totalTasks}${isLastTask ? " (FINAL TASK)" : ""}
- Project location: ${cwd}

Task:
1. Focus on implementing ONLY the current task: "${nextTask.text}"
2. Make small, incremental changes following kaczmarek.ai-dev principles
3. Update the workstream progress file: versions/v${versionTag.split("-")[0]}/${versionTag}/02_implement/workstreams/${workstreamId}/progress.md
4. Keep changes focused on the current task scope
5. Write tests where appropriate
6. Update documentation as needed
${!isLastTask ? "7. After completion, this task will be merged and the next task will launch automatically" : ""}

Follow kaczmarek.ai-dev principles:
- Small, incremental changes
- Test-driven approach
- Update progress file after completion
- Keep review/progress docs in sync
- Complete the current task fully before moving to the next`;

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
        goals: [nextTask], // Only current task
        allGoals: remainingTasks, // All remaining tasks for reference
        currentTaskIndex: currentTaskIndex,
        totalTasks: totalTasks,
        cwd,
        status: result.status,
        cloudAgentId: result.agentId,
        startedAt: new Date().toISOString(),
        autoMerge: true, // Always auto-merge for sequential tasks
        mergeStrategy: mergeStrategy,
        isWorkstreamTask: true, // Flag to identify workstream tasks
        launchNextOnComplete: !isLastTask // Launch next task after merge
      };

      // Save to queue for status tracking
      const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
      if (!fs.existsSync(queueDir)) {
        fs.mkdirSync(queueDir, { recursive: true });
      }
      const taskFile = path.join(queueDir, `${agentTask.id}.json`);
      
      try {
        fs.writeFileSync(taskFile, JSON.stringify(agentTask, null, 2));

        // Update workstream metadata with agent info
        metadata.agentId = result.agentId;
        metadata.agentStatus = result.status;
        metadata.agentStartedAt = agentTask.startedAt;
        metadata.currentTaskIndex = currentTaskIndex;
        metadata.totalTasks = totalTasks;
        metadata.currentTask = nextTask.text;
        metadata.workstreamLabel = workstreamLabel; // Ensure label is stored for future lookups
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      } catch (writeError) {
        logger.error(`Failed to save agent task or metadata: ${writeError.message}`);
        // Try to clean up task file if metadata write failed
        try {
          if (fs.existsSync(taskFile)) {
            fs.unlinkSync(taskFile);
          }
        } catch (cleanupError) {
          logger.error(`Failed to cleanup task file: ${cleanupError.message}`);
        }
        throw new Error(`Failed to save agent information: ${writeError.message}`);
      }

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

/**
 * Update workstream metadata
 */
async function updateWorkstream(inputs, context) {
  const { cwd = process.cwd(), versionTag, workstreamId, updates } = inputs;
  const { logger } = context;

  if (!versionTag || !workstreamId) {
    throw new Error("Version tag and workstream ID are required");
  }

  if (!updates || typeof updates !== "object") {
    throw new Error("Updates object is required");
  }

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
      throw new Error(`Failed to read workstream metadata: ${e.message}`);
    }
  }

  // Update allowed fields only
  const allowedFields = ["name", "description", "status", "tasks"];
  for (const field of allowedFields) {
    if (field in updates) {
      metadata[field] = updates[field];
    }
  }

  metadata.updated = new Date().toISOString().split("T")[0];

  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
    logger.info(`Updated workstream: ${workstreamPath}`);
    
    return {
      success: true,
      workstreamId: workstreamId,
      metadata: metadata
    };
  } catch (writeError) {
    logger.error(`Failed to update workstream metadata: ${writeError.message}`);
    throw new Error(`Failed to update workstream: ${writeError.message}`);
  }
}

/**
 * Delete workstream
 */
async function deleteWorkstream(inputs, context) {
  const { cwd = process.cwd(), versionTag, workstreamId } = inputs;
  const { logger } = context;

  if (!versionTag || !workstreamId) {
    throw new Error("Version tag and workstream ID are required");
  }

  const workstreamPath = versionOps.getWorkstreamPath(versionTag, workstreamId, cwd);
  if (!workstreamPath) {
    throw new Error(`Workstream not found: ${workstreamId}`);
  }

  try {
    // Check if workstream has active agent
    const metadataPath = path.join(workstreamPath, "workstream.json");
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
        if (metadata.agentId && metadata.agentStatus && 
            (metadata.agentStatus === "running" || metadata.agentStatus === "pending")) {
          throw new Error(`Cannot delete workstream with active agent: ${metadata.agentId}`);
        }
      } catch (parseError) {
        // If metadata is corrupted, log warning but continue
        logger.warn(`Failed to check agent status before deletion: ${parseError.message}`);
      }
    }

    // Delete workstream directory recursively
    const { execSync } = require("child_process");
    try {
      if (process.platform === "win32") {
        execSync(`rmdir /s /q "${workstreamPath}"`, { stdio: "ignore" });
      } else {
        execSync(`rm -rf "${workstreamPath}"`, { stdio: "ignore" });
      }
    } catch (deleteError) {
      // Try manual deletion as fallback
      const deleteRecursive = (dirPath) => {
        if (fs.existsSync(dirPath)) {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              deleteRecursive(fullPath);
            } else {
              fs.unlinkSync(fullPath);
            }
          }
          fs.rmdirSync(dirPath);
        }
      };
      deleteRecursive(workstreamPath);
    }

    logger.info(`Deleted workstream: ${workstreamPath}`);
    
    return {
      success: true,
      workstreamId: workstreamId
    };
  } catch (error) {
    logger.error(`Failed to delete workstream: ${error.message}`);
    throw error;
  }
}

/**
 * Automatically create workstreams from goals.md after planning agent completes
 */
async function createWorkstreamsFromGoals(inputs, context) {
  const { cwd = process.cwd(), versionTag } = inputs;
  const { logger } = context;

  if (!versionTag) {
    throw new Error("Version tag is required");
  }

  logger.info(`Creating workstreams from goals for version ${versionTag}`);

  // Extract goals with workstream organization
  const goalsData = extractGoals(versionTag, cwd);

  // Check if we have workstream-organized goals
  if (!goalsData.workstreams || Object.keys(goalsData.workstreams).length === 0) {
    logger.info("No workstream-organized goals found. Skipping automatic workstream creation.");
    return {
      success: true,
      message: "No workstream-organized goals found",
      workstreamsCreated: 0
    };
  }

  const createdWorkstreams = [];
  const errors = [];

  // Create workstreams for each workstream (A, B, C)
  for (const [workstreamId, workstreamData] of Object.entries(goalsData.workstreams)) {
    if (!workstreamData.name || workstreamData.goals.length === 0) {
      logger.warn(`Skipping workstream ${workstreamId}: missing name or goals`);
      continue;
    }

    // Check if workstream already exists
    const existingPath = versionOps.getWorkstreamPath(versionTag, workstreamData.name, cwd);
    if (existingPath) {
      logger.info(`Workstream "${workstreamData.name}" already exists. Skipping.`);
      continue;
    }

    try {
      // Create description from goals
      const description = workstreamData.goals.map(g => `- ${g.text}`).join("\n");

      // Create the workstream
      const result = await createWorkstream({
        cwd,
        versionTag,
        workstreamName: workstreamData.name,
        description: `Goals for Workstream ${workstreamId}:\n${description}`
      }, context);
      
      // Store workstream label (A, B, C) in metadata for goal lookup
      if (result.success) {
        // Get workstream path using sanitized name
        const sanitizedName = result.sanitizedName || workstreamData.name;
        const workstreamPath = versionOps.getWorkstreamPath(versionTag, sanitizedName, cwd);
        if (workstreamPath) {
          const metadataPath = path.join(workstreamPath, "workstream.json");
          if (fs.existsSync(metadataPath)) {
            try {
              const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
              metadata.workstreamLabel = workstreamId; // Store label (A, B, C) for goal lookup
              metadata.totalTasks = workstreamData.goals.length;
              metadata.currentTaskIndex = 0; // Initialize task index
              fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
              logger.info(`Stored workstream label ${workstreamId} in metadata for ${sanitizedName}`);
            } catch (e) {
              logger.warn(`Failed to update workstream label in metadata: ${e.message}`);
            }
          }
        }
      }

      createdWorkstreams.push({
        workstreamId: workstreamId,
        name: workstreamData.name,
        goalsCount: workstreamData.goals.length
      });

      logger.info(`Created workstream ${workstreamId}: "${workstreamData.name}" with ${workstreamData.goals.length} goals`);
    } catch (error) {
      logger.error(`Failed to create workstream ${workstreamId}: ${error.message}`);
      errors.push({
        workstreamId: workstreamId,
        name: workstreamData.name,
        error: error.message
      });
    }
  }

  return {
    success: errors.length === 0,
    workstreamsCreated: createdWorkstreams.length,
    workstreams: createdWorkstreams,
    errors: errors.length > 0 ? errors : undefined,
    message: `Created ${createdWorkstreams.length} workstream(s) from goals`
  };
}

module.exports = {
  createWorkstream,
  updateWorkstream,
  updateWorkstreamProgress,
  deleteWorkstream,
  listWorkstreams,
  consolidateWorkstreams,
  extractGoals,
  launchWorkstreamAgent,
  sanitizeWorkstreamName,
  createWorkstreamsFromGoals
};


