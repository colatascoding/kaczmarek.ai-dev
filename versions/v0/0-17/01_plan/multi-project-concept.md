# Multi-Project Capabilities Concept

**Version**: 0.1.0  
**Status**: Draft  
**Created**: 2025-12-30  
**Purpose**: Define architecture and implementation strategy for multi-project support in kaczmarek.ai-dev

## 1. Executive Summary

This document outlines a comprehensive concept for adding multi-project capabilities to `kaczmarek.ai-dev`. The goal is to enable users to manage multiple related projects within a single workspace while maintaining the local-first, Cursor-first principles that define kaczmarek.ai-dev.

**Key Objectives:**
- Manage multiple repositories as a unified workspace
- Share workflows, tools, and AI configurations across projects
- Enable cross-project dependencies and relationships
- Maintain individual project autonomy while enabling collaboration
- Preserve existing single-project workflows

## 2. Core Principles

### 2.1 Workspace-First Architecture

A **workspace** is a collection of related projects that share:
- Common development workflows
- Shared AI configurations (agents, prompts, workflows)
- Cross-project dependencies
- Unified version tracking (optional)

### 2.2 Backwards Compatibility

All existing single-project functionality must continue to work without modification. Multi-project features are opt-in enhancements.

### 2.3 Local-First & Cursor-First

Multi-project support maintains kaczmarek.ai-dev's core principles:
- All projects remain as local Git repositories
- Cursor IDE integration works across the workspace
- Local tools and tests remain primary verification methods
- No remote dependencies or cloud lock-in

### 2.4 Flexible Configuration

Projects can be:
- **Independent**: Standalone projects with their own config
- **Workspace Members**: Part of a larger workspace
- **Hybrid**: Workspace member with project-specific overrides

## 3. Architecture

### 3.1 Configuration Hierarchy

```
workspace-root/
├── kaczmarek-ai-workspace.json          # Workspace configuration
├── .kaczmarek/                          # Workspace-level resources
│   ├── agents/                          # Shared agent configs
│   ├── workflows/                       # Shared workflows
│   ├── prompts/                         # Shared prompts
│   └── tools/                           # Shared tools
├── projects/
│   ├── project-a/
│   │   ├── kaczmarek-ai.config.json    # Project-specific config
│   │   ├── docs/
│   │   ├── review/
│   │   └── progress/
│   └── project-b/
│       ├── kaczmarek-ai.config.json
│       ├── docs/
│       ├── review/
│       └── progress/
└── shared-docs/                         # Optional shared documentation
```

### 3.2 Workspace Configuration Format

**File**: `kaczmarek-ai-workspace.json`

```json
{
  "version": 1,
  "workspaceName": "my-company-workspace",
  "type": "workspace",
  "created": "2025-12-30",
  
  "projects": [
    {
      "name": "frontend",
      "path": "./projects/frontend",
      "type": "web-app",
      "primary": true
    },
    {
      "name": "backend",
      "path": "./projects/backend",
      "type": "api-server",
      "dependsOn": []
    },
    {
      "name": "shared-lib",
      "path": "./projects/shared-lib",
      "type": "library"
    }
  ],
  
  "shared": {
    "agentsDir": ".kaczmarek/agents",
    "workflowsDir": ".kaczmarek/workflows",
    "promptsDir": ".kaczmarek/prompts",
    "toolsDir": ".kaczmarek/tools",
    "docsDir": "shared-docs"
  },
  
  "dependencies": {
    "frontend": ["shared-lib"],
    "backend": ["shared-lib"]
  },
  
  "settings": {
    "primaryProject": "frontend",
    "versionStrategy": "independent",
    "defaultProject": "frontend"
  }
}
```

### 3.3 Project Configuration Extensions

**File**: `projects/frontend/kaczmarek-ai.config.json`

```json
{
  "version": 1,
  "projectName": "frontend",
  "workspace": {
    "enabled": true,
    "rootPath": "../../",
    "inheritShared": true,
    "overrides": {
      "agentsDir": "local-agents"
    }
  },
  "docs": {
    "docsDir": "docs",
    "reviewDir": "review",
    "progressDir": "progress"
  },
  "ai": {
    "agentsDir": "agents",
    "toolsDir": "tools",
    "workflowsDir": "workflows",
    "promptsDir": "prompts"
  }
}
```

