# Getting Started with kaczmarek.ai-dev

Welcome! This guide will help you get started with `kaczmarek.ai-dev`, an AI development companion designed to work alongside your codebase.

## What is kaczmarek.ai-dev?

`kaczmarek.ai-dev` is a **local-first, Cursor-first** AI development companion that:
- Understands your **review + progress** workflow (`review/versionX-Y.md` + `progress/versionX-Y.md`)
- Uses **local tools** (builds, tests, HTTP APIs) instead of opaque remote pipelines
- Helps you iterate in **small, test-driven steps** with clear verification

## Prerequisites

Before you begin, make sure you have:

1. **Node.js** (v14 or higher) - The CLI is written in Node.js
2. **Git** - For version control and change tracking
3. **Cursor IDE** (optional but recommended) - For the best experience with AI assistance
4. **Cursor CLI** (optional) - For background tasks (`cursor-agent`)

### Installing Cursor CLI (Optional)

If you want to use the `rules-generate` command or `cursor-goal`, you'll need the Cursor CLI:

```bash
# Check if cursor-agent is installed
node ./kaczmarek.ai-dev/bin/cursor-setup.js

# Install if needed
node ./kaczmarek.ai-dev/bin/cursor-setup.js --install
```

## Quick Start (5 minutes)

### Step 1: Clone or Navigate to Your Project

```bash
cd /path/to/your/project
```

### Step 2: Initialize kaczmarek.ai-dev

```bash
# If kaczmarek.ai-dev is cloned next to your project
node ./kaczmarek.ai-dev/bin/kad.js init

# Or if installed globally (future)
kad init
```

This creates a `kaczmarek-ai.config.json` file with sensible defaults.

### Step 3: Scan Your Repository

```bash
node ./kaczmarek.ai-dev/bin/kad.js scan
```

This analyzes your project structure and outputs a JSON summary of:
- Documentation files
- Review and progress directories
- AI-related folders (agents, tools, workflows, prompts)

### Step 4: Check for Existing Rules

```bash
node ./kaczmarek.ai-dev/bin/kad.js rules-check
```

This shows you if you already have Cursor rules configured.

### Step 5: Generate Rules (Optional)

If you want to create Cursor rules for your project:

```bash
node ./kaczmarek.ai-dev/bin/kad.js rules-generate
```

This launches an interactive session to analyze your codebase and create appropriate rules.

## Understanding the Project Structure

After running `kad init`, your project will have (or you should create):

```
your-project/
  kaczmarek-ai.config.json    # Configuration file (created by kad init)
  docs/                       # General documentation
  review/                     # Version review files (review/versionX-Y.md)
  progress/                   # Progress logs (progress/versionX-Y.md)
  agents/                     # AI agent configurations (optional)
  tools/                      # Local tools and scripts (optional)
  workflows/                  # Workflow documentation (optional)
  prompts/                    # AI prompts and templates (optional)
```

## Common Workflows

### 1. Starting a New Version

1. Create `review/version0-12.md` with your goals
2. Create `progress/version0-12.md` for detailed logging
3. Use `kad progress` to get a prompt for maintaining these files

### 2. Implementing Features

```bash
node ./kaczmarek.ai-dev/bin/kad.js run
```

This generates a prompt that helps you:
- Read the current review's "Next Steps"
- Implement 1-3 small, concrete tasks
- Keep progress and review docs in sync

### 3. Analyzing Recent Changes

```bash
node ./kaczmarek.ai-dev/bin/kad.js changes
```

This compares recent git changes with your review/progress docs and suggests updates.

### 4. Getting AI Help

```bash
node ./kaczmarek.ai-dev/bin/kad.js ai
```

This generates a ready-to-paste prompt for Cursor Chat that includes your project structure.

## Configuration File

The `kaczmarek-ai.config.json` file looks like this:

```json
{
  "version": 1,
  "projectName": "your-project",
  "docs": {
    "docsDir": "docs",
    "reviewDir": "review",
    "progressDir": "progress"
  },
  "ai": {
    "agentsDir": "agents",
    "toolsDir": "tools",
    "workflowsDir": "workflows",
    "promptsDir": "prompts"
  },
  "timeline": {
    "diagramFile": "docs/TIMELINE.mmd"
  }
}
```

You can edit this file to match your project's actual structure.

## Using with Cursor

### Option 1: Manual Prompts

1. Run any `kad` command to get a prompt
2. Copy the output
3. Paste into Cursor Chat

### Option 2: Cursor CLI (cursor-agent)

```bash
# Set up Cursor CLI first
node ./kaczmarek.ai-dev/bin/cursor-setup.js --install

# Use cursor-goal for goal-oriented sessions
node ./kaczmarek.ai-dev/bin/cursor-goal.js "Add user authentication"
```

### Option 3: Rules System

Create Cursor rules that automatically apply to your project:

```bash
# Check existing rules
node ./kaczmarek.ai-dev/bin/kad.js rules-check

# Generate rules interactively
node ./kaczmarek.ai-dev/bin/kad.js rules-generate
```

## Example: First Session

Here's what a typical first session looks like:

```bash
# 1. Initialize
node ./kaczmarek.ai-dev/bin/kad.js init

# 2. Check what we have
node ./kaczmarek.ai-dev/bin/kad.js scan

# 3. Check for rules
node ./kaczmarek.ai-dev/bin/kad.js rules-check

# 4. Get AI help (paste output into Cursor Chat)
node ./kaczmarek.ai-dev/bin/kad.js ai

# 5. Or use cursor-goal for interactive session
node ./kaczmarek.ai-dev/bin/cursor-goal.js "Set up project structure"
```

## Troubleshooting

### "cursor-agent: command not found"

Install the Cursor CLI:
```bash
node ./kaczmarek.ai-dev/bin/cursor-setup.js --install
```

### "No current review file found"

Create a review file:
```bash
mkdir -p review progress
echo "# Version 0-1" > review/version0-1.md
echo "# Progress Log" > progress/version0-1.md
```

### Commands not working

Make sure you're running from your project root and that Node.js is installed:
```bash
node --version  # Should be v14+
```

## Next Steps

1. **Read the concept**: See `docs/concept.md` for the full philosophy
2. **Explore workflows**: Check `workflows/version_review.md` for detailed workflows
3. **Customize**: Edit `kaczmarek-ai.config.json` to match your project
4. **Create rules**: Use `kad rules-generate` to create project-specific Cursor rules

## Getting Help

- Check the main `README.md` for command reference
- Read `docs/concept.md` for the full philosophy
- Review `workflows/version_review.md` for example workflows

## Command Reference

| Command | Description |
|---------|-------------|
| `kad init` | Initialize configuration file |
| `kad scan` | Scan and summarize project structure |
| `kad ai` | Generate AI prompt with project context |
| `kad progress` | Get prompt for maintaining review/progress |
| `kad run` | Get prompt for implementing next tasks |
| `kad changes` | Analyze recent git changes vs docs |
| `kad timeline` | Generate/update Mermaid timeline diagram |
| `kad rules-check` | Check for existing Cursor rules |
| `kad rules-generate` | Interactively create Cursor rules |
| `kad --help` | Show all available commands |

