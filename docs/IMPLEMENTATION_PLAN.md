# Implementation Plan: Version Folder Structure & Workflow Library

**Status**: Implementation Plan  
**Created**: 2025-12-23  
**Related**: 
- [VERSION_FOLDER_STRUCTURE_PROPOSAL.md](./VERSION_FOLDER_STRUCTURE_PROPOSAL.md)
- [WORKFLOW_LIBRARY_PROPOSAL.md](./WORKFLOW_LIBRARY_PROPOSAL.md)
- [PROPOSAL_REVIEW.md](./PROPOSAL_REVIEW.md)

---

## Overview

This implementation plan covers the migration from the current flat file structure to the new version folder structure with integrated workflow library system. The plan is organized into phases with clear dependencies and milestones.

**Timeline**: 6-8 weeks  
**Approach**: Fresh start (no backward compatibility needed)

---

## Phase 1: Foundation & Structure (Week 1-2)

### Goals
- Create new directory structures
- Set up configuration system
- Implement core file operations

### Tasks

#### 1.1 Directory Structure Creation
- [ ] Create `versions/` directory structure
- [ ] Create `library/` directory structure
- [ ] Create version folder structure for existing version (0-2)
- [ ] Create library categories (workflows, dashboards, templates)
- [ ] Add README files to all directories

**Files to create**:
```
versions/
├── v0/
│   ├── 0-1/
│   │   ├── README.md
│   │   ├── 01_plan/
│   │   ├── 02_implement/
│   │   ├── 03_test/
│   │   ├── 04_review/
│   │   ├── docs/
│   │   └── library/
│   └── 0-2/ (same structure)
└── INDEX.md

library/
├── README.md
├── workflows/
│   ├── README.md
│   ├── version-management/
│   ├── implementation/
│   ├── review/
│   ├── testing/
│   └── common/
├── dashboards/
│   ├── README.md
│   ├── version-overview/
│   ├── execution-monitoring/
│   └── project-health/
└── templates/
    ├── README.md
    ├── workflow-templates/
    └── dashboard-templates/
```

#### 1.2 Configuration System
- [ ] Update `kaczmarek-ai.config.json` schema
- [ ] Add library configuration section
- [ ] Add workflow discovery configuration
- [ ] Create configuration loader/validator
- [ ] Add configuration migration tool

**Configuration to add**:
```json
{
  "docs": {
    "docsDir": "docs",
    "versionsDir": "versions"
  },
  "library": {
    "libraryDir": "library",
    "workflowsDir": "library/workflows",
    "dashboardsDir": "library/dashboards",
    "templatesDir": "library/templates",
    "versionSpecificLibraries": true
  },
  "workflows": {
    "activeDir": "workflows",
    "discoveryOrder": ["active", "version-specific", "library"]
  }
}
```

#### 1.3 Core File Operations
- [ ] Create `lib/modules/review/file-operations-v2.js` for new structure
- [ ] Implement version folder path resolution
- [ ] Implement stage-aware file access
- [ ] Add workstream folder operations
- [ ] Create file migration utilities

**Key Functions**:
- `findVersionFolder(versionTag)` - Find version folder path
- `getStagePath(versionTag, stage)` - Get stage folder path
- `getWorkstreamPath(versionTag, workstreamId)` - Get workstream path
- `migrateVersionFiles(oldPath, newPath)` - Migrate files

#### 1.4 Testing
- [ ] Unit tests for directory creation
- [ ] Unit tests for configuration loading
- [ ] Unit tests for file operations
- [ ] Integration test for structure creation

**Deliverables**:
- ✅ Directory structures created
- ✅ Configuration system working
- ✅ Core file operations implemented
- ✅ Tests passing

---

## Phase 2: Version Management (Week 2-3)

### Goals
- Implement version folder operations
- Migrate existing versions
- Create version management utilities

### Tasks

#### 2.1 Version Folder Operations
- [ ] Update `lib/modules/review/version-management.js`
- [ ] Implement `createVersionFolder()` - Create new version folder structure
- [ ] Implement `findCurrentVersion()` - Find current version folder
- [ ] Implement `getVersionStages()` - Get all stages for a version
- [ ] Implement `getVersionMetadata()` - Read version.json

