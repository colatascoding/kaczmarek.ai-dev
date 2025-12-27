// Example: How to integrate workflow editor into your Electron control center

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WorkflowEngine = require('kaczmarek-ai-dev/lib/workflow-engine');

// Your existing Electron app setup
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

// Extension registration (pseudo-code for your extension system)
class WorkflowEditorExtension {
  constructor(context) {
    this.context = context;
    this.engine = new WorkflowEngine(context.workspacePath);
    this.setupIPC();
  }

  setupIPC() {
    // Load workflow
    ipcMain.handle('workflow:load', async (event, workflowPath) => {
      try {
        const workflow = await this.engine.loadWorkflow(workflowPath);
        return { success: true, workflow };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Save workflow
    ipcMain.handle('workflow:save', async (event, workflowPath, workflow) => {
      try {
        await this.engine.saveWorkflow(workflowPath, workflow);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Validate workflow
    ipcMain.handle('workflow:validate', async (event, workflow) => {
      try {
        const result = await this.engine.validateWorkflow(workflow);
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Run workflow
    ipcMain.handle('workflow:run', async (event, workflowId, params) => {
      try {
        const execution = await this.engine.execute(workflowId, params);
        return { success: true, executionId: execution.id };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Get execution status
    ipcMain.handle('workflow:status', async (event, executionId) => {
      try {
        const status = await this.engine.getExecutionStatus(executionId);
        return { success: true, status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // List workflows
    ipcMain.handle('workflow:list', async (_event) => {
      try {
        const workflows = await this.engine.listWorkflows();
        return { success: true, workflows };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Watch for YAML file changes
    ipcMain.handle('workflow:watch', async (_event, workflowPath) => {
      // Set up file watcher
      const fs = require('fs');
      fs.watch(workflowPath, async (eventType) => {
        if (eventType === 'change') {
          mainWindow.webContents.send('workflow:changed', workflowPath);
        }
      });
      return { success: true };
    });
  }

  // Register extension with your app
  register() {
    // Register menu item
    this.context.menu.register({
      id: 'workflow-editor',
      label: 'Workflow Editor',
      click: () => {
        this.openEditor();
      }
    });

    // Register command
    this.context.commands.register('workflow:new', () => {
      this.createNewWorkflow();
    });

    // Register view
    this.context.views.register({
      id: 'workflow-editor-view',
      title: 'Workflow Editor',
      component: 'WorkflowEditor',
      icon: 'workflow-icon.svg'
    });
  }

  openEditor() {
    // Open workflow editor view in your app
    this.context.views.show('workflow-editor-view');
  }

  async createNewWorkflow() {
    // Create new workflow dialog
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog({
      title: 'Create New Workflow',
      defaultPath: 'workflows/new-workflow.yaml',
      filters: [
        { name: 'YAML', extensions: ['yaml', 'yml'] }
      ]
    });

    if (!result.canceled) {
      // Create empty workflow
      const emptyWorkflow = {
        name: 'New Workflow',
        version: '1.0.0',
        steps: []
      };
      
      await this.engine.saveWorkflow(result.filePath, emptyWorkflow);
      this.openEditor();
    }
  }
}

// Initialize extension when app is ready
app.whenReady().then(() => {
  createWindow();

  // Register workflow editor extension
  const extensionContext = {
    workspacePath: process.cwd(),
    menu: { register: () => {} }, // Your menu API
    commands: { register: () => {} }, // Your commands API
    views: { register: () => {}, show: () => {} } // Your views API
  };

  const workflowExtension = new WorkflowEditorExtension(extensionContext);
  workflowExtension.register();
});

// React component example (for your renderer process)
/*
import React, { useState, useEffect } from 'react';
import ReactFlow from 'reactflow';
import { ipcRenderer } from 'electron';

function WorkflowEditor({ workflowPath }) {
  const [workflow, setWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    loadWorkflow();
    
    // Watch for external changes
    ipcRenderer.on('workflow:changed', handleWorkflowChanged);
    
    return () => {
      ipcRenderer.removeListener('workflow:changed', handleWorkflowChanged);
    };
  }, [workflowPath]);

  async function loadWorkflow() {
    const result = await ipcRenderer.invoke('workflow:load', workflowPath);
    if (result.success) {
      setWorkflow(result.workflow);
      const visual = yamlToVisual(result.workflow);
      setNodes(visual.nodes);
      setEdges(visual.edges);
    }
  }

  async function saveWorkflow() {
    const yaml = visualToYaml({ nodes, edges });
    const result = await ipcRenderer.invoke('workflow:save', workflowPath, yaml);
    if (result.success) {
      console.log('Workflow saved');
    }
  }

  function handleWorkflowChanged(event, path) {
    if (path === workflowPath) {
      loadWorkflow();
    }
  }

  return (
    <div className="workflow-editor">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
      />
      <button onClick={saveWorkflow}>Save</button>
    </div>
  );
}
*/

