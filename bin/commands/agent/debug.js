/**
 * kad agent debug - Debug a task (show details, errors, history)
 */

const { log, error } = require("../../utils");

function cmdAgentDebug(rest) {
  const taskId = rest[0];
  if (!taskId) {
    error("Task ID required. Usage: kad agent debug <task-id>");
    process.exitCode = 1;
    return;
  }

  const AgentDebugger = require("../../../lib/agent/debug");
  const agentDebugger = new AgentDebugger(process.cwd());
  
  const details = agentDebugger.getTaskDetails(taskId);
  if (details.error) {
    error(details.error);
    process.exitCode = 1;
    return;
  }

  log(`\nTask Details: ${taskId}`);
  log("=".repeat(60));
  log(`Status: ${details.status}`);
  log(`Type: ${details.type}`);
  log(`Created: ${details.createdAt || "unknown"}`);
  if (details.processingStartedAt) {
    log(`Processing Started: ${details.processingStartedAt}`);
  }
  if (details.readyAt) {
    log(`Ready At: ${details.readyAt}`);
  }
  if (details.failedAt) {
    log(`Failed At: ${details.failedAt}`);
  }
  if (details.error) {
    log(`\nError:`);
    log(`  ${details.error}`);
    
    const analysis = agentDebugger.analyzeFailure(taskId);
    if (analysis.analysis) {
      log(`\nError Analysis:`);
      log(`  Type: ${analysis.analysis.type}`);
      analysis.analysis.details.forEach(d => log(`  - ${d}`));
    }
    if (analysis.suggestions && analysis.suggestions.length > 0) {
      log(`\nSuggestions:`);
      analysis.suggestions.forEach(s => log(`  - ${s}`));
    }
  }
  log(`\nTasks: ${details.tasksCount}`);
  if (details.tasks && details.tasks.length > 0) {
    details.tasks.forEach((t, i) => {
      log(`  ${i + 1}. ${t.description || t.text || t.id || "Unknown task"}`);
    });
  }
  log(`Prompt: ${details.hasPrompt ? `${details.promptLength} characters` : "missing"}`);
  log(`CWD: ${details.cwd || process.cwd()}`);
  
  const history = agentDebugger.getTaskHistory(taskId);
  if (history.history && history.history.length > 0) {
    log(`\nHistory:`);
    history.history.forEach(h => {
      log(`  ${h.timestamp} - ${h.event} (${h.status})`);
      if (h.error) {
        log(`    Error: ${h.error}`);
      }
    });
  }
}

module.exports = cmdAgentDebug;



