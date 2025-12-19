# Cloud Agents Design: Opt-in, Modes, and Orchestration

**Version**: 0.1.0  
**Status**: Design Proposal  
**Last updated**: 2025-01-XX

## Overview

This document proposes a design for integrating Cursor Cloud Agents into `kaczmarek.ai-dev` with:
- **Opt-in/opt-out mechanisms** - Users control when cloud agents are used
- **Multiple agent modes** - Different variants for different use cases
- **Scheduling and orchestration** - How agents are scheduled, queued, and managed

## Design Principles

1. **Explicit Opt-in** - Cloud agents never run automatically without user consent
2. **Mode-based Configuration** - Different agent behaviors for different scenarios
3. **Transparent Orchestration** - Clear visibility into agent scheduling and execution
4. **Local-first Fallback** - Always fall back to local agents if cloud agents are unavailable
5. **Cost Awareness** - Users understand when cloud agents are being used

## Architecture

### 1. Configuration System

#### `kaczmarek-ai.config.json` Extension

Add a new `cloudAgents` section to the configuration:

```json
{
  "version": 1,
  "projectName": "your-project",
  "docs": { ... },
  "ai": { ... },
  "cloudAgents": {
    "enabled": false,
    "defaultMode": "interactive",
    "modes": {
      "interactive": {
        "enabled": true,
        "description": "Interactive cloud agent for goal-oriented tasks",
        "autoApprove": false,
        "maxRuntime": 3600,
        "model": null
      },
      "background": {
        "enabled": false,
        "description": "Background agent for long-running tasks",
        "autoApprove": true,
        "maxRuntime": 7200,
        "model": null
      },
      "scheduled": {
        "enabled": false,
        "description": "Scheduled agent for periodic tasks",
        "schedule": "0 9 * * *",
        "autoApprove": true,
        "maxRuntime": 1800,
        "model": null
      },
      "review": {
        "enabled": false,
        "description": "Agent for maintaining review/progress docs",
        "autoApprove": false,
        "maxRuntime": 600,
        "model": null
      },
      "rules": {
        "enabled": false,
        "description": "Agent for generating Cursor rules",
        "autoApprove": false,
        "maxRuntime": 900,
        "model": null
      }
    },
    "orchestration": {
      "maxConcurrent": 1,
      "queueStrategy": "fifo",
      "retryOnFailure": true,
      "maxRetries": 3,
      "notifications": {
        "onStart": false,
        "onComplete": true,
        "onFailure": true
      }
    }
  }
}
```

#### Environment Configuration

Add `.cursor/environment.json` support (for cloud agent setup):

```json
{
  "snapshot": "POPULATED_FROM_SETTINGS",
  "install": "npm install",
  "start": "",
  "terminals": [
    {
      "name": "Dev Server",
      "command": "npm run dev"
    }
  ]
}
```

### 2. Agent Modes

#### Mode: `interactive`

**Purpose**: Goal-oriented, user-driven tasks  
**Use Cases**: 
- Implementing features from review
- Refactoring code
- Adding tests

**Characteristics**:
- Requires explicit user request
- User can monitor and interact
- Auto-approval: false (user reviews changes)
- Typical runtime: 30-60 minutes

**Example**:
```bash
kad cloud-agent --mode interactive "Implement user authentication"
```

#### Mode: `background`

**Purpose**: Long-running, autonomous tasks  
**Use Cases**:
- Large refactors
- Comprehensive test generation
- Documentation updates

**Characteristics**:
- Can run without immediate user attention
- Auto-approval: true (creates PR for review)
- Typical runtime: 1-2 hours
- Runs in background, notifies on completion

**Example**:
```bash
kad cloud-agent --mode background "Refactor authentication system"
```

#### Mode: `scheduled`

**Purpose**: Periodic maintenance tasks  
**Use Cases**:
- Daily review/progress updates
- Weekly documentation sync
- Periodic code health checks

**Characteristics**:
- Runs on a schedule (cron-like)
- Auto-approval: true
- Typical runtime: 15-30 minutes
- Can be enabled/disabled per schedule

**Example**:
```bash
kad cloud-agent --mode scheduled --schedule "0 9 * * *" "Update progress log"
```

#### Mode: `review`

**Purpose**: Maintaining review/progress documentation  
**Use Cases**:
- Syncing progress with review
- Updating version docs
- Analyzing recent changes

**Characteristics**:
- Quick, focused tasks
- Auto-approval: false (docs need review)
- Typical runtime: 5-10 minutes
- Integrates with `kad progress` and `kad changes`