## 4. Use Cases

### 4.1 Monorepo Management

**Scenario**: A company has multiple projects in a monorepo structure.

**Benefits**:
- Unified workflow execution across all projects
- Shared AI configurations (agents, prompts)
- Cross-project refactoring support
- Coordinated version tracking

### 4.2 Microservices Architecture

**Scenario**: Multiple microservices that need to stay in sync.

**Benefits**:
- Run workflows across all services
- Detect breaking changes between services
- Coordinate API contract changes
- Unified testing across service boundaries

### 4.3 Library + Consumers

**Scenario**: A shared library used by multiple applications.

**Benefits**:
- Test library changes against all consumers
- Propagate updates across consumers
- Version compatibility tracking
- Impact analysis for library changes

### 4.4 Multi-Language Projects

**Scenario**: Projects with frontend (JS), backend (Python), and native app (Swift).

**Benefits**:
- Language-specific agents per project
- Unified documentation and review process
- Cross-language workflow orchestration
- Shared prompt templates

## 5. Key Features

### 5.1 Workspace Commands

```bash
# Initialize a workspace
kad workspace init

# Add a project to workspace
kad workspace add ./path/to/project --name frontend --type web-app

# List workspace projects
kad workspace list

# Switch active project
kad workspace use frontend

# Run command across all projects
kad workspace exec -- npm test

# Run workflow across projects
kad workspace workflow run review-self --projects frontend,backend
```

### 5.2 Cross-Project Workflows

Workflows can target multiple projects:

```yaml
name: cross-project-test
description: Test changes across all affected projects

stages:
  - name: detect-affected
    type: analysis
    action: detect-affected-projects
    params:
      baseRef: main
      
  - name: test-affected
    type: execute
    action: run-tests
    projects: ${affected}
    params:
      parallel: true
      failFast: false
```

### 5.3 Dependency Awareness

The system tracks project dependencies:

```javascript
// When editing shared-lib, automatically:
// 1. Detect dependent projects (frontend, backend)
// 2. Suggest running tests in dependents
// 3. Update version references if needed
// 4. Create coordinated PRs across projects
```

### 5.4 Unified Context for AI

AI agents receive workspace-aware context:

```javascript
{
  "workspace": {
    "name": "my-company-workspace",
    "currentProject": "frontend",
    "allProjects": ["frontend", "backend", "shared-lib"],
    "dependencies": {
      "frontend": ["shared-lib"],
      "backend": ["shared-lib"]
    }
  },
  "project": {
    "name": "frontend",
    "type": "web-app",
    "docs": [...],
    "recentChanges": [...],
    "dependencies": {
      "shared-lib": {
        "version": "1.2.3",
        "recentChanges": [...]
      }
    }
  }
}
```

### 5.5 Resource Resolution

Resource lookup follows this order:

1. **Project-specific**: `projects/frontend/workflows/build.yaml`
2. **Workspace-shared**: `.kaczmarek/workflows/build.yaml`
3. **kaczmarek.ai-dev built-in**: `kad/workflows/build.yaml`

This allows:
- Project customization
- Shared defaults
- Built-in fallbacks

## 6. Implementation Phases

### Phase 1: Foundation (v0.18-0.20)

**Goals**: Basic workspace structure and configuration

- [ ] Define workspace configuration schema
- [ ] Implement workspace config loader
- [ ] Add workspace initialization (`kad workspace init`)
- [ ] Project discovery and registration
- [ ] Basic workspace commands (list, add, remove)
- [ ] Update `kad scan` to understand workspaces

**Deliverables**:
- `lib/workspace/config-loader.js`
- `lib/workspace/project-manager.js`
- `bin/commands/workspace.js`
- Documentation: `docs/WORKSPACE_GUIDE.md`

### Phase 2: Cross-Project Commands (v0.21-0.23)

**Goals**: Execute commands across projects

- [ ] `kad workspace exec` - run shell commands
- [ ] `kad workspace workflow` - run workflows across projects
- [ ] Project context switching
- [ ] Parallel execution support
- [ ] Aggregate result reporting

