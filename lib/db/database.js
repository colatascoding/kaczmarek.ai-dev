/**
 * SQLite database for workflow state management
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { createDefaultMigrations } = require("./migrations");
const { createLogger } = require("../utils/logger");

class WorkflowDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(process.cwd(), ".kaczmarek-ai", "workflows.db");
    
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(this.dbPath);
    this.logger = createLogger({ prefix: "Database" });
    this.initializeSchema();
    // Run migrations synchronously (migrations are simple SQL operations)
    this.runMigrationsSync();
  }

  initializeSchema() {
    // Workflow definitions
    // Note: version_tag is included in base schema for new databases
    // Existing databases will get it via migration 001
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        version_tag TEXT,
        definition TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);
      CREATE INDEX IF NOT EXISTS idx_workflows_version_tag ON workflows(version_tag);
    `);

    // Workflow executions
    // Note: outcome, follow_up_suggestions, summary, execution_mode included in base schema
    // Existing databases will get them via migration 002
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        version_tag TEXT,
        trigger_type TEXT NOT NULL,
        trigger_data TEXT,
        status TEXT NOT NULL,
        current_step TEXT,
        execution_mode TEXT,
        state TEXT,
        outcome TEXT,
        follow_up_suggestions TEXT,
        summary TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id)
      );

      CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
      CREATE INDEX IF NOT EXISTS idx_executions_version ON executions(version_tag);
    `);

    // Step executions
    // Note: return_code included in base schema
    // Existing databases will get it via migration 003
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS step_executions (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        inputs TEXT,
        outputs TEXT,
        status TEXT NOT NULL,
        return_code INTEGER,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error TEXT,
        FOREIGN KEY (execution_id) REFERENCES executions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_step_executions_execution ON step_executions(execution_id);
      CREATE INDEX IF NOT EXISTS idx_step_executions_step ON step_executions(step_id);
    `);

    // Pending decisions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pending_decisions (
        decision_id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        proposals TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        choice TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (execution_id) REFERENCES executions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_pending_decisions_execution ON pending_decisions(execution_id);
      CREATE INDEX IF NOT EXISTS idx_pending_decisions_status ON pending_decisions(status);
    `);

    // Execution history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS execution_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        step_id TEXT,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (execution_id) REFERENCES executions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_history_execution ON execution_history(execution_id);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON execution_history(timestamp);
    `);
  }

  /**
   * Run database migrations (synchronous version for constructor)
   */
  runMigrationsSync() {
    try {
      const migrationRunner = createDefaultMigrations(this.db);
      // Run migrations - they're simple SQL operations so we can run them sync
      const applied = migrationRunner.getAppliedMigrations();
      const pending = migrationRunner.migrations.filter(m => !applied.includes(m.version));
      
      if (pending.length === 0) {
        return;
      }

      this.logger.info(`Running ${pending.length} pending migration(s)`);
      
      for (const migration of pending) {
        try {
          this.logger.info(`Applying migration ${migration.version}: ${migration.name}`);
          
          // Run migration in a transaction
          this.db.exec("BEGIN TRANSACTION");
          try {
            // Execute migration (synchronous)
            migration.up(this.db);
            migrationRunner.markApplied(migration.version, migration.name);
            this.db.exec("COMMIT");
            
            this.logger.info(`Migration ${migration.version} applied successfully`);
          } catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
          }
        } catch (error) {
          this.logger.error(`Failed to apply migration ${migration.version}: ${error.message}`, error);
          // Continue with other migrations even if one fails
        }
      }
    } catch (error) {
      this.logger.error("Migration system error", error);
      // Don't throw - allow database to continue with existing schema
      // This ensures backward compatibility
    }
  }

  // Workflow CRUD
  saveWorkflow(id, name, version, definition, versionTag = null) {
    const stmt = this.db.prepare(`
      INSERT INTO workflows (id, name, version, version_tag, definition, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        version_tag = excluded.version_tag,
        definition = excluded.definition,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(id, name, version, versionTag, JSON.stringify(definition));
  }

  getWorkflow(id) {
    const stmt = this.db.prepare("SELECT * FROM workflows WHERE id = ?");
    const row = stmt.get(id);
    if (row) {
      return {
        ...row,
        definition: JSON.parse(row.definition)
      };
    }
    return null;
  }

  listWorkflows() {
    const stmt = this.db.prepare("SELECT id, name, version, version_tag, created_at, updated_at FROM workflows ORDER BY updated_at DESC");
    return stmt.all();
  }

  deleteWorkflow(id) {
    const stmt = this.db.prepare("DELETE FROM workflows WHERE id = ?");
    stmt.run(id);
  }

  // Execution management
  createExecution(id, workflowId, triggerType, triggerData, versionTag = null, executionMode = "auto") {
    const stmt = this.db.prepare(`
      INSERT INTO executions (id, workflow_id, version_tag, trigger_type, trigger_data, status, execution_mode)
      VALUES (?, ?, ?, ?, ?, 'running', ?)
    `);
    stmt.run(id, workflowId, versionTag, triggerType, JSON.stringify(triggerData || null), executionMode);
  }

  updateExecution(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.currentStep !== undefined) {
      fields.push("current_step = ?");
      values.push(updates.currentStep);
    }
    if (updates.executionMode !== undefined) {
      fields.push("execution_mode = ?");
      values.push(updates.executionMode);
    }
    if (updates.state !== undefined) {
      fields.push("state = ?");
      values.push(JSON.stringify(updates.state));
    }
    if (updates.error !== undefined) {
      fields.push("error = ?");
      values.push(updates.error);
    }
    if (updates.outcome !== undefined) {
      fields.push("outcome = ?");
      values.push(updates.outcome);
    }
    if (updates.followUpSuggestions !== undefined) {
      fields.push("follow_up_suggestions = ?");
      values.push(JSON.stringify(updates.followUpSuggestions));
    }
    if (updates.status === "completed" || updates.status === "failed") {
      fields.push("completed_at = CURRENT_TIMESTAMP");
    }
    
    if (fields.length === 0) return;
    
    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE executions SET ${fields.join(", ")} WHERE id = ?
    `);
    stmt.run(...values);
  }

  getExecution(id) {
    const stmt = this.db.prepare("SELECT * FROM executions WHERE id = ?");
    const row = stmt.get(id);
    if (row) {
      return {
        ...row,
        executionId: row.id,
        workflowId: row.workflow_id,
        versionTag: row.version_tag,
        currentStep: row.current_step,
        executionMode: row.execution_mode,
        trigger_data: row.trigger_data ? JSON.parse(row.trigger_data) : null,
        state: row.state ? JSON.parse(row.state) : null,
        outcome: row.outcome,
        followUpSuggestions: row.follow_up_suggestions ? JSON.parse(row.follow_up_suggestions) : null,
        summary: row.summary
      };
    }
    return null;
  }

  listExecutions(workflowId = null, status = null, versionTag = null) {
    let query = "SELECT * FROM executions WHERE 1=1";
    const params = [];
    
    if (workflowId) {
      query += " AND workflow_id = ?";
      params.push(workflowId);
    }
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    if (versionTag) {
      query += " AND version_tag = ?";
      params.push(versionTag);
    }
    
    query += " ORDER BY started_at DESC LIMIT 100";
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(row => ({
      ...row,
      trigger_data: row.trigger_data ? JSON.parse(row.trigger_data) : null,
      state: row.state ? JSON.parse(row.state) : null
    }));
  }

  // Step execution management
  createStepExecution(id, executionId, stepId, module, action, inputs) {
    const stmt = this.db.prepare(`
      INSERT INTO step_executions (id, execution_id, step_id, module, action, inputs, status)
      VALUES (?, ?, ?, ?, ?, ?, 'running')
    `);
    stmt.run(id, executionId, stepId, module, action, JSON.stringify(inputs));
  }

  updateStepExecution(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.outputs !== undefined) {
      fields.push("outputs = ?");
      values.push(JSON.stringify(updates.outputs));
    }
    if (updates.error !== undefined) {
      fields.push("error = ?");
      values.push(updates.error);
    }
    if (updates.status === "completed" || updates.status === "failed") {
      fields.push("completed_at = CURRENT_TIMESTAMP");
    }
    
    if (fields.length === 0) return;
    
    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE step_executions SET ${fields.join(", ")} WHERE id = ?
    `);
    stmt.run(...values);
  }

  getStepExecutions(executionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM step_executions 
      WHERE execution_id = ? 
      ORDER BY started_at ASC
    `);
    const rows = stmt.all(executionId);
    
    return rows.map(row => ({
      ...row,
      inputs: row.inputs ? JSON.parse(row.inputs) : null,
      outputs: row.outputs ? JSON.parse(row.outputs) : null
    }));
  }

  getAllExecutions(limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM executions 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    const rows = stmt.all(limit);
    
    return rows.map(row => ({
      executionId: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      triggerType: row.trigger_type,
      triggerData: row.trigger_data ? JSON.parse(row.trigger_data) : null,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error
    }));
  }

  getExecutionsByWorkflow(workflowId, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM executions 
      WHERE workflow_id = ?
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    const rows = stmt.all(workflowId, limit);
    
    return rows.map(row => ({
      executionId: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      triggerType: row.trigger_type,
      triggerData: row.trigger_data ? JSON.parse(row.trigger_data) : null,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error
    }));
  }

  // History
  addHistory(executionId, eventType, stepId = null, data = null) {
    const stmt = this.db.prepare(`
      INSERT INTO execution_history (execution_id, event_type, step_id, data)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(executionId, eventType, stepId, data ? JSON.stringify(data) : null);
  }

  getHistory(executionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_history 
      WHERE execution_id = ? 
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all(executionId);
    
    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : null
    }));
  }

  // Pending decisions
  createPendingDecision(decisionData) {
    const stmt = this.db.prepare(`
      INSERT INTO pending_decisions (
        decision_id, execution_id, step_id, title, description, 
        proposals, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      decisionData.decisionId,
      decisionData.executionId,
      decisionData.stepId,
      decisionData.title,
      decisionData.description || null,
      JSON.stringify(decisionData.proposals),
      decisionData.status || "pending",
      decisionData.createdAt || new Date().toISOString()
    );
  }

  getPendingDecision(decisionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM pending_decisions WHERE decision_id = ?
    `);
    const row = stmt.get(decisionId);
    
    if (!row) return null;
    
    return {
      decisionId: row.decision_id,
      executionId: row.execution_id,
      stepId: row.step_id,
      title: row.title,
      description: row.description,
      proposals: row.proposals ? JSON.parse(row.proposals) : [],
      status: row.status,
      choice: row.choice,
      notes: row.notes,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at
    };
  }

  getPendingDecisionsForExecution(executionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM pending_decisions 
      WHERE execution_id = ? AND status = 'pending'
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(executionId);
    
    return rows.map(row => ({
      decisionId: row.decision_id,
      executionId: row.execution_id,
      stepId: row.step_id,
      title: row.title,
      description: row.description,
      proposals: row.proposals ? JSON.parse(row.proposals) : [],
      status: row.status,
      choice: row.choice,
      notes: row.notes,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at
    }));
  }

  updatePendingDecision(decisionId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.choice !== undefined) {
      fields.push("choice = ?");
      values.push(updates.choice);
    }
    if (updates.notes !== undefined) {
      fields.push("notes = ?");
      values.push(updates.notes);
    }
    if (updates.resolvedAt !== undefined) {
      fields.push("resolved_at = ?");
      values.push(updates.resolvedAt);
    }
    
    if (fields.length === 0) return;
    
    values.push(decisionId);
    const stmt = this.db.prepare(`
      UPDATE pending_decisions 
      SET ${fields.join(", ")}
      WHERE decision_id = ?
    `);
    stmt.run(...values);
  }

  close() {
    this.db.close();
  }
}

module.exports = WorkflowDatabase;