**Example**:
```bash
kad cloud-agent --mode review "Sync progress with review"
```

#### Mode: `rules`

**Purpose**: Generating and updating Cursor rules  
**Use Cases**:
- Initial rule generation
- Rule updates based on codebase changes
- Rule maintenance

**Characteristics**:
- Interactive rule creation
- Auto-approval: false (rules need review)
- Typical runtime: 10-15 minutes
- Integrates with `kad rules-generate`

**Example**:
```bash
kad cloud-agent --mode rules "Update rules for new patterns"
```

### 3. Opt-in/Opt-out Mechanisms

#### Global Opt-in/Opt-out

**Configuration Level**:
```json
{
  "cloudAgents": {
    "enabled": false  // Global opt-out
  }
}
```

**Command Level**:
```bash
# Opt-in for this session
kad cloud-agent --enable "Your task"

# Opt-out (even if globally enabled)
kad cloud-agent --disable "Your task"

# Check status
kad cloud-agent --status
```

#### Mode-level Opt-in/Opt-out

Each mode can be individually enabled/disabled:

```json
{
  "cloudAgents": {
    "enabled": true,
    "modes": {
      "interactive": { "enabled": true },
      "background": { "enabled": false },  // Opted out
      "scheduled": { "enabled": false }
    }
  }
}
```

#### Per-command Override

```bash
# Force cloud agent (even if disabled)
kad cloud-agent --force "Task"

# Force local agent (even if cloud enabled)
kad cloud-agent --local "Task"
```

### 4. Scheduling and Orchestration

#### Queue System

**Queue Types**:
1. **Immediate Queue** - User-initiated tasks (interactive, review, rules)
2. **Background Queue** - Long-running tasks (background mode)
3. **Scheduled Queue** - Time-based tasks (scheduled mode)

**Queue Management**:
```json
{
  "orchestration": {
    "maxConcurrent": 1,           // Max agents running simultaneously
    "queueStrategy": "fifo",      // fifo | priority | round-robin
    "retryOnFailure": true,
    "maxRetries": 3,
    "timeout": 3600,              // Global timeout (seconds)
    "priority": {
      "interactive": 10,
      "review": 8,
      "rules": 7,
      "background": 5,
      "scheduled": 3
    }
  }
}
```

#### Agent Lifecycle

```
1. Request → Queue
   ↓
2. Check Opt-in Status
   ↓
3. Validate Mode Configuration
   ↓
4. Check Queue Capacity
   ↓
5. Start Agent (if capacity available)
   ↓
6. Monitor Execution
   ↓
7. Handle Completion/Failure
   ↓
8. Notify User
   ↓
9. Cleanup
```

#### Orchestration States

```typescript
enum AgentState {
  QUEUED = "queued",
  STARTING = "starting",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMEOUT = "timeout"
}
```

#### Scheduling Implementation

**Immediate Tasks**:
- User runs `kad cloud-agent --mode interactive "Task"`
- Added to immediate queue
- Started if capacity available
- Otherwise queued

**Scheduled Tasks**:
- Defined in config with cron-like schedule
- Evaluated by scheduler
- Added to scheduled queue at appropriate time
- Started when capacity available

**Background Tasks**:
- User runs `kad cloud-agent --mode background "Task"`
- Added to background queue
- Started when capacity available
- Can run concurrently with scheduled tasks (if configured)

### 5. CLI Commands

#### Core Commands

```bash
# Start a cloud agent
kad cloud-agent [--mode <mode>] [--force] [--local] "<task description>"

# List active agents
kad cloud-agent --list

# Check agent status
kad cloud-agent --status [<agent-id>]

# Cancel an agent
kad cloud-agent --cancel <agent-id>

# Configure cloud agents
kad cloud-agent --config

# Enable/disable globally
kad cloud-agent --enable-global
kad cloud-agent --disable-global

# Enable/disable mode
kad cloud-agent --enable-mode <mode>
kad cloud-agent --disable-mode <mode>
```

#### Integration Commands

```bash
# Use cloud agent for progress sync
kad progress --cloud

# Use cloud agent for rules generation
kad rules-generate --cloud

# Use cloud agent for implementation
kad run --cloud
```

### 6. State Management

#### Agent State File

`.kaczmarek-ai/agents/state.json`:

```json
{
  "agents": [
    {
      "id": "agent-123",
      "mode": "interactive",
      "state": "running",
      "task": "Implement user authentication",
      "startedAt": "2025-01-15T10:00:00Z",
      "estimatedCompletion": "2025-01-15T10:30:00Z",
      "branch": "cursor-agent-123",
      "pr": null
    }
  ],
  "queue": {
    "immediate": [],
    "background": [],
    "scheduled": []
  },
  "statistics": {
    "totalAgents": 42,
    "completed": 38,
    "failed": 3,
    "cancelled": 1
  }
}
```

