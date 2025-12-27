# Workflow Library System Proposal

**Status**: Proposal  
**Created**: 2025-12-23  
**Author**: kaczmarek.ai-dev  
**Related**: [VERSION_FOLDER_STRUCTURE_PROPOSAL.md](./VERSION_FOLDER_STRUCTURE_PROPOSAL.md)

---

## Executive Summary

This proposal outlines a library system for organizing workflows, dashboards, and other reusable objects. The library system aligns with the new version folder structure and provides a way to categorize, share, and version control workflow-related assets.

---

## Current State

### Current Workflow Organization
```
workflows/
├── execute-features.yaml
├── review-self.yaml
├── review-self-auto.yaml
├── example-simple.yaml
└── version_review.md
```

### Current Issues
1. **Flat structure** - All workflows in one directory, no categorization
2. **No organization** - Hard to find related workflows
3. **No reusability** - Can't easily share workflows across projects
4. **No versioning** - Workflows not tied to version structure
5. **No metadata** - Limited information about workflow purpose/context
6. **No dashboards** - No system for organizing dashboard definitions

**Note**: This proposal assumes a fresh start. Existing workflows will be migrated to the library structure.

---

## Proposed Library System

### Library Structure

```
project-root/
├── library/                           # Library root
│   ├── README.md                      # Library overview
│   ├── workflows/                     # Workflow library
│   │   ├── README.md                  # Workflow library index
│   │   ├── version-management/       # Library category
│   │   │   ├── README.md              # Category overview
│   │   │   ├── create-version.yaml
│   │   │   ├── transition-version.yaml
│   │   │   └── complete-version.yaml
│   │   ├── implementation/            # Library category
│   │   │   ├── README.md
│   │   │   ├── execute-features.yaml
│   │   │   ├── create-workstream.yaml
│   │   ├── consolidate-workstreams.yaml
│   │   ├── update-workstream-progress.yaml
│   │   └── merge-workstreams.yaml
│   │   ├── review/                    # Library category
│   │   │   ├── README.md
│   │   │   ├── review-self.yaml
│   │   │   ├── review-self-auto.yaml
│   │   │   └── generate-review-prompt.yaml
│   │   ├── testing/                   # Library category
│   │   │   ├── README.md
│   │   │   ├── run-tests.yaml
│   │   │   └── generate-test-plan.yaml
│   │   └── common/                     # Shared/common workflows
│   │       ├── README.md
│   │       └── error-handler.yaml
│   ├── dashboards/                     # Dashboard library
│   │   ├── README.md                  # Dashboard library index
│   │   ├── version-overview/          # Dashboard category
│   │   │   ├── README.md
│   │   │   ├── version-status.json    # Dashboard definition
│   │   │   └── workstream-status.json
│   │   ├── execution-monitoring/      # Dashboard category
│   │   │   ├── README.md
│   │   │   ├── workflow-executions.json
│   │   │   └── agent-status.json
│   │   └── project-health/            # Dashboard category
│   │       ├── README.md
│   │       └── project-metrics.json
│   ├── templates/                     # Template library
│   │   ├── README.md
│   │   ├── workflow-templates/
│   │   │   ├── basic-workflow.yaml.template
│   │   │   └── agent-workflow.yaml.template
│   │   └── dashboard-templates/
│   │       └── basic-dashboard.json.template
│   └── modules/                        # Module library (optional)
│       ├── README.md
│       └── custom-actions/
│           └── (custom modules)
└── workflows/                          # Active workflows (currently in use)
    └── (workflows actively being used, can be symlinks or copies from library)
```

### Library Categories

#### 1. Workflow Libraries

**Purpose**: Organize workflows by function/purpose

**Categories**:
- `version-management/` - Version creation, transition, completion
- `implementation/` - Feature implementation, workstream management
- `review/` - Review generation, analysis, updates
- `testing/` - Test execution, coverage, planning
- `deployment/` - Deployment, release, publishing
- `maintenance/` - Cleanup, refactoring, updates
- `common/` - Shared workflows, utilities

