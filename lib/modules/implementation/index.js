/**
 * Implementation module - Actions for implementing features
 */

const fs = require("fs");
const path = require("path");
const workstreamOps = require("./workstream-operations");
const { execSync } = require("child_process");

/**
 * Launch planning agent to generate version plan
 */
async function launchPlanningAgent(inputs, context) {
  const { 
    versionTag,
    currentVersionTag,
    cwd = process.cwd(),
    agentType = "cursor",
    autoMerge = false, // Automatically merge agent branch when completed
    mergeStrategy = "merge" // merge, squash, rebase
  } = inputs;
  const { logger } = context;

  logger.info(`Launching planning agent for version ${versionTag}`);

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

      // Build planning prompt
      const planningPrompt = `Generate a comprehensive plan for version ${versionTag} of this project.

Context:
- Current version: ${currentVersionTag || "N/A"}
- New version: ${versionTag}
- Project location: ${cwd}

Task:
1. Analyze the current project state, recent changes, and codebase structure
2. Review the previous version's review and progress files (if available)
3. Generate a detailed plan organized into workstreams:
   - Create up to 3 workstreams (Workstream A, Workstream B, Workstream C)
   - Each workstream should contain up to 3 goals
   - Each set of goals should be solvable in one workstream
   - Goals should be logically grouped by theme/feature area
   - Each workstream should be independent and can be worked on in parallel

Output:
Create or update the file: versions/v${versionTag.split("-")[0]}/${versionTag}/01_plan/goals.md

The goals.md file should follow this structure:
# Version ${versionTag} Goals

## Primary Objectives

### Workstream A: [Theme/Feature Area Name]
- [ ] Goal A1 - [Description]
- [ ] Goal A2 - [Description]
- [ ] Goal A3 - [Description] (optional, max 3 goals per workstream)

### Workstream B: [Theme/Feature Area Name]
- [ ] Goal B1 - [Description]
- [ ] Goal B2 - [Description]
- [ ] Goal B3 - [Description] (optional, max 3 goals per workstream)

### Workstream C: [Theme/Feature Area Name]
- [ ] Goal C1 - [Description]
- [ ] Goal C2 - [Description]
- [ ] Goal C3 - [Description] (optional, max 3 goals per workstream)

## Success Criteria
- Criterion 1
- Criterion 2
...

## Key Features
- Feature 1
- Feature 2
...

## Technical Considerations
- Consideration 1
- Consideration 2
...

IMPORTANT: 
- Organize goals into exactly 3 workstreams (A, B, C) if you have enough goals
- Each workstream should have 1-3 goals (preferably 3)
- Each workstream's goals should be related and solvable together
- Workstreams should be independent and can be worked on in parallel
- If you have fewer than 9 goals total, distribute them across workstreams (e.g., 3-3-3, 3-2-2, 2-2-1)
- Each workstream should have a clear theme/feature area name

Follow kaczmarek.ai-dev principles:
- Focus on incremental, testable improvements
- Keep goals specific and actionable
- Consider the project's current state and direction
- Align with previous version's learnings`;

      logger.info(`Launching Cursor Cloud Agent for planning: ${repository}`);
      
      const result = await cursorCloudAgent.actions["launch"]({
        prompt: planningPrompt,
        repository,
        branch: null // Will auto-detect from git or default to "main"
      }, context);

      // Store agent info for status tracking
      const agentTask = {
        id: result.agentId,
        versionTag: versionTag,
        type: "cursor-cloud",
        prompt: planningPrompt,
        taskType: "planning",
        cwd,
        status: result.status,
        cloudAgentId: result.agentId,
        startedAt: new Date().toISOString(),
        autoMerge: autoMerge, // Store auto-merge preference
        mergeStrategy: mergeStrategy // Store merge strategy
      };

      // Save to queue for status tracking
      const queueDir = path.join(cwd, ".kaczmarek-ai", "agent-queue");
      if (!fs.existsSync(queueDir)) {
        fs.mkdirSync(queueDir, { recursive: true });
      }
      const taskFile = path.join(queueDir, `${agentTask.id}.json`);
      fs.writeFileSync(taskFile, JSON.stringify(agentTask, null, 2));

      logger.info(`Planning agent launched: ${result.agentId}`);
      logger.info(`Monitor status with: kad agent status ${result.agentId}`);

      return {
        success: true,
        agentTaskId: result.agentId,
        cloudAgentId: result.agentId,
        status: result.status,
        message: `Planning agent launched. Monitor at: https://cursor.com/agents/${result.agentId}`
      };
    } catch (error) {
      logger.error(`Failed to launch planning Cloud Agent: ${error.message}`);
      throw error;
    }
  } else {
    logger.warn(`CURSOR_API_KEY not set or agentType is not "cursor". Cannot launch planning agent.`);
    return {
      success: false,
      error: "CURSOR_API_KEY environment variable is required for planning agent"
    };
  }
}

