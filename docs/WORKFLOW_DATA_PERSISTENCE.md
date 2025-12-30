# Workflow Data Persistence

## What Should Be in the Repository

### ✅ Version Controlled (Committed to Git)

1. **Workflow Definitions** (`workflows/*.yaml`)
   - Workflow YAML files are version controlled
   - These define the workflow structure and logic
   - Shared across team members
   - Example: `workflows/implement-feature.yaml`

2. **Module Definitions** (`lib/modules/`)
   - Module code and actions
   - Shared functionality
   - Example: `lib/modules/testing/index.js`

3. **Configuration** (`kaczmarek-ai.config.json`)
   - Project configuration
   - Workflow directory paths
   - Shared settings

### ❌ NOT in Repository (Gitignored)

1. **Execution Database** (`.kaczmarek-ai/workflows.db`)
   - SQLite database with execution state
   - Contains runtime data (executions, step results, history)
   - User-specific and ephemeral
   - **Location**: `.kaczmarek-ai/workflows.db`

2. **Execution State**
   - Current workflow executions
   - Step execution results
   - Execution history
   - All stored in the database

3. **Temporary Files**
   - Logs
   - Cache files
   - Temporary execution data

## Data Storage Locations

### Workflow Definitions (Version Controlled)

```
your-project/
└── workflows/
    ├── implement-feature.yaml    ✅ In repo
    ├── refactor-code.yaml         ✅ In repo
    └── bug-fix.yaml               ✅ In repo
```

### Execution State (NOT in Repo)

```
your-project/
└── .kaczmarek-ai/
    └── workflows.db               ❌ Gitignored
```

## Database Structure

The SQLite database (`.kaczmarek-ai/workflows.db`) contains:

- **workflows** - Cached workflow definitions (also in YAML)
- **executions** - Runtime execution state
- **step_executions** - Individual step results
- **execution_history** - Audit trail

**This database is:**
- ✅ Local to each developer
- ✅ Not shared via git
- ✅ Can be deleted and recreated
- ✅ Contains only runtime/execution data

## Why This Separation?

### Workflow Definitions (YAML) - In Repo
- **Shared** - Team members use the same workflows
- **Versioned** - Changes tracked in git
- **Collaborative** - Team can improve workflows together
- **Reproducible** - Same workflow definition for everyone

### Execution State (Database) - NOT in Repo
- **Personal** - Each developer has their own executions
- **Ephemeral** - Can be cleared without losing workflows
- **Large** - Execution history can grow large
- **Context-specific** - Tied to local environment

## Migration and Sharing

### Sharing Workflows
Workflows are shared via git:
```bash
git add workflows/my-workflow.yaml
git commit -m "Add new workflow"
git push
```

### Sharing Execution Data (Optional)
If you need to share execution data:
1. Export from database
2. Share via other means (not git)
3. Import into another database

**Note**: Execution data is typically not shared - each developer runs their own workflows.

## Backup and Recovery

### Workflow Definitions
- Backed up via git
- Can be restored from repository
- No manual backup needed

### Execution State
- Can be backed up by copying `.kaczmarek-ai/workflows.db`
- Can be deleted and recreated (workflows reload from YAML)
- Not critical for recovery (workflows are in YAML)

## .gitignore Configuration

The `.gitignore` file ensures execution data is not committed:

```gitignore
# Workflow execution database
.kaczmarek-ai/
*.db
*.db-shm
*.db-wal
```

## Best Practices

1. **Commit workflow YAML files** - These are your workflow definitions
2. **Don't commit the database** - Execution state is local
3. **Document workflows** - Add comments in YAML for clarity
4. **Version workflows** - Use version field in YAML
5. **Clear database if needed** - Can delete `.kaczmarek-ai/` to start fresh

## Example: Adding a New Workflow

1. **Create workflow file**:
   ```bash
   # Create workflows/my-new-workflow.yaml
   ```

2. **Commit to git**:
   ```bash
   git add workflows/my-new-workflow.yaml
   git commit -m "Add new workflow"
   ```

3. **Database auto-updates**:
   - When workflow is loaded, it's cached in database
   - No manual database update needed
   - Database is gitignored (not committed)

## Summary

| Item | Location | In Repo? | Why |
|------|----------|----------|-----|
| Workflow YAML | `workflows/*.yaml` | ✅ Yes | Shared definitions |
| Module code | `lib/modules/` | ✅ Yes | Shared functionality |
| Execution DB | `.kaczmarek-ai/workflows.db` | ❌ No | Local runtime state |
| Execution history | Database | ❌ No | Ephemeral data |
| Config | `kaczmarek-ai.config.json` | ✅ Yes | Project settings |

**Key Principle**: Definitions (YAML) are version controlled, execution state (database) is local-only.




