/**
 * Database migration system
 * Replaces try/catch pattern with versioned migrations
 */

const { DatabaseError } = require("../utils/errors");
const { createLogger } = require("../utils/logger");

const logger = createLogger({ prefix: "Migrations" });

/**
 * Migration definition
 */
class Migration {
  constructor(version, name, up, down = null) {
    this.version = version;
    this.name = name;
    this.up = up; // Function to apply migration
    this.down = down; // Function to rollback migration (optional)
  }
}

/**
 * Migration runner
 */
class MigrationRunner {
  constructor(db) {
    this.db = db;
    this.migrations = [];
  }

  /**
   * Register a migration
   */
  addMigration(migration) {
    if (!(migration instanceof Migration)) {
      throw new DatabaseError("Migration must be an instance of Migration class");
    }
    this.migrations.push(migration);
    // Sort by version
    this.migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Initialize migrations table
   */
  initializeMigrationsTable() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_migrations_version ON schema_migrations(version);
      `);
    } catch (error) {
      throw new DatabaseError(`Failed to initialize migrations table: ${error.message}`, "init_migrations_table", "schema_migrations");
    }
  }

  /**
   * Get applied migrations
   */
  getAppliedMigrations() {
    try {
      // Check if table exists first
      const tableCheck = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_migrations'
      `).get();
      
      if (!tableCheck) {
        // Table doesn't exist yet, return empty array
        return [];
      }
      
      const stmt = this.db.prepare("SELECT version FROM schema_migrations ORDER BY version");
      return stmt.all().map(row => row.version);
    } catch (error) {
      // If table doesn't exist, return empty array instead of throwing
      if (error.message.includes("no such table")) {
        return [];
      }
      throw new DatabaseError(`Failed to get applied migrations: ${error.message}`, "get_applied_migrations", "schema_migrations");
    }
  }

  /**
   * Mark migration as applied
   */
  markApplied(version, name) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO schema_migrations (version, name)
        VALUES (?, ?)
      `);
      stmt.run(version, name);
    } catch (error) {
      throw new DatabaseError(`Failed to mark migration as applied: ${error.message}`, "mark_applied", "schema_migrations");
    }
  }

  /**
   * Mark migration as rolled back
   */
  markRolledBack(version) {
    try {
      const stmt = this.db.prepare("DELETE FROM schema_migrations WHERE version = ?");
      stmt.run(version);
    } catch (error) {
      throw new DatabaseError(`Failed to mark migration as rolled back: ${error.message}`, "mark_rolled_back", "schema_migrations");
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations() {
    this.initializeMigrationsTable();
    const applied = this.getAppliedMigrations();
    
    const pending = this.migrations.filter(m => !applied.includes(m.version));
    
    if (pending.length === 0) {
      logger.debug("No pending migrations");
      return { applied: 0, migrations: [] };
    }

    logger.info(`Running ${pending.length} pending migration(s)`);
    const appliedMigrations = [];

    for (const migration of pending) {
      try {
        logger.info(`Applying migration ${migration.version}: ${migration.name}`);
        
        // Run migration in a transaction
        this.db.exec("BEGIN TRANSACTION");
        try {
          migration.up(this.db);
          this.markApplied(migration.version, migration.name);
          this.db.exec("COMMIT");
          
          appliedMigrations.push({
            version: migration.version,
            name: migration.name,
            status: "applied"
          });
          
          logger.info(`Migration ${migration.version} applied successfully`);
        } catch (error) {
          this.db.exec("ROLLBACK");
          throw error;
        }
      } catch (error) {
        logger.error(`Failed to apply migration ${migration.version}: ${error.message}`, error);
        throw new DatabaseError(
          `Failed to apply migration ${migration.version}: ${error.message}`,
          "apply_migration",
          null,
          { version: migration.version, name: migration.name, error: error.message }
        );
      }
    }

    return {
      applied: appliedMigrations.length,
      migrations: appliedMigrations
    };
  }

  /**
   * Rollback last migration
   */
  async rollbackLast() {
    this.initializeMigrationsTable();
    const applied = this.getAppliedMigrations();
    
    if (applied.length === 0) {
      logger.info("No migrations to rollback");
      return null;
    }

    const lastVersion = applied[applied.length - 1];
    const migration = this.migrations.find(m => m.version === lastVersion);
    
    if (!migration) {
      throw new DatabaseError(`Migration ${lastVersion} not found`, "rollback", null);
    }

    if (!migration.down) {
      throw new DatabaseError(`Migration ${lastVersion} does not support rollback`, "rollback", null);
    }

    try {
      logger.info(`Rolling back migration ${migration.version}: ${migration.name}`);
      
      this.db.exec("BEGIN TRANSACTION");
      try {
        migration.down(this.db);
        this.markRolledBack(migration.version);
        this.db.exec("COMMIT");
        
        logger.info(`Migration ${migration.version} rolled back successfully`);
        return {
          version: migration.version,
          name: migration.name,
          status: "rolled_back"
        };
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to rollback migration ${migration.version}: ${error.message}`, error);
      throw new DatabaseError(
        `Failed to rollback migration ${migration.version}: ${error.message}`,
        "rollback",
        null,
        { version: migration.version, name: migration.name, error: error.message }
      );
    }
  }

  /**
   * Get migration status
   */
  getStatus() {
    this.initializeMigrationsTable();
    const applied = this.getAppliedMigrations();
    
    return {
      total: this.migrations.length,
      applied: applied.length,
      pending: this.migrations.length - applied.length,
      migrations: this.migrations.map(m => ({
        version: m.version,
        name: m.name,
        applied: applied.includes(m.version)
      }))
    };
  }
}