module.exports = {
  name: "implementation",
  version: "1.0.0",
  description: "Actions for implementing features and code changes",
  actions: {
    /**
     * Extract next steps from review file
     */
    "extract-next-steps": async (inputs, context) => {
      const { reviewFile } = inputs;
      const { logger } = context;

      if (!fs.existsSync(reviewFile)) {
        return {
          success: false,
          error: `Review file not found: ${reviewFile}`
        };
      }

      const content = fs.readFileSync(reviewFile, "utf8");
      const lines = content.split("\n");

      // Find "Next Steps" section
      let inNextSteps = false;
      const nextSteps = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for "Next Steps" heading
        if (line.match(/^#+\s*Next\s+Steps/i) || line.match(/^##\s*Next\s+Steps/i)) {
          inNextSteps = true;
          continue;
        }

        // Stop at next major section
        if (inNextSteps && line.match(/^##\s+/)) {
          break;
        }

        // Collect task items
        if (inNextSteps) {
          // Match markdown task items: - [ ] or - [x] or just -
          const taskMatch = line.match(/^[-*]\s*(\[[\sx]\]\s*)?(.+)$/i);
          if (taskMatch) {
            const taskText = taskMatch[2].trim();
            const isCompleted = taskMatch[1] && taskMatch[1].includes("x");
            
            // Filter out placeholder/meta-tasks
            const isPlaceholder = /^(add|create|fill|to be filled|placeholder|todo|tbd)/i.test(taskText) &&
              /(next steps|goals|this version|as work progresses|to be filled)/i.test(taskText);
            
            if (!isCompleted && taskText && !isPlaceholder) {
              nextSteps.push({
                text: taskText,
                line: i + 1,
                completed: false
              });
            }
          }
        }
      }

      logger.info(`Found ${nextSteps.length} next steps in review file`);

      return {
        success: true,
        nextSteps,
        count: nextSteps.length
      };
    },

    /**
     * Generate implementation prompt
     */
    "generate-implementation-prompt": async (inputs, context) => {
      const { summary, reviewContent, progressContent, nextSteps, versionTag } = inputs;
      const { logger } = context;

      logger.info("Generating implementation prompt...");

      // Ensure summary is properly serialized
      const summaryJson = typeof summary === "string" ? summary : JSON.stringify(summary || {}, null, 2);
      const nextStepsArray = Array.isArray(nextSteps) ? nextSteps : [];

      const prompt = [
        "You are an AI development assistant (kaczmarek.ai-dev style).",
        "",
        "You are helping to *implement* the next concrete work items from the current version review and keep the review/progress documents aligned with the actual codebase.",
        "",
        "Your work MUST align with the kaczmarek.ai-dev concept documented in `docs/concept.md`.",
        "",
        `Current version tag: ${versionTag || "unknown"}`,
        "",
        "Repository summary:",
        "```json",
        summaryJson,
        "```",
        "",
        "Current review file content:",
        "```markdown",
        reviewContent || "(empty or not found)",
        "```",
        "",
        progressContent ? "Current progress file content:" : "",
        progressContent ? "```markdown" : "",
        progressContent || "",
        progressContent ? "```" : "",
        "",
        "Next Steps from Review:",
        "```json",
        JSON.stringify(nextStepsArray, null, 2),
        "```",
        "",
        "Goals:",
        "- Read the current version review file and especially its \"Next Steps\" / plan section.",
        "- Identify 1–3 very small, concrete implementation tasks that move the version forward.",
        "- For each task, specify which files to change, what to change, and how to verify it (tests/commands/manual checks).",
        "- After each task, ensure the progress file gains a clear dated entry and suggest any necessary tweaks to the review file.",
        "- Align all suggestions with the kaczmarek.ai-dev principles (local-first, Cursor-first, review+progress pairing, small test-driven iterations).",
        "",
        "Constraints:",
        "- Prefer small, incremental tasks over broad refactors.",
        "- Do not assume the ability to run commands; instead, describe the commands or file edits the user should perform.",
        "- Respect existing project conventions, naming, and tone in the review/progress documents.",
        "",
        "Output:",
        "- A short plan listing 1–3 concrete tasks (with file paths and verification steps) derived from the current review.",
        "- For the first task, a more detailed description of the code/doc changes to make and how to reflect them in the progress and (if needed) review files.",
        "- Optional suggestions for how to break further work into additional sessions."
      ].filter(Boolean).join("\n");

      logger.info("Generated implementation prompt:");
      logger.info("=".repeat(80));
      logger.info(prompt);
      logger.info("=".repeat(80));

      return {
        success: true,
        prompt
      };
    },

    /**
     * Run tests (generic test runner)
     */
    "run-tests": async (inputs, context) => {
      const { cwd = process.cwd(), testCommand = "npm test" } = inputs;
      const { logger } = context;

      logger.info(`Running tests: ${testCommand}`);

      try {
        const result = execSync(testCommand, {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        });

        return {
          success: true,
          passed: true,
          output: result,
          exitCode: 0
        };
      } catch (error) {
        return {
          success: false,
          passed: false,
          output: error.stdout || error.stderr || error.message,
          exitCode: error.status || 1
        };
      }
    },

    /**
     * Check git status
     */
    "check-git-status": async (inputs, context) => {
      const { cwd = process.cwd() } = inputs;
      const { logger } = context;

      try {
        const status = execSync("git status --short", {
          cwd,
          encoding: "utf8"
        }).trim();

        const files = status
          .split("\n")
          .filter(line => line.trim())
          .map(line => {
            const [statusCode, ...fileParts] = line.trim().split(/\s+/);
            return {
              status: statusCode,
              file: fileParts.join(" ")
            };
          });

        return {
          success: true,
          hasChanges: files.length > 0,
          files,
          count: files.length
        };
      } catch (error) {
        logger.warn("Git status check failed:", error.message);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Create implementation plan
     */
    "create-plan": async (inputs, context) => {
      const { nextSteps, maxTasks = 3 } = inputs;
      const { logger } = context;

      // Ensure nextSteps is an array
      const stepsArray = Array.isArray(nextSteps) ? nextSteps : [];
      const maxTasksNum = typeof maxTasks === "string" ? parseInt(maxTasks, 10) : (maxTasks || 3);

      logger.info(`Creating implementation plan from ${stepsArray.length} next steps (max ${maxTasksNum} tasks)`);

      // Select first N uncompleted tasks
      const selectedTasks = stepsArray
        .filter(step => !step.completed)
        .slice(0, maxTasksNum);

      const plan = {
        tasks: selectedTasks.map((task, index) => ({
          id: `task-${index + 1}`,
          description: task.text,
          priority: index + 1,
          estimatedTime: "30-60 minutes"
        })),
        totalTasks: selectedTasks.length
      };

      return {
        success: true,
        plan
      };
    },

    /**
     * Create workstream
     */
    "create-workstream": workstreamOps.createWorkstream,

    /**
     * Update workstream progress
     */
    "update-workstream-progress": workstreamOps.updateWorkstreamProgress,

    /**
     * List workstreams
     */
    "list-workstreams": workstreamOps.listWorkstreams,

    /**
     * Consolidate workstreams
     */
    "consolidate-workstreams": workstreamOps.consolidateWorkstreams,

    /**
     * Launch planning agent to generate version plan
     */
    "launch-planning-agent": launchPlanningAgent,

    /**
     * Automatically create workstreams from goals.md
     */
    "create-workstreams-from-goals": workstreamOps.createWorkstreamsFromGoals
  }
};