**Deliverables**:
- `lib/workspace/executor.js`
- `lib/workspace/aggregator.js`
- Enhanced workflow engine with multi-project support
- Documentation: `docs/WORKSPACE_COMMANDS.md`

### Phase 3: Dependency Management (v0.24-0.26)

**Goals**: Track and manage inter-project dependencies

- [ ] Dependency graph construction
- [ ] Affected project detection
- [ ] Version compatibility tracking
- [ ] Breaking change detection
- [ ] Coordinated version bumps

**Deliverables**:
- `lib/workspace/dependency-graph.js`
- `lib/workspace/impact-analyzer.js`
- `kad workspace graph` command
- Documentation: `docs/WORKSPACE_DEPENDENCIES.md`

### Phase 4: Shared Resources (v0.27-0.29)

**Goals**: Share workflows, agents, and configurations

- [ ] Resource resolution hierarchy
- [ ] Shared workflow templates
- [ ] Shared agent configurations
- [ ] Override mechanisms
- [ ] Inheritance system

**Deliverables**:
- `lib/workspace/resource-resolver.js`
- Enhanced config loader with inheritance
- Shared resource library
- Documentation: `docs/WORKSPACE_RESOURCES.md`

### Phase 5: Advanced Features (v0.30+)

**Goals**: Advanced workspace capabilities

- [ ] Workspace-level versions (coordinate releases)
- [ ] Cross-project refactoring support
- [ ] Workspace dashboards
- [ ] Multi-project AI context
- [ ] Monorepo optimizations

**Deliverables**:
- `lib/workspace/version-coordinator.js`
- `lib/workspace/refactor-engine.js`
- Enhanced API server with workspace support
- Documentation: `docs/WORKSPACE_ADVANCED.md`

## 7. Technical Considerations

### 7.1 Path Resolution

All path resolution must be workspace-aware:

```javascript
class PathResolver {
  constructor(workspaceRoot, projectRoot) {
    this.workspaceRoot = workspaceRoot;
    this.projectRoot = projectRoot;
  }
  
  resolve(path, context = 'project') {
    if (path.startsWith('@workspace/')) {
      return this.resolveWorkspacePath(path);
    }
    if (path.startsWith('@project/')) {
      return this.resolveProjectPath(path);
    }
    // Default: relative to project
    return join(this.projectRoot, path);
  }
  
  resolveWorkspacePath(path) {
    return join(this.workspaceRoot, path.replace('@workspace/', ''));
  }
  
  resolveProjectPath(path) {
    return join(this.projectRoot, path.replace('@project/', ''));
  }
}
```

### 7.2 Git Integration

Each project maintains its own Git repository:

```javascript
class WorkspaceGitManager {
  constructor(workspace) {
    this.workspace = workspace;
    this.projectRepos = new Map();
  }
  
  async getStatus() {
    const statuses = await Promise.all(
      this.workspace.projects.map(p => this.getProjectStatus(p))
    );
    return {
      workspace: this.workspace.name,
      projects: statuses
    };
  }
  
  async getProjectStatus(project) {
    return {
      name: project.name,
      branch: await this.getCurrentBranch(project),
      changes: await this.getChanges(project),
      upstream: await this.getUpstream(project)
    };
  }
}
```

### 7.3 Configuration Loading

Configuration loading with inheritance:

```javascript
class ConfigLoader {
  loadWithWorkspace(projectPath) {
    const projectConfig = this.loadProjectConfig(projectPath);
    
    if (!projectConfig.workspace?.enabled) {
      return projectConfig; // Standalone project
    }
    
    const workspaceConfig = this.loadWorkspaceConfig(
      projectConfig.workspace.rootPath
    );
    
    return this.mergeConfigs(workspaceConfig, projectConfig);
  }
  
  mergeConfigs(workspace, project) {
    return {
      ...project,
      workspace: workspace,
      shared: {
        agents: this.resolveShared(workspace, project, 'agents'),
        workflows: this.resolveShared(workspace, project, 'workflows'),
        // ...
      }
    };
  }
}
```

### 7.4 Workflow Engine Changes