**Key Functions**:
```javascript
async function createVersionFolder(versionTag, options) {
  // Creates: versions/v0/0-2/ with all stages
}

async function findCurrentVersion(cwd) {
  // Finds latest version folder
}

async function getVersionStages(versionTag) {
  // Returns: ['01_plan', '02_implement', '03_test', '04_review']
}
```

#### 2.2 Stage Management
- [ ] Implement stage status tracking
- [ ] Create stage metadata files (`.status` files)
- [ ] Implement stage transition logic
- [ ] Add stage validation

**Stage Operations**:
- `getStageStatus(versionTag, stage)` - Get stage status
- `setStageStatus(versionTag, stage, status)` - Update stage status
- `validateStage(versionTag, stage)` - Validate stage completeness

#### 2.3 Version Migration
- [ ] Create migration script `bin/migrate-versions.js`
- [ ] Migrate `review/version0-1.md` → `versions/v0/0-1/04_review/review.md`
- [ ] Migrate `progress/version0-1.md` → `versions/v0/0-1/02_implement/progress.md`
- [ ] Migrate `review/version0-2.md` → `versions/v0/0-2/04_review/review.md`
- [ ] Migrate `progress/version0-2.md` → `versions/v0/0-2/02_implement/progress.md`
- [ ] Create version.json for each migrated version
- [ ] Generate README.md for each version

**Migration Logic**:
1. Parse existing review/progress files
2. Extract goals → `01_plan/goals.md`
3. Extract progress → `02_implement/progress.md`
4. Extract review → `04_review/review.md`
5. Create version.json with metadata
6. Create README.md

#### 2.4 Version API Updates
- [ ] Update `lib/api/routes/versions.js`
- [ ] Add stage-specific endpoints
- [ ] Add version folder endpoints
- [ ] Update version listing to use new structure

**New Endpoints**:
- `GET /api/versions/:versionTag/stages` - List stages
- `GET /api/versions/:versionTag/stages/:stage` - Get stage data
- `GET /api/versions/:versionTag/workstreams` - List workstreams

#### 2.5 Testing
- [ ] Unit tests for version operations
- [ ] Unit tests for stage management
- [ ] Integration tests for version migration
- [ ] Test version API endpoints

**Deliverables**:
- ✅ Version folder operations working
- ✅ Existing versions migrated
- ✅ Stage management implemented
- ✅ API endpoints updated

---

## Phase 3: Workflow Library System (Week 3-4)

### Goals
- Implement workflow discovery
- Create library management system
- Migrate existing workflows

### Tasks

#### 3.1 Workflow Discovery Engine
- [ ] Create `lib/workflow/discovery.js`
- [ ] Implement discovery priority logic
- [ ] Implement short ID resolution
- [ ] Implement full path resolution
- [ ] Add workflow caching

**Key Functions**:
```javascript
async function discoverWorkflow(workflowId, currentVersion) {
  // 1. Check active workflows
  // 2. Check version-specific library
  // 3. Check project library
  // Returns: { path, source, metadata }
}

function resolveWorkflowId(workflowId) {
  // Resolves short ID to full path
  // Handles: "execute-features" vs "implementation/execute-features"
}
```

#### 3.2 Library Management
- [ ] Create `lib/library/manager.js`
- [ ] Implement library item indexing
- [ ] Implement library search
- [ ] Implement library item metadata parsing
- [ ] Add library validation

**Key Functions**:
- `indexLibrary()` - Index all library items
- `searchLibrary(query, type)` - Search library
- `getLibraryItem(category, name)` - Get library item
- `validateLibraryItem(item)` - Validate library item

#### 3.3 Workflow Migration
- [ ] Create migration script `bin/migrate-workflows.js`
- [ ] Categorize existing workflows:
  - `execute-features.yaml` → `library/workflows/implementation/`
  - `review-self.yaml` → `library/workflows/review/`
  - `review-self-auto.yaml` → `library/workflows/review/`
  - `example-simple.yaml` → `library/workflows/common/`
