# Project Structure Guide

This document explains the recommended directory structure for projects using `kaczmarek.ai-dev`.

## Overview

A well-organized project using `kaczmarek.ai-dev` follows this structure:

```
your-project/
├── kaczmarek-ai.config.json    # Configuration (created by kad init)
├── docs/                        # General documentation
│   ├── architecture/           # Architecture docs
│   └── TIMELINE.mmd             # Mermaid timeline diagram (optional)
├── review/                      # Version review files
│   └── version0-1.md           # Review for version 0-1
├── progress/                    # Progress logs
│   └── version0-1.md           # Progress log for version 0-1
├── agents/                      # AI agent configurations (optional)
│   └── reviewer/
│       └── config.yaml
├── tools/                       # Local tools and scripts (optional)
│   └── mirage/
│       └── action_api_client.py
├── workflows/                   # Workflow documentation (optional)
│   └── version_review.md
└── prompts/                     # AI prompts and templates (optional)
    └── tasks/
        └── add-feature.md
```

## Directory Descriptions

### `docs/`

General project documentation. This is where you store:
- Architecture documentation
- Design decisions
- API documentation
- Reference materials

**Example files:**
- `docs/architecture/action-system.md`
- `docs/REFERENCE/api-endpoints.md`
- `docs/TIMELINE.mmd` (Mermaid timeline diagram)

### `review/`

High-level, curated summaries for each version. Each file follows the pattern:
- `review/versionX-Y.md` (e.g., `review/version0-11.md`)

**Purpose:**
- Source of truth for "what this version means"
- High-level summary of changes
- Risks and decisions
- Next steps

**Example structure:**
```markdown
# Version 0-11

## Summary
Brief overview of what this version accomplishes.

## Changes
- Major feature X
- Refactor of component Y

## Risks
- Potential issue Z

## Next Steps
- Task 1
- Task 2
```

### `progress/`

Detailed, chronological implementation logs. Each file matches a review:
- `progress/versionX-Y.md` (e.g., `progress/version0-11.md`)

**Purpose:**
- Granular log of implementation steps
- Detailed notes on decisions
- Verification steps
- Dated entries

**Example structure:**
```markdown
# Progress Log - Version 0-11

## 2025-01-15
- Implemented feature X
- Tested with: `npm test`
- Verified: All tests pass

## 2025-01-16
- Refactored component Y
- Issue encountered: Z
- Solution: ...
```

### `agents/` (Optional)

AI agent configurations. These define how AI assistants should behave for specific tasks.

**Example structure:**
```
agents/
  reviewer/
    config.yaml
    examples.md
  refactorer/
    config.yaml
```

### `tools/` (Optional)

Local tools and scripts that interact with your project.

**Example:**
- `tools/mirage/action_api_client.py` - HTTP client for Action Web API
- `tools/run_tests.sh` - Test runner wrapper

### `workflows/` (Optional)

Workflow documentation that describes repeatable processes.

**Example:**
- `workflows/version_review.md` - How to maintain review/progress pairs
- `workflows/feature_refactor.md` - Safe refactoring process

### `prompts/` (Optional)

AI prompts and templates for common tasks.

**Example structure:**
```
prompts/
  system/
    architect.md
    reviewer.md
  tasks/
    add-tests.md
    integrate-actions.md
```

## Configuration File

The `kaczmarek-ai.config.json` file maps these directories:

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

You can customize these paths to match your project's structure.

## Version Naming Convention

Versions follow the pattern: `versionX-Y`

- `X` = major version (e.g., 0, 1, 2)
- `Y` = minor version (e.g., 1, 2, 11)

**Examples:**
- `version0-1.md` - First version
- `version0-11.md` - Eleventh minor version
- `version1-0.md` - First major version

## Best Practices

1. **Keep reviews concise** - Reviews should be high-level summaries, not detailed logs
2. **Use progress for details** - Put implementation details in progress files
3. **Archive old versions** - Periodically squash/archive older reviews to reduce noise
4. **Match file names** - Review and progress files should have matching version numbers
5. **Keep it organized** - Follow the directory structure, but adapt to your needs

## Getting Started

1. Run `kad init` to create the configuration file
2. Create the directories manually or let `kad onboard` create them
3. Start with your first version: `review/version0-1.md` and `progress/version0-1.md`
4. Use `kad scan` to verify your structure is recognized

## Customization

You can customize the directory structure by editing `kaczmarek-ai.config.json`. For example, if your project uses different names:

```json
{
  "docs": {
    "docsDir": "documentation",
    "reviewDir": "reviews",
    "progressDir": "logs"
  }
}
```

Just make sure the directories exist and match your configuration!