The workflow engine needs workspace awareness:

```javascript
class WorkflowEngine {
  async executeWorkspaceWorkflow(workflow, options) {
    const { projects, parallel, failFast } = options;
    
    if (parallel) {
      return this.executeParallel(workflow, projects, { failFast });
    } else {
      return this.executeSequential(workflow, projects, { failFast });
    }
  }
  
  async executeParallel(workflow, projects, options) {
    const results = await Promise.allSettled(
      projects.map(p => this.executeForProject(workflow, p))
    );
    
    if (options.failFast && results.some(r => r.status === 'rejected')) {
      throw new Error('Workflow failed for one or more projects');
    }
    
    return this.aggregateResults(results);
  }
}
```

## 8. API Extensions

### 8.1 REST API Endpoints

```javascript
// Workspace endpoints
GET    /api/workspace                    // Get workspace info
GET    /api/workspace/projects           // List projects
POST   /api/workspace/projects           // Add project
DELETE /api/workspace/projects/:name     // Remove project
GET    /api/workspace/graph              // Dependency graph

// Cross-project operations
POST   /api/workspace/exec               // Execute command
POST   /api/workspace/workflow/run       // Run workflow
GET    /api/workspace/status             // Git status all projects
GET    /api/workspace/affected           // Get affected projects
```

### 8.2 Frontend Integration

The dashboard needs workspace views:

```javascript
// Workspace Dashboard Component
class WorkspaceDashboard {
  render() {
    return `
      <div class="workspace-view">
        <h1>${this.workspace.name}</h1>
        
        <section class="project-grid">
          ${this.renderProjectCards()}
        </section>
        
        <section class="dependency-graph">
          ${this.renderDependencyGraph()}
        </section>
        
        <section class="recent-activity">
          ${this.renderRecentActivity()}
        </section>
      </div>
    `;
  }
}
```

## 9. Testing Strategy

### 9.1 Unit Tests

```javascript
describe('WorkspaceConfigLoader', () => {
  it('should load workspace config', () => {
    const config = loader.loadWorkspace('./test-workspace');
    expect(config.projects).toHaveLength(3);
  });
  
  it('should merge workspace and project configs', () => {
    const config = loader.loadProjectWithWorkspace('./test-workspace/frontend');
    expect(config.shared.workflows).toBeDefined();
  });
});
```

### 9.2 Integration Tests

```javascript
describe('Workspace Commands', () => {
  it('should execute command across projects', async () => {
    const result = await workspace.exec('npm test', {
      projects: ['frontend', 'backend'],
      parallel: true
    });
    
    expect(result.succeeded).toHaveLength(2);
  });
});
```

### 9.3 E2E Tests

```javascript
describe('Workspace Workflow', () => {
  it('should run workflow across affected projects', async () => {
    // Make change to shared-lib
    await git.commit('Update API', ['shared-lib/src/api.js']);
    
    // Run workflow
    const result = await workflow.run('test', {
      affectedOnly: true
    });
    
    // Should test frontend and backend (consumers of shared-lib)
    expect(result.projects).toContain('frontend');
    expect(result.projects).toContain('backend');
    expect(result.projects).not.toContain('shared-lib');
  });
});
```

## 10. Migration Path

### 10.1 Existing Single Projects

Existing projects continue to work without changes:

```bash
# Project without workspace - works as before
cd /path/to/project
kad scan
kad workflow run review-self
```

### 10.2 Converting to Workspace

Users can opt-in to workspace features:

```bash
# Step 1: Initialize workspace
mkdir my-workspace
cd my-workspace
kad workspace init --name my-workspace

# Step 2: Add existing projects
kad workspace add ../existing-project-1 --name project-1
kad workspace add ../existing-project-2 --name project-2

# Step 3: Configure dependencies
kad workspace deps add project-1 --depends-on project-2

# Step 4: Create shared resources
mkdir -p .kaczmarek/workflows
cp common-workflow.yaml .kaczmarek/workflows/

# Now use workspace commands
kad workspace list
kad workspace workflow run review-self --projects all
```

### 10.3 Hybrid Approach

Projects can be both standalone and workspace members:

