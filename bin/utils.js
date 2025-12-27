/**
 * Shared utilities for kad CLI commands
 */

const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

const CONFIG_FILENAME = "kaczmarek-ai.config.json";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function error(msg) {
  process.stderr.write(`${msg}\n`);
}

function runGit(args) {
  try {
    const out = child_process.execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return out.trim();
  } catch {
    return null;
  }
}

function loadConfig(cwd) {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    return getDefaultConfig(cwd);
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    // Merge with defaults to ensure all new fields are present
    return mergeConfig(getDefaultConfig(cwd), parsed);
  } catch (e) {
    error(`Failed to read/parse ${CONFIG_FILENAME}: ${String(e)}`);
    process.exitCode = 1;
    return null;
  }
}

function getDefaultConfig(cwd) {
  return {
    version: 2,
    projectName: path.basename(cwd),
    docs: {
      docsDir: "docs",
      versionsDir: "versions"
    },
    library: {
      libraryDir: "library",
      workflowsDir: "library/workflows",
      dashboardsDir: "library/dashboards",
      templatesDir: "library/templates",
      versionSpecificLibraries: true
    },
    workflows: {
      activeDir: "workflows",
      discoveryOrder: ["active", "version-specific", "library"]
    },
    ai: {
      agentsDir: "agents",
      toolsDir: "tools",
      workflowsDir: "workflows",
      promptsDir: "prompts"
    },
    timeline: {
      diagramFile: "docs/TIMELINE.mmd"
    }
  };
}

function mergeConfig(defaults, userConfig) {
  const merged = { ...defaults };
  
  // Deep merge docs
  if (userConfig.docs) {
    merged.docs = { ...defaults.docs, ...userConfig.docs };
  }
  
  // Deep merge library (new)
  if (userConfig.library) {
    merged.library = { ...defaults.library, ...userConfig.library };
  }
  
  // Deep merge workflows (new)
  if (userConfig.workflows) {
    merged.workflows = { ...defaults.workflows, ...userConfig.workflows };
  }
  
  // Deep merge ai
  if (userConfig.ai) {
    merged.ai = { ...defaults.ai, ...userConfig.ai };
  }
  
  // Deep merge timeline
  if (userConfig.timeline) {
    merged.timeline = { ...defaults.timeline, ...userConfig.timeline };
  }
  
  // Copy other fields
  if (userConfig.version) merged.version = userConfig.version;
  if (userConfig.projectName) merged.projectName = userConfig.projectName;
  
  return merged;
}

function saveConfig(cwd, config, { force = false } = {}) {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  if (fs.existsSync(configPath) && !force) {
    error(
      `${CONFIG_FILENAME} already exists. Use --force to overwrite if you really want to.`
    );
    process.exitCode = 1;
    return;
  }
  const data = JSON.stringify(config, null, 2) + "\n";
  fs.writeFileSync(configPath, data, "utf8");
  log(`Wrote ${CONFIG_FILENAME} in ${cwd}`);
}

function listMarkdownFiles(dir, maxDepth, currentDepth = 0) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (currentDepth < maxDepth) {
        result.push(...listMarkdownFiles(full, maxDepth, currentDepth + 1));
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      result.push(full);
    }
  }
  return result;
}

function readFirstHeading(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        return trimmed;
      }
    }
  } catch {
    // ignore read errors, just return empty
  }
  return "";
}