**Structure**:
```
library/workflows/
├── README.md                          # Workflow library index
├── version-management/
│   ├── README.md                      # Category description
│   ├── create-version.yaml
│   ├── transition-version.yaml
│   └── complete-version.yaml
└── implementation/
    ├── README.md
    ├── execute-features.yaml
    └── create-workstream.yaml
```

#### 2. Dashboard Libraries

**Purpose**: Organize dashboard definitions

**Categories**:
- `version-overview/` - Version status, progress, workstreams
- `execution-monitoring/` - Workflow executions, agent status
- `project-health/` - Project metrics, health checks
- `analytics/` - Analytics, reporting dashboards

**Structure**:
```
library/dashboards/
├── README.md                          # Dashboard library index
├── version-overview/
│   ├── README.md                      # Category description
│   ├── version-status.json            # Dashboard definition
│   └── workstream-status.json
└── execution-monitoring/
    ├── README.md
    ├── workflow-executions.json
    └── agent-status.json
```

#### 3. Template Libraries

**Purpose**: Reusable templates for workflows and dashboards

**Structure**:
```
library/templates/
├── README.md
├── workflow-templates/
│   ├── basic-workflow.yaml.template
│   └── agent-workflow.yaml.template
└── dashboard-templates/
    └── basic-dashboard.json.template
```

---

## Library Metadata

### Workflow Library Metadata

Each workflow in a library should include metadata:

```yaml
name: "Execute Features from Review"
version: "1.0.0"
description: "Workflow to implement features from review document's Next Steps section"

# Library metadata
library:
  category: "implementation"           # Library category
  tags: ["features", "agents", "automation"]
  author: "@developer"
  created: "2025-12-20"
  updated: "2025-12-23"
  dependencies:                        # Required modules/actions
    - module: "review"
      actions: ["find-current-version", "read-review"]
    - module: "implementation"
      actions: ["extract-next-steps", "create-plan"]
  compatibility:                       # Version compatibility
    minVersion: "0-2"
    maxVersion: null                   # null = no max
  usage:                               # Usage examples
    - description: "Run with default settings"
      command: "kad workflow run execute-features"
    - description: "Limit to 5 tasks"
      command: "kad workflow run execute-features --maxTasks 5"

# Existing workflow definition
triggers:
  - type: "cli"
    command: "kad workflow run execute-features"
    
steps:
  # ... workflow steps
```

### Dashboard Library Metadata

Dashboard definitions should include metadata:

```json
{
  "name": "Version Status Dashboard",
  "version": "1.0.0",
  "description": "Overview of current version status, workstreams, and progress",
  "library": {
    "category": "version-overview",
    "tags": ["version", "status", "progress"],
    "author": "@developer",
    "created": "2025-12-20",
    "updated": "2025-12-23",
    "compatibility": {
      "minVersion": "0-2"
    }
  },
  "widgets": [
    {
      "id": "version-status",
      "type": "status-card",
      "title": "Version Status",
      "dataSource": "/api/repo-status"
    },
    {
      "id": "workstreams",
      "type": "list",
      "title": "Active Workstreams",
      "dataSource": "/api/workstreams"
    }
  ]
}
```

---

## Library Index Files

### Main Library README

```markdown
# Workflow & Dashboard Library

This library contains reusable workflows, dashboards, and templates organized by category.

## Workflows

- [Version Management](./workflows/version-management/) - Version lifecycle workflows
- [Implementation](./workflows/implementation/) - Feature implementation workflows
- [Review](./workflows/review/) - Review and analysis workflows
- [Testing](./workflows/testing/) - Testing workflows
- [Common](./workflows/common/) - Shared utility workflows

## Dashboards

- [Version Overview](./dashboards/version-overview/) - Version status dashboards
- [Execution Monitoring](./dashboards/execution-monitoring/) - Execution tracking dashboards
- [Project Health](./dashboards/project-health/) - Project metrics dashboards

## Templates

- [Workflow Templates](./templates/workflow-templates/) - Reusable workflow templates
- [Dashboard Templates](./templates/dashboard-templates/) - Reusable dashboard templates

## Usage

### Using Workflows

```bash
# List workflows by category
kad library workflows list --category implementation

