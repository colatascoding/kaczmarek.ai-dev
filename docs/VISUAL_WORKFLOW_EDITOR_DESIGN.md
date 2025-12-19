# Visual Workflow Editor Design

**Version**: 0.1.0  
**Status**: Design Proposal  
**Last updated**: 2025-01-XX

## Overview

This document designs a visual drag-and-drop workflow editor as an extension/plugin for an existing Electron control center app. The editor works with the local-first workflow engine, providing both visual editing and YAML-based version control.

## Architecture

### Two-Way Sync: Visual Editor ↔ YAML

```
┌─────────────────────┐
│  Electron App      │
│  (Control Center)  │
│                    │
│  ┌──────────────┐  │
│  │ Workflow     │  │
│  │ Editor       │  │  ← Drag & Drop UI
│  │ Extension    │  │
│  └──────┬───────┘  │
│         │          │
│         ▼          │
│  ┌──────────────┐  │
│  │ Workflow     │  │
│  │ Engine API   │  │  ← Node.js IPC
│  └──────┬───────┘  │
└─────────┼──────────┘
          │
          ▼
┌─────────────────────┐
│  Workflow Engine    │
│  (Node.js)          │
│                     │
│  ┌──────────────┐  │
│  │ YAML Parser  │  │  ← YAML ↔ JSON
│  │ / Generator  │  │
│  └──────┬───────┘  │
│         │          │
│         ▼          │
│  ┌──────────────┐  │
│  │ SQLite DB    │  │  ← State Storage
│  └──────────────┘  │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│  workflows/         │
│  *.yaml files       │  ← Version Control
└─────────────────────┘
```

## Key Design Principles

1. **YAML as Source of Truth** - Visual editor reads/writes YAML
2. **Bidirectional Sync** - Changes in editor ↔ YAML files
3. **Version Control Friendly** - YAML files in git
4. **Extension Architecture** - Plugin for existing Electron app
5. **Local-First** - All data local, no cloud dependency

## Extension Architecture

### Electron App Integration

```javascript
// In your Electron control center app
const { WorkflowEditorExtension } = require('kaczmarek-ai-dev/editor');

// Register extension
app.registerExtension({
  id: 'workflow-editor',
  name: 'Workflow Editor',
  icon: 'workflow-icon.svg',
  component: WorkflowEditorExtension,
  config: {
    workflowDir: path.join(projectRoot, 'workflows'),
    enginePath: path.join(__dirname, 'lib/workflow-engine.js')
  }
});
```

### Extension Structure

```
kaczmarek-ai-dev/
├── lib/
│   ├── workflow-engine.js      # Core engine
│   ├── yaml-parser.js          # YAML ↔ JSON conversion
│   └── engine-api.js           # IPC API for Electron
├── editor/
│   ├── extension.js             # Electron extension entry
│   ├── components/
│   │   ├── WorkflowCanvas.jsx   # Drag & drop canvas
│   │   ├── StepNode.jsx         # Step component
│   │   ├── ConnectionLine.jsx   # Connection between steps
│   │   └── PropertyPanel.jsx   # Step properties editor
│   ├── hooks/
│   │   ├── useWorkflow.js       # Workflow state management
│   │   └── useYamlSync.js       # YAML sync hook
│   └── utils/
│       ├── yaml-converter.js    # YAML ↔ visual format
│       └── validation.js        # Workflow validation
└── package.json
```

## Visual Editor Components

### 1. Workflow Canvas

**Technology**: React + React Flow (or similar)

```jsx
import ReactFlow, { 
  Node, 
  Edge, 
  Controls, 
  Background 
} from 'reactflow';

function WorkflowCanvas({ workflow, onUpdate }) {
  const [nodes, setNodes] = useState(convertWorkflowToNodes(workflow));
  const [edges, setEdges] = useState(convertWorkflowToEdges(workflow));
  
  const onNodesChange = (changes) => {
    const updatedNodes = applyNodeChanges(changes, nodes);
    setNodes(updatedNodes);
    const updatedWorkflow = convertNodesToWorkflow(updatedNodes, edges);
    onUpdate(updatedWorkflow);
  };
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
    >
      <Controls />
      <Background />
    </ReactFlow>
  );
}
```

### 2. Step Node Component

```jsx
function StepNode({ data, selected }) {
  return (
    <div className={`step-node ${selected ? 'selected' : ''}`}>
      <div className="step-header">
        <Icon name={data.module} />
        <span>{data.stepId}</span>
      </div>
      <div className="step-body">
        <div className="module">{data.module}</div>
        <div className="action">{data.action}</div>
      </div>
      <div className="step-ports">
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    </div>
  );
}
```

### 3. Property Panel

