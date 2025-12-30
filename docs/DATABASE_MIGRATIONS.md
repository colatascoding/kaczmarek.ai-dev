# Database Migration System

## Overview

The database migration system replaces the previous try/catch pattern for schema changes with a proper versioned migration system. This provides better tracking, rollback support, and clearer migration history.

## Architecture

### Components

1. **Migration Class** (`lib/db/migrations.js`)
   - Represents a single migration
   - Contains version, name, up function, and optional down function

2. **MigrationRunner Class** (`lib/db/migrations.js`)
   - Manages migration execution
   - Tracks applied migrations in `schema_migrations` table
   - Supports rollback operations

3. **Default Migrations** (`lib/db/migrations.js`)
   - Pre-defined migrations that replace the old try/catch blocks
   - Automatically registered when database initializes

## Migration Table

The system creates a `schema_migrations` table to track applied migrations:

```sql
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Default Migrations

### Migration 001: `add_version_tag_to_workflows`
- **Purpose**: Adds `version_tag` column to `workflows` table
- **Status**: Applied automatically on database initialization
- **Rollback**: Limited (SQLite doesn't support DROP COLUMN easily)

### Migration 002: `add_outcome_to_executions`
- **Purpose**: Adds `outcome`, `follow_up_suggestions`, `summary`, and `execution_mode` columns to `executions` table
- **Status**: Applied automatically on database initialization

### Migration 003: `add_return_code_to_step_executions`
- **Purpose**: Adds `return_code` column to `step_executions` table
- **Status**: Applied automatically on database initialization

## Usage

### Automatic Execution

Migrations run automatically when the database is initialized:

```javascript
const db = new WorkflowDatabase(dbPath);
// Migrations run automatically in constructor
```

### Manual Migration Status

Check migration status:

```javascript
const migrationRunner = createDefaultMigrations(db);
const status = migrationRunner.getStatus();
console.log(status);
// {
//   total: 3,
//   applied: 3,
//   pending: 0,
//   migrations: [...]
// }
```

### Creating New Migrations

To add a new migration:

1. **Add migration to `createDefaultMigrations` function**:

```javascript
runner.addMigration(new Migration(
  "004",  // Version (must be unique, sequential)
  "add_new_column_to_table",  // Descriptive name
  (db) => {
    // Up migration - apply changes
    const tableInfo = db.prepare("PRAGMA table_info(table_name)").all();
    const columns = tableInfo.map(col => col.name);
    
    if (!columns.includes("new_column")) {
      db.exec("ALTER TABLE table_name ADD COLUMN new_column TEXT");
    }
  },
  (db) => {
    // Down migration - rollback changes (optional)
    // Note: SQLite has limited DROP COLUMN support
    logger.warn("Rollback not fully supported for this migration");
  }
));
```

2. **Migration Best Practices**:
   - Use sequential version numbers (001, 002, 003, ...)
   - Use descriptive names (snake_case)
   - Check if changes already exist before applying
   - Use transactions for atomicity
   - Document any SQLite limitations

### Rollback

Rollback the last migration:

```javascript
const migrationRunner = createDefaultMigrations(db);
const result = await migrationRunner.rollbackLast();
```

**Note**: Rollback support is limited by SQLite's capabilities. Some migrations may not support full rollback.

## Migration Execution Flow

```
Database Initialization
    ↓
Initialize Base Schema (CREATE TABLE IF NOT EXISTS)
    ↓
Create Migration Runner
    ↓
Check Applied Migrations
    ↓
For Each Pending Migration:
    BEGIN TRANSACTION
        ↓
    Execute Migration.up()
        ↓
    Mark as Applied
        ↓
    COMMIT
    ↓
Database Ready
```

## Error Handling

- Migrations run in transactions for atomicity
- If a migration fails, it's rolled back
- Database continues with existing schema (backward compatible)
- Errors are logged but don't prevent database initialization

## Migration Status Tracking

The system tracks:
- **Version**: Unique identifier for the migration
- **Name**: Human-readable migration name
- **Applied At**: Timestamp when migration was applied

## Examples

### Example: Adding a New Column

```javascript
runner.addMigration(new Migration(
  "004",
  "add_status_to_workflows",
  (db) => {
    const tableInfo = db.prepare("PRAGMA table_info(workflows)").all();
    const hasStatus = tableInfo.some(col => col.name === "status");
    
    if (!hasStatus) {
      db.exec("ALTER TABLE workflows ADD COLUMN status TEXT DEFAULT 'active'");
      db.exec("CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status)");
    }
  }
));
```

### Example: Creating a New Table

```javascript
runner.addMigration(new Migration(
  "005",
  "create_workflow_tags_table",
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_tags (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_workflow_tags_workflow ON workflow_tags(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_tags_tag ON workflow_tags(tag);
    `);
  }
));
```

## SQLite Limitations

SQLite has some limitations that affect migrations:

1. **DROP COLUMN**: Not directly supported. Requires table recreation.
2. **ALTER TABLE**: Limited compared to other databases.
3. **Transaction Support**: Full transaction support available.

## Testing Migrations

To test migrations:

1. Create a test database
2. Run migrations
3. Verify schema changes
4. Test rollback (if supported)

## Migration History

View migration history:

```sql
SELECT * FROM schema_migrations ORDER BY applied_at;
```

## Best Practices

1. **Always check if changes exist** before applying migrations
2. **Use transactions** for atomicity
3. **Version sequentially** (001, 002, 003, ...)
4. **Use descriptive names** for migrations
5. **Document limitations** (especially SQLite-specific)
6. **Test migrations** before deploying
7. **Keep migrations small** and focused
8. **Never modify applied migrations** - create new ones instead

## Troubleshooting

### Migration Not Applied

If a migration doesn't apply:
1. Check if it's already applied: `SELECT * FROM schema_migrations WHERE version = 'XXX'`
2. Check migration logs for errors
3. Verify migration is registered in `createDefaultMigrations`

### Migration Failed

If a migration fails:
1. Check error logs
2. Verify SQL syntax
3. Check if prerequisites are met
4. Rollback if needed (if supported)

### Database Schema Out of Sync

If schema is out of sync:
1. Check applied migrations
2. Compare with expected schema
3. Create new migration to fix discrepancies

## References

- Migration System: `lib/db/migrations.js`
- Database Class: `lib/db/database.js`
- Architecture Review: `review/version0-3.md`