# Run a workflow from library
kad library workflows run implementation/execute-features

# Copy workflow to active workflows
kad library workflows copy implementation/execute-features
```

### Using Dashboards

```bash
# List dashboards
kad library dashboards list

# Load a dashboard
kad library dashboards load version-overview/version-status
```
```

### Category README Example

```markdown
# Implementation Workflows

Workflows for implementing features, managing workstreams, and consolidating work.

## Workflows

### execute-features
**Description**: Execute features from review document's Next Steps section  
**Usage**: `kad workflow run execute-features --maxTasks 3`  
**Dependencies**: review, implementation, agent modules

### create-workstream
**Description**: Create a new workstream for parallel development  
**Usage**: `kad workflow run create-workstream --tasks <tasks>`  
**Dependencies**: implementation module

## Related Categories

- [Review Workflows](../review/) - For review-related workflows
- [Testing Workflows](../testing/) - For testing workflows
```

---

## Integration with Version Folder Structure

### Version-Specific Libraries

Libraries can be version-specific:

```
versions/v0/0-2/
├── library/                            # Version-specific library
│   ├── workflows/
│   │   └── custom-workflow.yaml       # Version-specific workflow
│   └── dashboards/
│       └── version-dashboard.json    # Version-specific dashboard
```

### Library Inheritance

Libraries can inherit from project-level libraries:

```
project-root/
├── library/                           # Project-level library
│   └── workflows/
│       └── common/
│           └── error-handler.yaml
└── versions/v0/0-2/
    └── library/                       # Version-specific library
        └── workflows/
            └── custom/                # Extends project library
                └── custom-workflow.yaml
```

---

## CLI Commands

### Library Management

```bash
# List all libraries
kad library list

# List workflows in library
kad library workflows list [--category <category>]

# List dashboards in library
kad library dashboards list [--category <category>]

# Show library item details
kad library workflows show <category>/<workflow>
kad library dashboards show <category>/<dashboard>

# Copy workflow from library to active
kad library workflows copy <category>/<workflow> [--to <path>]

# Run workflow from library
kad library workflows run <category>/<workflow> [--params ...]

# Load dashboard from library
kad library dashboards load <category>/<dashboard>
```

### Workflow Library Commands

```bash
# List workflows by category
kad library workflows list --category implementation

# Search workflows
kad library workflows search "feature"

# Show workflow details
kad library workflows show implementation/execute-features

# Copy workflow to active workflows
kad library workflows copy implementation/execute-features

# Run workflow directly from library
kad library workflows run implementation/execute-features --maxTasks 5
```

### Dashboard Library Commands

```bash
# List dashboards
kad library dashboards list

# Show dashboard details
kad library dashboards show version-overview/version-status

# Load dashboard
kad library dashboards load version-overview/version-status

# Create dashboard from template
kad library dashboards create --from-template basic-dashboard
```

---

## API Integration

### Library API Endpoints

```javascript
// List library items
GET /api/library/workflows?category=implementation
GET /api/library/dashboards?category=version-overview

// Get library item
GET /api/library/workflows/implementation/execute-features
GET /api/library/dashboards/version-overview/version-status

// Copy library item
POST /api/library/workflows/implementation/execute-features/copy
POST /api/library/dashboards/version-overview/version-status/copy
```

---

## Database Schema Updates

### Library Tables