- [ ] Add library metadata to each workflow
- [ ] Create category README files
- [ ] Create symlinks in `workflows/` for active workflows

**Workflow Metadata to Add**:
```yaml
library:
  category: "implementation"
  tags: ["features", "agents", "automation"]
  author: "@developer"
  created: "2025-12-20"
  updated: "2025-12-23"
  dependencies:
    - module: "review"
      actions: ["find-current-version", "read-review"]
  compatibility:
    minVersion: "0-2"
```

#### 3.4 Workflow Engine Updates
- [ ] Update `lib/workflow/workflow-manager.js` to use discovery
- [ ] Update `lib/workflow/engine.js` to support multiple locations
- [ ] Update workflow loading to check all locations
- [ ] Add workflow source tracking

#### 3.5 Database Schema Updates
- [ ] Extend `workflows` table:
  ```sql
  ALTER TABLE workflows ADD COLUMN library_path TEXT;
  ALTER TABLE workflows ADD COLUMN library_category TEXT;
  ALTER TABLE workflows ADD COLUMN is_library BOOLEAN DEFAULT 0;
  ALTER TABLE workflows ADD COLUMN source TEXT;
  ```
- [ ] Create `library_items` table
- [ ] Create `library_usage` table
- [ ] Create `dashboards` table
- [ ] Add indexes

#### 3.6 Testing
- [ ] Unit tests for workflow discovery
- [ ] Unit tests for library management
- [ ] Integration tests for workflow migration
- [ ] Test workflow execution from all locations

**Deliverables**:
- ✅ Workflow discovery working
- ✅ Library system implemented
- ✅ Existing workflows migrated
- ✅ Database schema updated

---

## Phase 4: CLI Commands (Week 4-5)

### Goals
- Implement library CLI commands
- Update existing workflow commands
- Add version management commands

### Tasks

#### 4.1 Library CLI Commands
- [ ] Create `bin/commands/library/index.js`
- [ ] Implement `kad library list`
- [ ] Implement `kad library workflows list [--category]`
- [ ] Implement `kad library workflows show <category>/<workflow>`
- [ ] Implement `kad library workflows copy <category>/<workflow>`
- [ ] Implement `kad library workflows run <category>/<workflow>`
- [ ] Implement `kad library workflows search <query>`
- [ ] Implement `kad library dashboards list`
- [ ] Implement `kad library dashboards show <category>/<dashboard>`
- [ ] Implement `kad library dashboards load <category>/<dashboard>`

**Command Structure**:
```bash
kad library
  workflows
    list [--category <category>]
    show <category>/<workflow>
    copy <category>/<workflow> [--to <path>]
    run <category>/<workflow> [--params ...]
    search <query>
  dashboards
    list [--category <category>]
    show <category>/<dashboard>
    load <category>/<dashboard>
```

#### 4.2 Version CLI Commands
- [ ] Create `bin/commands/version/index.js`
- [ ] Implement `kad version list`
- [ ] Implement `kad version show <versionTag>`
- [ ] Implement `kad version stage <versionTag> <stage>`
- [ ] Implement `kad version create [--major|--minor]`
- [ ] Implement `kad version migrate`

**Command Structure**:
```bash
kad version
  list
  show <versionTag>
  stage <versionTag> <stage> [status|files]
  create [--major|--minor]
  migrate
```

#### 4.3 Workflow Command Updates
- [ ] Update `kad workflow list` to show library workflows
- [ ] Update `kad workflow run` to use discovery
- [ ] Add `--from-library` flag to workflow commands
- [ ] Update workflow status to show source

#### 4.4 Testing
- [ ] Test all library commands
- [ ] Test version commands
- [ ] Test updated workflow commands
- [ ] Integration tests for CLI

**Deliverables**:
- ✅ Library CLI commands working
- ✅ Version CLI commands working
- ✅ Workflow commands updated
- ✅ All commands tested

---

## Phase 5: API Integration (Week 5-6)

### Goals
- Implement library API endpoints
- Update version API endpoints
- Add dashboard API endpoints

### Tasks