/**
 * Create and register default migrations
 * These replace the try/catch pattern in initializeSchema
 */
function createDefaultMigrations(db) {
  const runner = new MigrationRunner(db);

  // Migration 001: Add version_tag to workflows
  runner.addMigration(new Migration(
    "001",
    "add_version_tag_to_workflows",
    (db) => {
      // Check if column exists
      const tableInfo = db.prepare("PRAGMA table_info(workflows)").all();
      const hasVersionTag = tableInfo.some(col => col.name === "version_tag");
      
      if (!hasVersionTag) {
        db.exec("ALTER TABLE workflows ADD COLUMN version_tag TEXT");
        db.exec("CREATE INDEX IF NOT EXISTS idx_workflows_version_tag ON workflows(version_tag)");
      }
    },
    (db) => {
      // Rollback: Remove column (SQLite doesn't support DROP COLUMN easily)
      // In practice, we'd need to recreate the table
      logger.warn("Rollback for version_tag column not fully supported (SQLite limitation)");
    }
  ));

  // Migration 002: Add outcome and follow_up_suggestions to executions
  runner.addMigration(new Migration(
    "002",
    "add_outcome_to_executions",
    (db) => {
      const tableInfo = db.prepare("PRAGMA table_info(executions)").all();
      const columns = tableInfo.map(col => col.name);
      
      if (!columns.includes("outcome")) {
        db.exec("ALTER TABLE executions ADD COLUMN outcome TEXT");
      }
      if (!columns.includes("follow_up_suggestions")) {
        db.exec("ALTER TABLE executions ADD COLUMN follow_up_suggestions TEXT");
      }
      if (!columns.includes("summary")) {
        db.exec("ALTER TABLE executions ADD COLUMN summary TEXT");
      }
      if (!columns.includes("execution_mode")) {
        db.exec("ALTER TABLE executions ADD COLUMN execution_mode TEXT");
      }
    }
  ));

  // Migration 003: Add return_code to step_executions
  runner.addMigration(new Migration(
    "003",
    "add_return_code_to_step_executions",
    (db) => {
      const tableInfo = db.prepare("PRAGMA table_info(step_executions)").all();
      const columns = tableInfo.map(col => col.name);
      
      if (!columns.includes("return_code")) {
        db.exec("ALTER TABLE step_executions ADD COLUMN return_code INTEGER");
      }
    }
  ));

  return runner;
}

module.exports = {
  Migration,
  MigrationRunner,
  createDefaultMigrations
};