```jsx
function PropertyPanel({ selectedStep, onUpdate }) {
  return (
    <div className="property-panel">
      <h3>Step Properties</h3>
      
      <Form>
        <FormField label="Step ID">
          <Input value={selectedStep.id} onChange={...} />
        </FormField>
        
        <FormField label="Module">
          <Select 
            value={selectedStep.module}
            options={availableModules}
            onChange={...}
          />
        </FormField>
        
        <FormField label="Action">
          <Select 
            value={selectedStep.action}
            options={moduleActions[selectedStep.module]}
            onChange={...}
          />
        </FormField>
        
        <FormField label="Inputs">
          <CodeEditor 
            value={JSON.stringify(selectedStep.inputs, null, 2)}
            language="json"
            onChange={...}
          />
        </FormField>
        
        <FormField label="On Success">
          <ConditionEditor 
            value={selectedStep.onSuccess}
            onChange={...}
          />
        </FormField>
        
        <FormField label="On Failure">
          <Select 
            value={selectedStep.onFailure}
            options={availableSteps}
            onChange={...}
          />
        </FormField>
      </Form>
    </div>
  );
}
```

## YAML ↔ Visual Format Conversion

### Visual Format (Internal)

```json
{
  "nodes": [
    {
      "id": "analyze",
      "type": "step",
      "position": { "x": 100, "y": 100 },
      "data": {
        "stepId": "analyze",
        "module": "analysis",
        "action": "analyze-requirements",
        "inputs": {
          "feature": "{{ trigger.feature }}"
        },
        "outputs": ["complexity", "estimatedTime"]
      }
    }
  ],
  "edges": [
    {
      "id": "analyze-to-plan",
      "source": "analyze",
      "target": "plan",
      "condition": "success"
    }
  ]
}
```

### YAML Format (Storage)

```yaml
steps:
  - id: "analyze"
    module: "analysis"
    action: "analyze-requirements"
    inputs:
      feature: "{{ trigger.feature }}"
    onSuccess: "plan"
    onFailure: "error-handler"
```

### Conversion Functions

```javascript
// Convert YAML workflow to visual format
function yamlToVisual(yamlWorkflow) {
  const nodes = yamlWorkflow.steps.map((step, index) => ({
    id: step.id,
    type: 'step',
    position: calculatePosition(index),
    data: {
      stepId: step.id,
      module: step.module,
      action: step.action,
      inputs: step.inputs,
      outputs: step.outputs || []
    }
  }));
  
  const edges = [];
  yamlWorkflow.steps.forEach(step => {
    if (step.onSuccess) {
      edges.push({
        id: `${step.id}-success`,
        source: step.id,
        target: typeof step.onSuccess === 'string' 
          ? step.onSuccess 
          : step.onSuccess.then,
        condition: 'success'
      });
    }
    if (step.onFailure) {
      edges.push({
        id: `${step.id}-failure`,
        source: step.id,
        target: step.onFailure,
        condition: 'failure'
      });
    }
  });
  
  return { nodes, edges };
}

// Convert visual format to YAML
function visualToYaml(visualWorkflow) {
  const steps = visualWorkflow.nodes.map(node => {
    const step = {
      id: node.data.stepId,
      module: node.data.module,
      action: node.data.action,
      inputs: node.data.inputs
    };
    
    // Find outgoing edges
    const successEdge = visualWorkflow.edges.find(
      e => e.source === node.id && e.condition === 'success'
    );
    const failureEdge = visualWorkflow.edges.find(
      e => e.source === node.id && e.condition === 'failure'
    );
    
    if (successEdge) {
      step.onSuccess = successEdge.target;
    }
    if (failureEdge) {
      step.onFailure = failureEdge.target;
    }
    
    return step;
  });
  
  return { steps };
}
```

## IPC Communication (Electron ↔ Node.js)

### Main Process (Electron)

```javascript
// main.js
const { ipcMain } = require('electron');
const WorkflowEngine = require('kaczmarek-ai-dev/lib/workflow-engine');

const engine = new WorkflowEngine(dbPath);

ipcMain.handle('workflow:load', async (event, workflowPath) => {
  return await engine.loadWorkflow(workflowPath);
});

ipcMain.handle('workflow:save', async (event, workflowPath, workflow) => {
  return await engine.saveWorkflow(workflowPath, workflow);
});

ipcMain.handle('workflow:validate', async (event, workflow) => {
  return await engine.validateWorkflow(workflow);
});

ipcMain.handle('workflow:run', async (event, workflowId, params) => {
  return await engine.execute(workflowId, params);
});

ipcMain.handle('workflow:status', async (event, executionId) => {
  return await engine.getExecutionStatus(executionId);
});
```

### Renderer Process (React)

```javascript
// In React component
const { ipcRenderer } = window.require('electron');

async function loadWorkflow(path) {
  const workflow = await ipcRenderer.invoke('workflow:load', path);
  return workflow;
}

async function saveWorkflow(path, workflow) {
  await ipcRenderer.invoke('workflow:save', path, workflow);
}

async function validateWorkflow(workflow) {
  const result = await ipcRenderer.invoke('workflow:validate', workflow);
  return result;
}
```

## Workflow Editor UI

### Main Editor View