#### 5.1 Library API Routes
- [ ] Create `lib/api/routes/library.js`
- [ ] Implement `GET /api/library/workflows`
- [ ] Implement `GET /api/library/workflows/:category/:workflow`
- [ ] Implement `POST /api/library/workflows/:category/:workflow/copy`
- [ ] Implement `POST /api/library/workflows/:category/:workflow/run`
- [ ] Implement `GET /api/library/dashboards`
- [ ] Implement `GET /api/library/dashboards/:category/:dashboard`
- [ ] Implement `POST /api/library/dashboards/:category/:dashboard/load`
- [ ] Implement `GET /api/library/search`

**API Endpoints**:
```javascript
GET  /api/library/workflows?category=implementation
GET  /api/library/workflows/implementation/execute-features
POST /api/library/workflows/implementation/execute-features/copy
POST /api/library/workflows/implementation/execute-features/run
GET  /api/library/dashboards?category=version-overview
GET  /api/library/dashboards/version-overview/version-status
POST /api/library/dashboards/version-overview/version-status/load
GET  /api/library/search?q=feature&type=workflow
```

#### 5.2 Version API Updates
- [ ] Update `lib/api/routes/versions.js`
- [ ] Add `GET /api/versions/:versionTag/stages`
- [ ] Add `GET /api/versions/:versionTag/stages/:stage`
- [ ] Add `GET /api/versions/:versionTag/workstreams`
- [ ] Add `GET /api/versions/:versionTag/library`

#### 5.3 Dashboard API
- [ ] Create `lib/api/routes/dashboards.js`
- [ ] Implement `GET /api/dashboards`
- [ ] Implement `GET /api/dashboards/:id`
- [ ] Implement `POST /api/dashboards` (create)
- [ ] Implement `PUT /api/dashboards/:id` (update)
- [ ] Implement `DELETE /api/dashboards/:id`

#### 5.4 Frontend Integration
- [ ] Update `frontend/views/workflows.js` to show library workflows
- [ ] Add library browser UI
- [ ] Add version folder browser UI
- [ ] Add dashboard loader UI
- [ ] Update workflow execution to show source

#### 5.5 Testing
- [ ] Unit tests for API routes
- [ ] Integration tests for API endpoints
- [ ] Frontend integration tests
- [ ] End-to-end API tests

**Deliverables**:
- ✅ Library API endpoints working
- ✅ Version API updated
- ✅ Dashboard API implemented
- ✅ Frontend integrated

---

## Phase 6: Dashboard System (Week 6-7)

### Goals
- Implement dashboard JSON schema
- Create dashboard rendering engine
- Build dashboard templates

### Tasks

#### 6.1 Dashboard Schema
- [ ] Create `lib/dashboard/schema.js` - JSON schema definition
- [ ] Create schema validator
- [ ] Add schema documentation
- [ ] Create schema examples

**Schema Location**: `lib/dashboard/dashboard-schema.json`

#### 6.2 Dashboard Engine
- [ ] Create `lib/dashboard/engine.js`
- [ ] Implement dashboard loading
- [ ] Implement widget rendering
- [ ] Implement data source connectors
- [ ] Add dashboard caching

**Widget Types to Implement**:
- `status-card` - Status display with metrics
- `list` - List of items
- `chart` - Data visualization (basic)
- `table` - Tabular data
- `metric` - Single metric display
- `progress` - Progress indicator

**Data Source Connectors**:
- `api` - REST API endpoint
- `workflow` - Workflow execution data
- `static` - Static data
- `computed` - Computed from other widgets

#### 6.3 Dashboard Templates
- [ ] Create `library/templates/dashboard-templates/basic-dashboard.json.template`
- [ ] Create `library/templates/dashboard-templates/version-overview.json.template`
- [ ] Create `library/templates/dashboard-templates/execution-monitoring.json.template`
- [ ] Add template documentation

#### 6.4 Dashboard Library
- [ ] Create initial dashboards:
  - `library/dashboards/version-overview/version-status.json`
  - `library/dashboards/version-overview/workstream-status.json`
  - `library/dashboards/execution-monitoring/workflow-executions.json`
  - `library/dashboards/execution-monitoring/agent-status.json`

