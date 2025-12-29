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
      tasks: []
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
const WORKSTREAM_PATTERN = /^###\s*Workstream\s+([ABC]):\s*(.+)$/i;

/**
 * Extract goals from plan stage goals.md file, organized by workstream
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
    // Use console if logger not available (for backward compatibility)
    const logFn = typeof logger !== 'undefined' && logger?.warn ? logger.warn : console.warn;
    logFn(`Failed to read goals file: ${readError.message}`);
    return { goals: [], totalGoals: 0, workstreams: {} };
  }
  
  const lines = content.split("\n");
  
  const goals = [];
  const workstreams = {
    A: { name: "", goals: [] },
    B: { name: "", goals: [] },
    C: { name: "", goals: [] }
  };
  
  let currentWorkstream = null;
  
  for (const line of lines) {
    // Check for workstream header
    const workstreamMatch = line.match(WORKSTREAM_PATTERN);
    if (workstreamMatch) {
      const workstreamId = workstreamMatch[1].toUpperCase();
      const workstreamName = workstreamMatch[2].trim();
      if (workstreams[workstreamId]) {
        currentWorkstream = workstreamId;
        workstreams[workstreamId].name = workstreamName;
      }
      continue;
    }
    
    // Check for goal
    const goalMatch = line.match(GOAL_PATTERN);
    if (goalMatch) {
      const isCompleted = goalMatch[1] === "x";
      const goalText = goalMatch[2].trim();
      if (!isCompleted && goalText) {
        const goal = {
          text: goalText,
          completed: false,
          workstream: currentWorkstream || null
        };
        goals.push(goal);
        
        // Add to workstream if we're in one
        if (currentWorkstream && workstreams[currentWorkstream]) {
          workstreams[currentWorkstream].goals.push(goal);
        }
      }
    } else if (line.trim() && !line.match(/^#/)) {
      // If we hit a non-goal, non-header line, we might have left the workstream section
      // Only reset if we're past the Primary Objectives section
      if (line.match(/^##\s+Success Criteria/i) || 
          line.match(/^##\s+Key Features/i) || 
          line.match(/^##\s+Technical Considerations/i)) {
        currentWorkstream = null;
      }
    }
  }

  // Clean up empty workstreams
  const activeWorkstreams = {};
  for (const [id, ws] of Object.entries(workstreams)) {
    if (ws.goals.length > 0) {
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
 * Automatically create workstreams from goals.md file
 * Creates workstreams A, B, C based on the goals structure
 */