function buildSummary(cwd, config) {
  const docsDir = path.join(cwd, config.docs?.docsDir || "docs");
  const reviewDir = path.join(cwd, config.docs?.reviewDir || "review");
  const progressDir = path.join(cwd, config.docs?.progressDir || "progress");

  // AI-related dirs (agents, tools, workflows, prompts) – optional.
  const agentsDir = path.join(cwd, config.ai?.agentsDir || "agents");
  const toolsDir = path.join(cwd, config.ai?.toolsDir || "tools");
  const workflowsDir = path.join(cwd, config.ai?.workflowsDir || "workflows");
  const promptsDir = path.join(cwd, config.ai?.promptsDir || "prompts");

  const docsFiles = listMarkdownFiles(docsDir, 2);
  const reviewFiles = listMarkdownFiles(reviewDir, 1);
  const progressFiles = listMarkdownFiles(progressDir, 1);

  const agentsFiles = listMarkdownFiles(agentsDir, 2);
  const toolsFiles = listMarkdownFiles(toolsDir, 2);
  const workflowsFiles = listMarkdownFiles(workflowsDir, 2);
  const promptsFiles = listMarkdownFiles(promptsDir, 2);

  // Timeline diagram (Mermaid) – optional.
  const timelinePath = path.join(
    cwd,
    config.timeline?.diagramFile || "docs/TIMELINE.mmd"
  );
  const timelineExists = fs.existsSync(timelinePath);

  function toSummary(files) {
    return files.map((f) => {
      const rel = path.relative(cwd, f);
      const heading = readFirstHeading(f);
      return { path: rel, heading };
    });
  }

  return {
    projectName: config.projectName || path.basename(cwd),
    configFile: CONFIG_FILENAME,
    docs: {
      docsDir: path.relative(cwd, docsDir),
      reviewDir: path.relative(cwd, reviewDir),
      progressDir: path.relative(cwd, progressDir),
      docsFiles: toSummary(docsFiles),
      reviewFiles: toSummary(reviewFiles),
      progressFiles: toSummary(progressFiles)
    },
    ai: {
      agentsDir: path.relative(cwd, agentsDir),
      toolsDir: path.relative(cwd, toolsDir),
      workflowsDir: path.relative(cwd, workflowsDir),
      promptsDir: path.relative(cwd, promptsDir),
      agentsFiles: toSummary(agentsFiles),
      toolsFiles: toSummary(toolsFiles),
      workflowsFiles: toSummary(workflowsFiles),
      promptsFiles: toSummary(promptsFiles)
    },
    timeline: {
      diagramFile: path.relative(cwd, timelinePath),
      exists: timelineExists
    }
  };
}

function findCurrentReviewAndProgress(summary) {
  const reviewFiles = (summary.docs && summary.docs.reviewFiles) || [];
  const progressFiles = (summary.docs && summary.docs.progressFiles) || [];

  const versionItems = [];

  for (const item of reviewFiles) {
    const relPath = item.path || "";
    const base = path.basename(relPath, path.extname(relPath));
    if (!base.startsWith("version")) continue;
    const rest = base.slice("version".length); // e.g. "0-11" or "0-7-ui-config"
    const match = rest.match(/^(\d+)-(\d+)/);
    if (!match) continue;
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    const canonicalBase = `version${major}-${minor}`;
    versionItems.push({
      path: relPath,
      heading: item.heading || "",
      base,
      major,
      minor,
      isCanonical: base === canonicalBase
    });
  }

  if (versionItems.length === 0) {
    return null;
  }

  // Find highest version by (major, minor).
  let best = versionItems[0];
  for (let i = 1; i < versionItems.length; i += 1) {
    const cur = versionItems[i];
    if (
      cur.major > best.major ||
      (cur.major === best.major && cur.minor > best.minor)
    ) {
      best = cur;
    }
  }

  // Prefer canonical file name for that version if available.
  const sameVersion = versionItems.filter(
    (v) => v.major === best.major && v.minor === best.minor
  );
  const chosen =
    sameVersion.find((v) => v.isCanonical) || sameVersion[0] || best;

  const versionTag = `version${chosen.major}-${chosen.minor}`;

  let progress = null;
  for (const pf of progressFiles) {
    const relPath = pf.path || "";
    const base = path.basename(relPath, path.extname(relPath));
    if (base === versionTag) {
      progress = {
        path: relPath,
        heading: pf.heading || ""
      };
      break;
    }
  }

  return {
    versionTag,
    review: {
      path: chosen.path,
      heading: chosen.heading || ""
    },
    progress
  };
}

module.exports = {
  CONFIG_FILENAME,
  log,
  error,
  runGit,
  loadConfig,
  saveConfig,
  listMarkdownFiles,
  readFirstHeading,
  buildSummary,
  findCurrentReviewAndProgress
};

