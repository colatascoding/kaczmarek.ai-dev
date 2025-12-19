# Cloud Agents Quick Reference

## Opt-in/Opt-out

### Global Control
```bash
# Enable cloud agents globally
kad cloud-agent --enable-global

# Disable cloud agents globally
kad cloud-agent --disable-global

# Check status
kad cloud-agent --status
```

### Per-command Control
```bash
# Force cloud agent (even if disabled)
kad cloud-agent --force "Task"

# Force local agent (even if enabled)
kad cloud-agent --local "Task"
```

### Mode-level Control
```bash
# Enable a specific mode
kad cloud-agent --enable-mode interactive

# Disable a specific mode
kad cloud-agent --disable-mode scheduled
```

## Agent Modes

| Mode | Use Case | Auto-approve | Typical Runtime |
|------|----------|--------------|-----------------|
| `interactive` | Feature implementation, refactoring | No | 30-60 min |
| `background` | Long-running tasks | Yes | 1-2 hours |
| `scheduled` | Periodic maintenance | Yes | 15-30 min |
| `review` | Doc maintenance | No | 5-10 min |
| `rules` | Rule generation | No | 10-15 min |

## Common Commands

```bash
# Start interactive agent
kad cloud-agent --mode interactive "Implement feature X"

# Start background agent
kad cloud-agent --mode background "Large refactor"

# List active agents
kad cloud-agent --list

# Check agent status
kad cloud-agent --status <agent-id>

# Cancel agent
kad cloud-agent --cancel <agent-id>

# Configure cloud agents
kad cloud-agent --config
```

## Integration with Existing Commands

```bash
# Use cloud agent for progress sync
kad progress --cloud

# Use cloud agent for rules generation
kad rules-generate --cloud

# Use cloud agent for implementation
kad run --cloud
```

## Configuration

Edit `kaczmarek-ai.config.json`:

```json
{
  "cloudAgents": {
    "enabled": true,
    "defaultMode": "interactive",
    "modes": {
      "interactive": { "enabled": true },
      "background": { "enabled": false }
    }
  }
}
```

## Scheduling

### Scheduled Mode Setup

```json
{
  "modes": {
    "scheduled": {
      "enabled": true,
      "schedules": [
        {
          "name": "Daily Progress",
          "cron": "0 9 * * *",
          "task": "Update progress log",
          "enabled": true
        }
      ]
    }
  }
}
```

## Queue Management

```bash
# View queue status
kad cloud-agent --queue

# View queue with details
kad cloud-agent --queue --verbose
```

## Monitoring

```bash
# View agent logs
kad cloud-agent --logs <agent-id>

# View all agent history
kad cloud-agent --history

# View usage statistics
kad cloud-agent --stats
```

## Troubleshooting

### Agent not starting
1. Check opt-in status: `kad cloud-agent --status`
2. Check mode is enabled in config
3. Check queue capacity: `kad cloud-agent --queue`

### Agent stuck
1. Check status: `kad cloud-agent --status <agent-id>`
2. Cancel if needed: `kad cloud-agent --cancel <agent-id>`
3. Check logs: `kad cloud-agent --logs <agent-id>`

### Cost concerns
1. Check usage: `kad cloud-agent --stats`
2. Set budget in config
3. Disable expensive modes