```
┌─────────────────────────────────────────────────┐
│  Workflow Editor                    [Save] [Run]│
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────┐  ┌──────────────────────┐ │
│  │ Toolbox        │  │ Canvas                │ │
│  │                │  │                       │ │
│  │ 📦 Modules     │  │  [Analyze]            │ │
│  │  - Testing     │  │     │                 │ │
│  │  - Implementation│ │     ▼                 │ │
│  │  - Documentation│ │  [Plan]                │ │
│  │  - Refactoring  │  │     │                 │ │
│  │  - Bug Fixing   │  │     ▼                 │ │
│  │                │  │  [Implement]          │ │
│  │                │  │     │                 │ │
│  │                │  │     ▼                 │ │
│  │                │  │  [Test]              │ │
│  │                │  │     │                 │ │
│  │                │  │     ▼                 │ │
│  │                │  │  [Document]           │ │
│  │                │  │                       │ │
│  └────────────────┘  └──────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ Properties Panel                           │ │
│  │                                            │ │
│  │ Step: Test                                 │ │
│  │ Module: testing                            │ │
│  │ Action: run-tests                          │ │
│  │                                            │ │
│  │ Inputs:                                    │ │
│  │ {                                          │ │
│  │   "changes": "{{ steps.implement... }}"   │ │
│  │ }                                          │ │
│  │                                            │ │
│  │ On Success:                                │ │
│  │   Condition: {{ passed }}                  │ │
│  │   Then: document                           │ │
│  │   Else: fix-tests                          │ │
│  │                                            │ │
│  │ On Failure: error-handler                 │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Features

### 1. Drag & Drop

- Drag modules from toolbox to canvas
- Connect steps with edges
- Drag to reposition steps
- Delete steps/connections

### 2. Visual Editing

- Click step to edit properties
- Double-click to edit step details
- Right-click for context menu
- Keyboard shortcuts (Delete, Copy, Paste)

### 3. Real-time Validation

- Validate workflow as you edit
- Show errors inline
- Highlight invalid connections
- Suggest fixes

### 4. Auto-save & Sync

- Auto-save to YAML on changes
- Watch YAML files for external changes
- Show sync status
- Handle merge conflicts

### 5. Preview & Test

- Preview workflow execution
- Test individual steps
- Dry-run workflow
- Show execution history

## Extension API

### For Your Electron App

```javascript
// Register workflow editor extension
app.extensions.register({
  id: 'kaczmarek-workflow-editor',
  name: 'Workflow Editor',
  version: '1.0.0',
  
  // Extension lifecycle
  activate: (context) => {
    // Initialize workflow engine
    const engine = new WorkflowEngine(context.workspacePath);
    
    // Register commands
    context.commands.register('workflow.new', () => {
      // Create new workflow
    });
    
    context.commands.register('workflow.open', () => {
      // Open workflow editor
    });
    
    // Register views
    context.views.register({
      id: 'workflow-editor',
      title: 'Workflow Editor',
      component: WorkflowEditor
    });
  },
  
  deactivate: () => {
    // Cleanup
  }
});
```

## File Structure

```
your-electron-app/
├── extensions/
│   └── kaczmarek-workflow-editor/
│       ├── package.json
│       ├── extension.js
│       ├── components/
│       ├── lib/
│       └── assets/
└── node_modules/
    └── kaczmarek-ai-dev/
        ├── lib/
        │   ├── workflow-engine.js
        │   └── yaml-parser.js
        └── editor/
            └── extension.js
```

## Benefits of This Approach

1. ✅ **Visual Editing** - Drag & drop interface
2. ✅ **Version Control** - YAML files in git
3. ✅ **Local-First** - No cloud dependency
4. ✅ **Extension Architecture** - Fits your existing app
5. ✅ **Bidirectional Sync** - Visual ↔ YAML
6. ✅ **Reusable** - Can use engine without editor
7. ✅ **Extensible** - Easy to add features

## Implementation Plan

### Phase 1: Core Engine + YAML
- [ ] Workflow engine (Node.js)
- [ ] YAML parser/generator
- [ ] SQLite database
- [ ] Basic workflow execution

### Phase 2: Extension Foundation
- [ ] Extension architecture
- [ ] IPC communication
- [ ] Basic React components
- [ ] YAML ↔ Visual conversion

### Phase 3: Visual Editor
- [ ] Drag & drop canvas (React Flow)
- [ ] Step nodes
- [ ] Connection lines
- [ ] Property panel

### Phase 4: Advanced Features
- [ ] Real-time validation
- [ ] Auto-save
- [ ] Preview/test mode
- [ ] Execution monitoring

## Technology Stack

- **Electron**: Your existing app
- **React**: UI components
- **React Flow**: Drag & drop canvas
- **Node.js**: Workflow engine
- **SQLite**: State storage
- **YAML**: Workflow definition
- **IPC**: Electron ↔ Node.js communication

## Example: Adding a Step

1. **User drags "Testing" module** from toolbox
2. **Drops on canvas** → Creates new step node
3. **Clicks step** → Opens property panel
4. **Selects action** → "run-tests"
5. **Configures inputs** → JSON editor
6. **Connects to next step** → Drag edge
7. **Auto-saves** → Updates YAML file
8. **Git commit** → Version controlled

## Next Steps

1. Review this design
2. Integrate with your Electron app
3. Implement core engine first
4. Build visual editor components
5. Add extension to your control center

This approach gives you the best of both worlds: visual editing for ease of use, and YAML for version control and flexibility.

