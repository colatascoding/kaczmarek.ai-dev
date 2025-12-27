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

module.exports = {
  createWorkstream,
  updateWorkstreamProgress,
  listWorkstreams,
  consolidateWorkstreams
};