### 7. Notifications and Monitoring

#### Notification Types

1. **Agent Started** - When agent begins execution
2. **Agent Completed** - When agent finishes successfully
3. **Agent Failed** - When agent encounters errors
4. **PR Created** - When agent creates a pull request
5. **Queue Position** - When agent is queued

#### Notification Channels

- CLI output
- File-based logs (`.kaczmarek-ai/agents/logs/`)
- Optional: Slack/Discord webhooks
- Optional: Email notifications

### 8. Integration with Existing Commands

#### Enhanced `cursor-goal.js`

```javascript
// Add cloud agent option
function launchCursorAgent(message, options) {
  const opts = options || {};
  const useCloud = opts.cloud || false;
  const mode = opts.mode || "interactive";
  
  if (useCloud) {
    // Launch cloud agent via Cursor API
    launchCloudAgent(message, { mode });
  } else {
    // Existing local agent logic
    launchLocalAgent(message, options);
  }
}
```

#### Enhanced `kad.js` Commands

```javascript
// kad run with cloud option
function cmdRun(argv) {
  const useCloud = argv.includes("--cloud");
  // ... existing logic
  if (useCloud) {
    launchCloudAgent(prompt, { mode: "interactive" });
  } else {
    // Existing prompt generation
  }
}
```

### 9. Security and Privacy

#### Privacy Mode

- Respect Cursor's privacy mode settings
- Never enable cloud agents if privacy mode is required
- Warn user if privacy mode is disabled

#### Access Control

- Require explicit opt-in for each mode
- Log all cloud agent usage
- Support workspace-level policies

### 10. Cost Management

#### Usage Tracking

```json
{
  "usage": {
    "currentMonth": {
      "agentsRun": 15,
      "totalRuntime": 7200,
      "estimatedCost": 12.50
    },
    "limits": {
      "maxAgentsPerMonth": 100,
      "maxRuntimePerMonth": 36000
    }
  }
}
```

#### Cost Warnings

- Warn before starting expensive operations
- Show estimated cost for long-running agents
- Support budget limits

## Implementation Plan

### Phase 1: Configuration and Opt-in
- [ ] Extend `kaczmarek-ai.config.json` with cloud agent config
- [ ] Add opt-in/opt-out commands
- [ ] Create configuration UI/CLI

### Phase 2: Basic Cloud Agent Integration
- [ ] Integrate with Cursor Cloud Agent API
- [ ] Implement basic agent launching
- [ ] Add state management

### Phase 3: Mode System
- [ ] Implement all agent modes
- [ ] Add mode-specific configurations
- [ ] Create mode selection UI

### Phase 4: Orchestration
- [ ] Implement queue system
- [ ] Add scheduling for scheduled mode
- [ ] Create orchestration dashboard

### Phase 5: Monitoring and Notifications
- [ ] Add notification system
- [ ] Create monitoring dashboard
- [ ] Implement usage tracking

## Example Workflows

### Workflow 1: Interactive Feature Implementation

```bash
# User wants to implement a feature using cloud agent
kad cloud-agent --mode interactive "Add user profile page"

# Agent runs in cloud, user can monitor
kad cloud-agent --status

# Agent completes, creates PR
# User reviews and merges
```

### Workflow 2: Scheduled Progress Updates

```bash
# Configure scheduled agent
kad cloud-agent --config
# Enable scheduled mode, set schedule to "0 9 * * *"

# Agent runs daily at 9 AM
# Updates progress log automatically
# Creates PR for review
```

### Workflow 3: Background Refactor

```bash
# Start background refactor
kad cloud-agent --mode background "Refactor authentication system"

# Agent runs in background
# User continues working
# Notification when complete
```

## Open Questions

1. **API Integration**: How to integrate with Cursor Cloud Agent API? (REST API? CLI?)
2. **State Persistence**: Where to store agent state? (Local file? Remote?)
3. **Multi-user**: How to handle multiple users in same repo?
4. **Cost Tracking**: How to track costs accurately?
5. **Error Handling**: How to handle agent failures gracefully?

## References

- [Cursor Cloud Agents Documentation](https://cursor.com/docs/cloud-agent)
- [Cursor Agent Fundamentals](https://cursor.com/learn/agents)
- Current `kaczmarek.ai-dev` architecture in `docs/concept.md`