```bash
# As standalone
cd /path/to/project
kad workflow run build

# As workspace member
cd /path/to/workspace
kad workspace workflow run build --projects project-name
```

## 11. Documentation Requirements

### 11.1 New Documentation

- `docs/WORKSPACE_GUIDE.md` - Complete workspace guide
- `docs/WORKSPACE_COMMANDS.md` - Command reference
- `docs/WORKSPACE_DEPENDENCIES.md` - Dependency management
- `docs/WORKSPACE_RESOURCES.md` - Shared resources
- `docs/WORKSPACE_ADVANCED.md` - Advanced features
- `docs/examples/workspace/` - Example workspace setups

### 11.2 Updated Documentation

- `docs/GETTING_STARTED.md` - Add workspace quick start
- `docs/PROJECT_STRUCTURE.md` - Add workspace structure
- `README.md` - Add workspace overview
- `docs/concept.md` - Update with workspace principles

## 12. Success Metrics

### 12.1 Adoption Metrics

- Number of workspaces created
- Average projects per workspace
- Usage of cross-project commands
- Shared resource usage

### 12.2 Performance Metrics

- Parallel execution speedup
- Resource resolution time
- Config loading time
- Workflow execution time (multi-project)

### 12.3 User Satisfaction

- Ease of workspace setup
- Command discoverability
- Error message clarity
- Documentation completeness

## 13. Risks and Mitigations

### 13.1 Complexity Risk

**Risk**: Multi-project support adds significant complexity.

**Mitigation**:
- Maintain backward compatibility
- Make features opt-in
- Clear separation of concerns
- Comprehensive testing
- Extensive documentation

### 13.2 Performance Risk

**Risk**: Operations across many projects could be slow.

**Mitigation**:
- Parallel execution by default
- Caching of workspace configuration
- Lazy loading of project details
- Progress indicators for long operations
- Ability to target specific projects

### 13.3 Configuration Risk

**Risk**: Configuration inheritance could be confusing.

**Mitigation**:
- Clear resolution hierarchy
- Debug command to show effective config
- Validation of workspace config
- Good error messages
- Example configurations

## 14. Future Enhancements

### 14.1 Workspace Templates

Pre-configured workspace setups:

```bash
kad workspace init --template monorepo
kad workspace init --template microservices
kad workspace init --template library-consumers
```

### 14.2 Workspace Plugins

Extensibility for specific use cases:

```javascript
// plugins/monorepo-plugin.js
module.exports = {
  name: 'monorepo',
  hooks: {
    'workspace:init': async (workspace) => {
      // Custom setup
    }
  }
};
```

### 14.3 Remote Workspaces

Support for distributed teams:

```javascript
{
  "workspace": {
    "type": "remote",
    "projects": [
      {
        "name": "frontend",
        "repository": "git@github.com:org/frontend.git"
      }
    ]
  }
}
```

### 14.4 Workspace Analytics

Insights across projects:

- Cross-project code duplication
- Dependency version mismatches
- Test coverage across workspace
- Technical debt hotspots

## 15. Conclusion

This concept outlines a comprehensive approach to multi-project support in kaczmarek.ai-dev. The design:

- **Maintains core principles**: Local-first, Cursor-first, test-driven
- **Provides flexibility**: Works for monorepos, microservices, and multi-repo setups
- **Ensures compatibility**: Existing projects continue to work
- **Enables collaboration**: Share resources and coordinate across projects
- **Supports growth**: Clear phases for implementation

The phased implementation approach allows us to:
1. Validate core concepts early (Phase 1-2)
2. Build on solid foundations (Phase 3-4)
3. Add advanced features when needed (Phase 5+)

Next steps:
1. Review and refine this concept
2. Create detailed specifications for Phase 1
3. Begin implementation of workspace foundation
4. Gather feedback from early adopters
5. Iterate based on real-world usage

## 16. References

- [Project Structure Guide](../../docs/PROJECT_STRUCTURE.md)
- [Core Concept](../../docs/concept.md)
- [Workflow Orchestration Design](../../docs/WORKFLOW_ORCHESTRATION_DESIGN.md)
- [Getting Started Guide](../../docs/GETTING_STARTED.md)
