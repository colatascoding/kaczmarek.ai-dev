# Cloud Agents Design Summary

## Problem Statement

Users want to:
1. **Opt-in/opt-out** of cloud agents explicitly
2. Use **different agent modes** for different scenarios
3. Understand how **scheduling and orchestration** works

## Solution Overview

### 1. Opt-in/Opt-out System

**Three Levels of Control:**

1. **Global Level** - Enable/disable cloud agents entirely
   ```bash
   kad cloud-agent --enable-global
   kad cloud-agent --disable-global
   ```

2. **Mode Level** - Enable/disable specific modes
   ```json
   {
     "cloudAgents": {
       "modes": {
         "interactive": { "enabled": true },
         "background": { "enabled": false }
       }
     }
   }
   ```

3. **Command Level** - Override per-command
   ```bash
   kad cloud-agent --force "Task"  # Force cloud
   kad cloud-agent --local "Task"  # Force local
   ```

**Key Principle**: Cloud agents are **opt-in by default** - they never run automatically without explicit user consent.

### 2. Agent Modes

**Five Distinct Modes:**

| Mode | Purpose | Auto-Approve | Use When |
|------|---------|--------------|----------|
| **interactive** | Goal-oriented tasks | No | Implementing features, refactoring |
| **background** | Long-running tasks | Yes | Large refactors, comprehensive updates |
| **scheduled** | Periodic maintenance | Yes | Daily/weekly automated tasks |
| **review** | Doc maintenance | No | Syncing review/progress docs |
| **rules** | Rule generation | No | Creating/updating Cursor rules |

Each mode has:
- Independent enable/disable
- Custom configuration (runtime, model, etc.)
- Specific use cases

### 3. Orchestration System

**Queue-Based Architecture:**

```
┌─────────────────┐
│  User Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Opt-in Check   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Queue Manager  │
│  - Immediate    │
│  - Background   │
│  - Scheduled    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent Launcher │
│  (Max: 1)       │
└─────────────────┘
```

**Key Features:**
- **Priority-based queuing** - Interactive tasks get priority
- **Concurrency control** - Max 1 agent running (configurable)
- **Retry logic** - Automatic retries on failure
- **State tracking** - Full visibility into agent status

**Scheduling:**
- **Immediate** - User-initiated tasks start immediately if capacity available
- **Scheduled** - Cron-like scheduling for periodic tasks
- **Background** - Long-running tasks queued separately

## Configuration Example

```json
{
  "cloudAgents": {
    "enabled": true,
    "defaultMode": "interactive",
    "modes": {
      "interactive": {
        "enabled": true,
        "autoApprove": false,
        "maxRuntime": 3600
      },
      "scheduled": {
        "enabled": false,
        "schedules": [
          {
            "name": "Daily Progress",
            "cron": "0 9 * * *",
            "task": "Update progress log",
            "enabled": true
          }
        ]
      }
    },
    "orchestration": {
      "maxConcurrent": 1,
      "queueStrategy": "fifo",
      "retryOnFailure": true
    }
  }
}
```

## Usage Examples

### Example 1: Interactive Feature Implementation

```bash
# User wants cloud agent for feature work
kad cloud-agent --mode interactive "Add user profile page"

# Agent runs, user can monitor
kad cloud-agent --status

# Agent completes, creates PR for review
```

### Example 2: Scheduled Daily Updates

```bash
# Configure scheduled agent
kad cloud-agent --config
# Enable scheduled mode, set to run daily at 9 AM

# Agent runs automatically each day
# Updates progress log
# Creates PR for review
```

### Example 3: Background Refactor

```bash
# Start long-running refactor
kad cloud-agent --mode background "Refactor auth system"

# Agent runs in background
# User continues working
# Notification when complete
```

## Integration Points

### With Existing Commands

```bash
# Enhanced existing commands with --cloud flag
kad progress --cloud      # Use cloud agent for progress sync
kad rules-generate --cloud # Use cloud agent for rules
kad run --cloud           # Use cloud agent for implementation
```

### With cursor-goal.js

```javascript
// Enhanced cursor-goal with cloud option
node cursor-goal.js --cloud "Implement feature"
```

## Benefits

1. **User Control** - Explicit opt-in at multiple levels
2. **Flexibility** - Different modes for different needs
3. **Transparency** - Clear visibility into scheduling and execution
4. **Cost Management** - Usage tracking and budget limits
5. **Safety** - Privacy mode respect, approval requirements

## Next Steps

1. Review and refine design based on feedback
2. Implement configuration system
3. Integrate with Cursor Cloud Agent API
4. Build queue and orchestration system
5. Add monitoring and notifications

## Related Documents

- [`CLOUD_AGENTS_DESIGN.md`](CLOUD_AGENTS_DESIGN.md) - Full design document
- [`CLOUD_AGENTS_QUICK_REF.md`](CLOUD_AGENTS_QUICK_REF.md) - Quick reference guide
- [`examples/cloud-agent-config.json`](../examples/cloud-agent-config.json) - Example configuration
- [`examples/orchestration-diagram.md`](../examples/orchestration-diagram.md) - Visual diagrams