```sql
-- Library items (workflows, dashboards, etc.)
CREATE TABLE library_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                  -- 'workflow', 'dashboard', 'template'
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  file_path TEXT NOT NULL,
  metadata TEXT,                       -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_library_items_type ON library_items(type);
CREATE INDEX idx_library_items_category ON library_items(category);

-- Library usage tracking
CREATE TABLE library_usage (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,            -- 'run', 'copy', 'load'
  usage_data TEXT,                     -- JSON usage data
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES library_items(id)
);
```

---

## Migration Strategy

### Phase 1: Library Structure (Week 1)
1. Create `library/` directory structure
2. Move existing workflows to appropriate categories
3. Create README files for each category
4. Add metadata to existing workflows

### Phase 2: CLI Commands (Week 2)
1. Implement `kad library` commands
2. Add library listing/search functionality
3. Add workflow/dashboard copy/load commands

### Phase 3: API Integration (Week 3)
1. Add library API endpoints
2. Update frontend to show library items
3. Add library browser UI

### Phase 4: Dashboard Support (Week 4)
1. Define dashboard JSON format
2. Implement dashboard loading
3. Create dashboard templates

---

## Benefits

### 1. **Organization**
- Clear categorization of workflows and dashboards
- Easy to find related items
- Better discoverability

### 2. **Reusability**
- Share workflows across projects
- Reuse dashboard definitions
- Template system for quick creation

### 3. **Version Alignment**
- Libraries can be version-specific
- Aligns with version folder structure
- Supports version-specific workflows

### 4. **Documentation**
- README files provide context
- Metadata describes usage and dependencies
- Examples and usage patterns

### 5. **Extensibility**
- Easy to add new categories
- Support for custom libraries
- Template system for rapid creation

---

## Recommendations

### ✅ Recommended Approach

1. **Library Structure**: Organize by type (workflows, dashboards, templates) and category
2. **Metadata**: Add library metadata to all items
3. **CLI Integration**: Full CLI support for library management
4. **API Support**: REST API for library access
5. **Version Alignment**: Support version-specific libraries
6. **Template System**: Provide templates for common patterns

### Key Features

1. **Categorization** - Organize by function/purpose
2. **Metadata** - Rich metadata for discoverability
3. **CLI Commands** - Easy library management
4. **API Integration** - Programmatic access
5. **Version Support** - Version-specific libraries
6. **Templates** - Reusable templates

---

## Example: Migrating Existing Workflows

### Before
```
workflows/
├── execute-features.yaml
├── review-self.yaml
├── review-self-auto.yaml
└── example-simple.yaml
```

### After
```
library/
└── workflows/
    ├── implementation/
    │   └── execute-features.yaml
    ├── review/
    │   ├── review-self.yaml
    │   └── review-self-auto.yaml
    └── common/
        └── example-simple.yaml

workflows/                              # Active workflows (symlinks or copies)
├── execute-features.yaml -> ../library/workflows/implementation/execute-features.yaml
└── review-self.yaml -> ../library/workflows/review/review-self.yaml
```

---

## Questions to Consider

1. **Should workflows be in library or active workflows?**
   - **Recommendation**: Library for reusable, active for project-specific
   - **Solution**: Support both, with ability to copy from library

2. **How to handle workflow versioning?**
   - **Recommendation**: Use semantic versioning in workflow metadata
   - **Solution**: Track versions in library metadata

3. **Should dashboards be version-controlled?**
   - **Recommendation**: Yes, dashboards are configuration
   - **Solution**: Store in library, version with git

4. **How to handle library dependencies?**
   - **Recommendation**: Declare dependencies in metadata
   - **Solution**: Validate dependencies when loading

5. **Should libraries be project-specific or shared?**
   - **Recommendation**: Both - project libraries + shared libraries
   - **Solution**: Support multiple library paths

---

## Conclusion

The library system provides a structured way to organize workflows, dashboards, and templates. It aligns with the version folder structure and enables better organization, reusability, and discoverability.

**Next Steps**:
1. Review and discuss this proposal
2. Decide on library structure and categories
3. Create migration plan
4. Implement library system
5. Migrate existing workflows
6. Add dashboard support