async function createWorkstreamsFromGoals(inputs, context) {
  const { cwd = process.cwd(), versionTag } = inputs;
  const { logger } = context;

  if (!versionTag) {
    throw new Error("Version tag required");
  }

  logger.info(`Auto-creating workstreams from goals for version ${versionTag}`);

  // Extract goals with workstream information
  const goalsData = extractGoals(versionTag, cwd);
  
  if (!goalsData.workstreams || Object.keys(goalsData.workstreams).length === 0) {
    logger.info("No workstream-organized goals found. Skipping auto-creation.");
    return {
      success: true,
      message: "No workstream-organized goals found",
      workstreamsCreated: 0
    };
  }

  const createdWorkstreams = [];
  const errors = [];

  // Create workstreams for each workstream found in goals
  for (const [workstreamId, workstreamData] of Object.entries(goalsData.workstreams)) {
    if (!workstreamData.name || workstreamData.goals.length === 0) {
      logger.warn(`Skipping workstream ${workstreamId}: missing name or goals`);
      continue;
    }

    try {
      // Use workstream name as the workstream identifier
      // If name contains spaces or special chars, sanitize it
      const workstreamName = workstreamData.name;
      const sanitizedName = sanitizeWorkstreamName(workstreamName) || `Workstream-${workstreamId}`;
      
      // Check if workstream already exists
      const existingPath = versionOps.getWorkstreamPath(versionTag, sanitizedName, cwd);
      if (existingPath) {
        logger.info(`Workstream "${sanitizedName}" already exists, skipping creation`);
        createdWorkstreams.push({
          id: sanitizedName,
          name: workstreamName,
          workstreamId: workstreamId,
          status: "existing"
        });
        continue;
      }

      // Create description from goals
      const goalsList = workstreamData.goals.map((g, i) => `${i + 1}. ${g.text}`).join("\n");
      const description = `Auto-created from planning stage.\n\nGoals:\n${goalsList}`;

      // Create the workstream
      const result = await createWorkstream({
        cwd,
        versionTag,
        workstreamName: workstreamName,
        description: description
      }, context);

      if (result.success) {
        logger.info(`Created workstream "${workstreamName}" (${workstreamId})`);
        createdWorkstreams.push({
          id: result.workstreamId || sanitizedName,
          name: workstreamName,
          workstreamId: workstreamId,
          status: "created",
          goalsCount: workstreamData.goals.length
        });
      } else {
        errors.push(`Failed to create workstream ${workstreamId}: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      logger.error(`Error creating workstream ${workstreamId}: ${error.message}`);
      errors.push(`Workstream ${workstreamId}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    message: `Created ${createdWorkstreams.length} workstream(s) from goals`,
    workstreamsCreated: createdWorkstreams.length,
    workstreams: createdWorkstreams,
    errors: errors.length > 0 ? errors : undefined
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

  // Decode workstreamId if it's URL-encoded (safety check)
  let decodedWorkstreamId = workstreamId;
  try {
    // If it contains % encoding, decode it
    if (workstreamId.includes('%')) {
      decodedWorkstreamId = decodeURIComponent(workstreamId);
      logger.info(`Decoded workstream ID: "${workstreamId}" -> "${decodedWorkstreamId}"`);
    }
  } catch (e) {
    // If decoding fails, use original
    logger.warn(`Failed to decode workstream ID "${workstreamId}": ${e.message}`);
  }

  // Get workstream metadata - try both encoded and decoded versions
  let workstreamPath = versionOps.getWorkstreamPath(versionTag, decodedWorkstreamId, cwd);
  if (!workstreamPath && decodedWorkstreamId !== workstreamId) {
    // Try with original if different
    workstreamPath = versionOps.getWorkstreamPath(versionTag, workstreamId, cwd);
  }
  
  if (!workstreamPath) {
    throw new Error(`Workstream not found: ${decodedWorkstreamId} (tried: ${workstreamId})`);
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

  // Extract goals from plan stage
  const goalsData = extractGoals(versionTag, cwd);
  
  // Try to match workstream by ID (A, B, C) or by name
  let workstreamGoals = [];
  let workstreamName = decodedWorkstreamId;
  
  // Check if workstreamId matches a workstream letter (A, B, C)
  const workstreamMatch = decodedWorkstreamId.match(/^Workstream\s*([ABC])$/i) || 
                          decodedWorkstreamId.match(/^([ABC])$/i) ||
                          (goalsData.workstreams && Object.keys(goalsData.workstreams).find(id => 
                            goalsData.workstreams[id].name && 
                            decodedWorkstreamId.toLowerCase().includes(goalsData.workstreams[id].name.toLowerCase())
                          ));
  
  if (workstreamMatch && goalsData.workstreams) {
    let workstreamId = null;
    if (typeof workstreamMatch === 'string') {
      workstreamId = workstreamMatch.toUpperCase();
    } else if (Array.isArray(workstreamMatch) && workstreamMatch[1]) {
      workstreamId = workstreamMatch[1].toUpperCase();
    } else if (typeof workstreamMatch === 'string' && goalsData.workstreams[workstreamMatch]) {
      workstreamId = workstreamMatch;
    }
    
    if (workstreamId && goalsData.workstreams[workstreamId]) {
      workstreamGoals = goalsData.workstreams[workstreamId].goals.filter(g => !g.completed);
      workstreamName = goalsData.workstreams[workstreamId].name || `Workstream ${workstreamId}`;
      logger.info(`Found workstream ${workstreamId}: "${workstreamName}" with ${workstreamGoals.length} goals`);
    }
  }
  
  // If no workstream-specific goals found, use all goals (backward compatibility)
  if (workstreamGoals.length === 0) {
    workstreamGoals = goalsData.goals.filter(g => !g.completed);
    logger.info(`Using all ${workstreamGoals.length} goals for workstream (no workstream-specific goals found)`);
  }

  if (workstreamGoals.length === 0) {
    return {
      success: false,
      error: "No uncompleted goals found for this workstream in plan stage"
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

      // Build implementation prompt from workstream-specific goals
      const goalsList = workstreamGoals.map((g, i) => `${i + 1}. ${g.text}`).join("\n");
      
      const implementationPrompt = `Implement workstream: ${workstreamName} (${decodedWorkstreamId}) for version ${versionTag}

Workstream Description:
${metadata.description || workstreamName || "No description provided"}

Goals to Implement (${workstreamGoals.length} goals):
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
      
      try {
        fs.writeFileSync(taskFile, JSON.stringify(agentTask, null, 2));

        // Update workstream metadata with agent info
        metadata.agentId = result.agentId;
        metadata.agentStatus = result.status;
        metadata.agentStartedAt = agentTask.startedAt;
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


