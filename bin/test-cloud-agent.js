#!/usr/bin/env node
/**
 * Quick test script for spawning Cursor Cloud Agent tasks
 * 
 * Usage:
 *   node bin/test-cloud-agent.js "Your task description here"
 *   node bin/test-cloud-agent.js "Add a test file" --repository owner/repo
 */

const path = require("path");
const { loadEnvFile } = require("../lib/api/utils");
const cursorCloudAgent = require("../lib/modules/cursor-cloud-agent");
const { execSync } = require("child_process");

// Load .env file
loadEnvFile(process.cwd());

/**
 * Get git repository identifier (owner/repo or full URL)
 */
function getGitRepository(cwd) {
  try {
    const remoteUrl = execSync("git config --get remote.origin.url", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();

    if (remoteUrl) {
      const match = remoteUrl.match(/(?:github\.com[/:]|gitlab\.com[/:]|bitbucket\.org[/:])([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
      return remoteUrl;
    }
  } catch (e) {
    // Git not available or not a git repo
  }

  return path.basename(cwd);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Usage: node bin/test-cloud-agent.js <prompt> [options]

Options:
  --repository <repo>    Repository identifier (default: auto-detect from git)
  --branch <branch>      Target branch (default: main)
  --mode <mode>          Agent mode: background, interactive (default: background)

Examples:
  node bin/test-cloud-agent.js "Add a test file for the review module"
  node bin/test-cloud-agent.js "Fix linting errors" --repository owner/repo
  node bin/test-cloud-agent.js "Update documentation" --branch develop
`);
    process.exit(0);
  }

  const prompt = args[0];
  let repository = null;
  let branch = null;
  let mode = "background";

  // Parse options
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--repository" && args[i + 1]) {
      repository = args[i + 1];
      i++;
    } else if (args[i] === "--branch" && args[i + 1]) {
      branch = args[i + 1];
      i++;
    } else if (args[i] === "--mode" && args[i + 1]) {
      mode = args[i + 1];
      i++;
    }
  }

  // Auto-detect repository if not provided
  if (!repository) {
    repository = getGitRepository(process.cwd());
    console.log(`📦 Auto-detected repository: ${repository}`);
  }

  // Check for API key
  if (!process.env.CURSOR_API_KEY) {
    console.error(`
❌ CURSOR_API_KEY not found in environment.

Please add it to your .env file:
  ${path.join(process.cwd(), ".env")}

Get your API key from: https://cursor.com/dashboard
`);
    process.exit(1);
  }

  console.log(`\n🚀 Launching Cursor Cloud Agent...\n`);
  console.log(`Prompt: ${prompt}`);
  console.log(`Repository: ${repository}`);
  if (branch) console.log(`Branch: ${branch}`);
  console.log(`Mode: ${mode}\n`);

  try {
    const context = {
      logger: {
        info: (msg) => console.log(`ℹ️  ${msg}`),
        error: (msg) => console.error(`❌ ${msg}`),
        warn: (msg) => console.warn(`⚠️  ${msg}`)
      }
    };

    console.log(`\n📤 Sending request to Cursor API...\n`);
    console.log(`Request details:`);
    console.log(`  - Repository: ${repository}`);
    console.log(`  - Branch: ${branch || "(default)"}`);
    console.log(`  - Mode: ${mode}`);
    console.log(`  - Prompt length: ${prompt.length} characters\n`);

    const result = await cursorCloudAgent.actions["launch"]({
      prompt,
      repository,
      branch,
      mode
    }, context);

    console.log(`\n✅ Cloud Agent launched successfully!\n`);
    console.log(`Agent ID: ${result.agentId}`);
    console.log(`Status: ${result.status}`);
    console.log(`\nMonitor status with:`);
    console.log(`  kad agent status ${result.agentId}`);
    console.log(`\nOr check the dashboard:`);
    console.log(`  https://cursor.com/dashboard/agents/${result.agentId}\n`);

    // Also test getting status
    console.log(`\n📊 Fetching initial status...\n`);
    const statusResult = await cursorCloudAgent.actions["get-status"]({
      agentId: result.agentId
    }, context);

    console.log(`Current Status: ${statusResult.status}`);
    if (statusResult.data) {
      console.log(`Data:`, JSON.stringify(statusResult.data, null, 2));
    }

  } catch (error) {
    console.error(`\n❌ Failed to launch Cloud Agent:\n`);
    console.error(error.message);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Unexpected error:", error);
  process.exit(1);
});