#### 6.5 Frontend Dashboard UI
- [ ] Create `frontend/views/dashboards.js`
- [ ] Implement dashboard renderer
- [ ] Implement widget components
- [ ] Add dashboard loading UI
- [ ] Add dashboard configuration UI

#### 6.6 Testing
- [ ] Unit tests for dashboard schema
- [ ] Unit tests for dashboard engine
- [ ] Unit tests for widget rendering
- [ ] Integration tests for dashboards
- [ ] Frontend dashboard tests

**Deliverables**:
- ✅ Dashboard schema defined
- ✅ Dashboard engine working
- ✅ Dashboard templates created
- ✅ Dashboard library populated
- ✅ Frontend dashboard UI working

---

## Phase 7: Workstream Management (Week 7-8)

### Goals
- Implement workstream workflows
- Create workstream management system
- Add workstream consolidation

### Tasks

#### 7.1 Workstream Workflows
- [ ] Create `library/workflows/implementation/create-workstream.yaml`
- [ ] Create `library/workflows/implementation/consolidate-workstreams.yaml`
- [ ] Create `library/workflows/implementation/update-workstream-progress.yaml`
- [ ] Create `library/workflows/implementation/merge-workstreams.yaml`
- [ ] Test all workstream workflows

#### 7.2 Workstream Operations
- [ ] Create `lib/modules/implementation/workstream-operations.js`
- [ ] Implement `create-workstream` action
- [ ] Implement `update-workstream-progress` action
- [ ] Implement `consolidate-workstreams` action
- [ ] Implement `merge-workstreams` action

**Key Functions**:
```javascript
async function createWorkstream(inputs, context) {
  // Creates workstream folder structure
  // Returns: { workstreamId, workstreamPath }
}

async function consolidateWorkstreams(inputs, context) {
  // Merges all workstreams into consolidated files
  // Returns: { consolidatedProgress, consolidatedDecisions }
}
```

#### 7.3 Workstream API
- [ ] Add `GET /api/workstreams` - List all workstreams
- [ ] Add `GET /api/workstreams/:id` - Get workstream details
- [ ] Add `GET /api/versions/:versionTag/workstreams` - Get version workstreams
- [ ] Add `POST /api/workstreams` - Create workstream
- [ ] Add `PUT /api/workstreams/:id` - Update workstream
- [ ] Add `POST /api/workstreams/consolidate` - Consolidate workstreams

#### 7.4 Workstream UI
- [ ] Update `frontend/views/agents.js` to show workstreams
- [ ] Add workstream detail view
- [ ] Add workstream creation UI
- [ ] Add workstream consolidation UI

#### 7.5 Testing
- [ ] Unit tests for workstream operations
- [ ] Integration tests for workstream workflows
- [ ] Test workstream consolidation
- [ ] Test parallel workstream execution

**Deliverables**:
- ✅ Workstream workflows created
- ✅ Workstream operations implemented
- ✅ Workstream API working
- ✅ Workstream UI implemented

---

## Phase 8: Integration & Testing (Week 8)

### Goals
- End-to-end integration testing
- Performance optimization
- Documentation updates
- Final validation

### Tasks

#### 8.1 Integration Testing
- [ ] Test complete version lifecycle:
  - Create version → Plan → Implement → Test → Review
- [ ] Test workflow execution from all locations
- [ ] Test workstream creation and consolidation
- [ ] Test dashboard loading and rendering
- [ ] Test version transitions

#### 8.2 Performance Optimization
- [ ] Add workflow discovery caching
- [ ] Add library indexing caching
- [ ] Optimize file operations
- [ ] Add database query optimization
- [ ] Performance testing

#### 8.3 Documentation
- [ ] Update `docs/PROJECT_STRUCTURE.md`
- [ ] Create `docs/VERSION_MANAGEMENT.md`
- [ ] Create `docs/WORKFLOW_LIBRARY.md`
- [ ] Create `docs/DASHBOARD_GUIDE.md`
- [ ] Update `docs/GETTING_STARTED.md`
- [ ] Create migration guide

