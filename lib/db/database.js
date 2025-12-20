/**
 * SQLite database for workflow state management
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

class WorkflowDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(process.cwd(), ".kaczmarek-ai", "workflows.db");
    
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  initializeSchema() {
    // Workflow definitions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        definition TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);
    `);

    // Workflow executions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_data TEXT,
        status TEXT NOT NULL,
        current_step TEXT,
        state TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id)
      );

      CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
    `);

    // Step executions
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
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error TEXT,
        FOREIGN KEY (execution_id) REFERENCES executions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_step_executions_execution ON step_executions(execution_id);
      CREATE INDEX IF NOT EXISTS idx_step_executions_step ON step_executions(step_id);
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

  // Workflow CRUD
  saveWorkflow(id, name, version, definition) {
    const stmt = this.db.prepare(`
      INSERT INTO workflows (id, name, version, definition, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        definition = excluded.definition,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(id, name, version, JSON.stringify(definition));
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
    const stmt = this.db.prepare("SELECT id, name, version, created_at, updated_at FROM workflows ORDER BY updated_at DESC");
    return stmt.all();
  }

  deleteWorkflow(id) {
    const stmt = this.db.prepare("DELETE FROM workflows WHERE id = ?");
    stmt.run(id);
  }

  // Execution management
  createExecution(id, workflowId, triggerType, triggerData) {
    const stmt = this.db.prepare(`
      INSERT INTO executions (id, workflow_id, trigger_type, trigger_data, status)
      VALUES (?, ?, ?, ?, 'running')
    `);
    stmt.run(id, workflowId, triggerType, JSON.stringify(triggerData));
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
    if (updates.state !== undefined) {
      fields.push("state = ?");
      values.push(JSON.stringify(updates.state));
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
        trigger_data: row.trigger_data ? JSON.parse(row.trigger_data) : null,
        state: row.state ? JSON.parse(row.state) : null
      };
    }
    return null;
  }

  listExecutions(workflowId = null, status = null) {
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

  close() {
    this.db.close();
  }
}

module.exports = WorkflowDatabase;