#### 8.4 Final Validation
- [ ] Validate all workflows work
- [ ] Validate all API endpoints
- [ ] Validate all CLI commands
- [ ] Validate frontend functionality
- [ ] Code review
- [ ] Final testing

**Deliverables**:
- ✅ All systems integrated
- ✅ Performance optimized
- ✅ Documentation complete
- ✅ System validated

---

## Dependencies

### Critical Path
1. Phase 1 (Foundation) → Phase 2 (Version Management)
2. Phase 1 (Foundation) → Phase 3 (Workflow Library)
3. Phase 3 (Workflow Library) → Phase 4 (CLI Commands)
4. Phase 3 (Workflow Library) → Phase 5 (API Integration)
5. Phase 5 (API Integration) → Phase 6 (Dashboard System)
6. Phase 2 (Version Management) → Phase 7 (Workstream Management)

### Parallel Work
- Phase 4 (CLI) and Phase 5 (API) can be done in parallel
- Phase 6 (Dashboard) can start after Phase 5 API basics
- Phase 7 (Workstream) can start after Phase 2 basics

---

## Risk Mitigation

### High Risk Items
1. **File Migration Complexity**
   - Risk: Data loss during migration
   - Mitigation: Create backup, test on copy first, validate after migration

2. **Workflow Discovery Performance**
   - Risk: Slow workflow discovery with multiple locations
   - Mitigation: Implement caching, index library items, optimize search

3. **Breaking Changes**
   - Risk: Existing workflows break with new structure
   - Mitigation: Test all workflows, provide migration scripts, document changes

### Medium Risk Items
1. **Dashboard Schema Evolution**
   - Risk: Schema changes break existing dashboards
   - Mitigation: Version schema, provide migration tools

2. **Workstream Conflicts**
   - Risk: Conflicts when consolidating workstreams
   - Mitigation: Conflict detection, manual resolution process

---

## Success Criteria

### Phase 1 Success
- ✅ All directory structures created
- ✅ Configuration system working
- ✅ Core file operations tested

### Phase 2 Success
- ✅ Existing versions migrated successfully
- ✅ Version operations working
- ✅ Stage management functional

### Phase 3 Success
- ✅ Workflow discovery working correctly
- ✅ All workflows migrated to library
- ✅ Workflows executable from all locations

### Phase 4 Success
- ✅ All CLI commands working
- ✅ Library commands functional
- ✅ Version commands functional

### Phase 5 Success
- ✅ All API endpoints working
- ✅ Frontend integrated
- ✅ Library browser functional

### Phase 6 Success
- ✅ Dashboard schema validated
- ✅ Dashboards rendering correctly
- ✅ Dashboard templates available

### Phase 7 Success
- ✅ Workstream workflows working
- ✅ Workstream consolidation functional
- ✅ Parallel workstreams supported

### Phase 8 Success
- ✅ All systems integrated
- ✅ Performance acceptable
- ✅ Documentation complete

---

## Timeline Summary

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1: Foundation | 2 weeks | Week 1 | Week 2 |
| Phase 2: Version Management | 1 week | Week 2 | Week 3 |
| Phase 3: Workflow Library | 1 week | Week 3 | Week 4 |
| Phase 4: CLI Commands | 1 week | Week 4 | Week 5 |
| Phase 5: API Integration | 1 week | Week 5 | Week 6 |
| Phase 6: Dashboard System | 1 week | Week 6 | Week 7 |
| Phase 7: Workstream Management | 1 week | Week 7 | Week 8 |
| Phase 8: Integration & Testing | 1 week | Week 8 | Week 8 |

**Total**: 8 weeks

---

## Next Steps

1. **Review this plan** - Ensure all tasks are clear
2. **Set up project board** - Create issues/tasks for each phase
3. **Start Phase 1** - Begin with directory structure creation
4. **Daily standups** - Track progress and blockers
5. **Weekly reviews** - Review completed phases and adjust plan

---

## Notes

- This plan assumes a fresh start (no backward compatibility)
- All existing data will be migrated to new structure
- Testing should be done at each phase
- Documentation should be updated as we go
- Consider creating a feature branch for this work


