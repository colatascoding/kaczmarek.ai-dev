# Proposal Review: Missing Pieces, Inconsistencies, and Problems

**Status**: Review  
**Created**: 2025-12-23  
**Reviewing**: [VERSION_FOLDER_STRUCTURE_PROPOSAL.md](./VERSION_FOLDER_STRUCTURE_PROPOSAL.md), [WORKFLOW_LIBRARY_PROPOSAL.md](./WORKFLOW_LIBRARY_PROPOSAL.md)

---

## Critical Missing Pieces

### 1. **Workflow Discovery and Loading**

**Problem**: Library proposal doesn't explain how the workflow engine discovers and loads workflows from the library structure.

**Current Behavior**: 
- Workflow engine loads from `workflows/` directory (flat structure)
- `workflow-manager.js` expects workflows in `workflowsDir`

**Missing**:
- How engine discovers workflows in `library/workflows/category/workflow.yaml`
- How to resolve library workflows vs active workflows
- Priority order: library vs active vs version-specific
- How workflow IDs are resolved (e.g., `execute-features` vs `implementation/execute-features`)

**Recommendation**: Add workflow discovery strategy:
```javascript
// Discovery order:
// 1. Active workflows (workflows/)
// 2. Version-specific library (versions/v0/0-2/library/workflows/)
// 3. Project library (library/workflows/)
```

### 2. **Active vs Library Workflows**

**Problem**: Unclear distinction between "active" and "library" workflows.

**Missing**:
- What makes a workflow "active"?
- Should active workflows be symlinks, copies, or separate?
- How to promote library workflow to active?
- How to demote active workflow to library?
- Can same workflow exist in both places?

**Recommendation**: Define clearly:
- **Active workflows**: Currently in use, directly executable
- **Library workflows**: Reusable templates, organized by category
- **Relationship**: Active workflows can be copies or symlinks from library

### 3. **Version-Specific Library Integration**

**Problem**: Version structure proposal doesn't show library integration.

**Missing in Version Proposal**:
- No mention of `library/` folder in version structure
- How version-specific workflows are discovered
- How version-specific libraries inherit from project library

**Missing in Library Proposal**:
- How version-specific libraries are loaded
- Priority/resolution when same workflow exists in both
- How version transitions affect version-specific libraries

**Recommendation**: Update version structure to include:
```
versions/v0/0-2/
├── library/
│   ├── workflows/
│   └── dashboards/
```

### 4. **Configuration Updates**

**Problem**: No mention of configuration changes needed.

**Missing**:
- Updates to `kaczmarek-ai.config.json` for library paths
- How to configure library directories
- How to configure version-specific library paths
- Backward compatibility with existing config

**Recommendation**: Add configuration section:
```json
{
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

### 5. **Database Schema Integration**

**Problem**: Library proposal mentions database but doesn't integrate with existing schema.

**Current Schema**:
- `workflows` table stores workflow definitions
- `executions` table references workflows by ID

**Missing**:
- How library workflows are stored in database
- How to track library vs active workflows
- How to handle library workflow updates
- How to version library workflows in database

**Recommendation**: Extend schema:
```sql
ALTER TABLE workflows ADD COLUMN library_path TEXT;
ALTER TABLE workflows ADD COLUMN library_category TEXT;
ALTER TABLE workflows ADD COLUMN is_library BOOLEAN DEFAULT 0;
```

### 6. **API Integration**

**Problem**: No mention of how API handles library workflows.

**Current API**:
- `/api/workflows` lists workflows from `workflowsDir`
- Workflows loaded from filesystem

**Missing**:
- API endpoints for library workflows
- How to list library workflows vs active workflows
- How to load workflow from library via API
- How to copy workflow from library via API

**Recommendation**: Add API endpoints:
```
GET /api/library/workflows
GET /api/library/workflows/:category/:workflow
POST /api/library/workflows/:category/:workflow/copy
```

### 7. **Dashboard Implementation**

**Problem**: Dashboard format defined but no implementation details.

**Missing**:
- Dashboard JSON schema/validation
- How dashboards are loaded/rendered
- How dashboard widgets connect to data sources
- How to create custom dashboards
- Dashboard versioning

**Recommendation**: Add dashboard schema and implementation section.

### 8. **Workstream-Library Integration**

**Problem**: Workstreams mentioned in version structure but no library workflows for workstream management.

**Missing**:
- Library workflows for workstream operations:
  - `create-workstream.yaml`
  - `consolidate-workstreams.yaml`
  - `update-workstream-progress.yaml`
- How workstreams relate to library workflows

**Recommendation**: Ensure library includes workstream management workflows.

### 9. **Migration Strategy**

**Problem**: Both proposals mention migration but lack detailed steps.

**Missing**:
- Step-by-step migration from current structure
- How to migrate existing workflows to library
- How to handle workflows during version structure migration
- Rollback strategy
- Data migration (database updates)

**Recommendation**: Add detailed migration guide with:
1. Pre-migration checklist
2. Step-by-step migration commands
3. Post-migration validation
4. Rollback procedures

### 10. **Testing and Validation**

**Problem**: No mention of how to test/validate library items.

**Missing**:
- How to validate library workflows
- How to test library workflows
- How to validate dashboard definitions
- CI/CD integration for library items

**Recommendation**: Add testing section.

---

## Inconsistencies

### 1. **Workflow Directory Structure**

**Version Proposal**: Doesn't mention workflows at all  
**Library Proposal**: Shows `workflows/` as "active workflows" but unclear relationship

**Inconsistency**: How do workflows fit into version structure?

**Recommendation**: Clarify:
- Active workflows stay in `workflows/` (project root)
- Library workflows in `library/workflows/`
- Version-specific workflows in `versions/v0/0-2/library/workflows/`

### 2. **Version-Specific Libraries**

**Version Proposal**: Shows `docs/` in version folders but no `library/`  
**Library Proposal**: Shows `versions/v0/0-2/library/` but not in version structure

**Inconsistency**: Version structure doesn't include library folder

**Recommendation**: Update version structure to include:
```
versions/v0/0-2/
├── library/
│   ├── workflows/
│   └── dashboards/
```

### 3. **Workflow Naming**

**Current**: Workflows identified by filename (e.g., `execute-features.yaml` → ID: `execute-features`)  
**Library Proposal**: Workflows in categories (e.g., `implementation/execute-features.yaml`)

**Inconsistency**: How to resolve workflow IDs?

**Recommendation**: Support both:
- Short ID: `execute-features` (searches all locations)
- Full path: `implementation/execute-features` (specific location)

### 4. **Stage-Workflow Relationship**

**Version Proposal**: Mentions "workflows can target specific stages"  
**Library Proposal**: Doesn't mention how library workflows relate to stages

**Inconsistency**: How do library workflows interact with version stages?

**Recommendation**: Add section on stage-aware workflows.

### 5. **Documentation Location**

**Version Proposal**: Version-specific docs in `versions/v0/0-2/docs/`  
**Library Proposal**: No mention of how library relates to version docs

**Inconsistency**: Should library items be in version docs or separate?

**Recommendation**: Clarify separation:
- Version docs: Version-specific documentation
- Library: Reusable workflows/dashboards

---

## Problems

### 1. **Circular Dependencies**

**Problem**: Version structure migration might need workflows, but workflows might need version structure.

**Example**: 
- `create-next-version` workflow needs to create version folder structure
- But workflow might be in library that references version structure

**Recommendation**: Define bootstrap process:
1. Create basic version structure manually
2. Migrate workflows to library
3. Use library workflows for future versions

### 2. **Path Resolution Complexity**

**Problem**: Multiple locations for workflows (active, library, version-specific) creates complexity.

**Issues**:
- Which workflow is used when same name exists in multiple places?
- How to resolve conflicts?
- Performance impact of searching multiple locations

**Recommendation**: 
- Define clear priority order
- Cache workflow locations
- Provide explicit path resolution

### 3. **Backward Compatibility**

**Problem**: Existing code expects workflows in `workflows/` directory.

**Affected Code**:
- `workflow-manager.js` - expects `workflowsDir`
- `lib/api/routes/workflows.js` - reads from `workflowsDir`
- CLI commands - reference workflows by ID

**Recommendation**: 
- Maintain backward compatibility
- Support both old and new structures during transition
- Provide migration tool

### 4. **Git Workflow**

**Problem**: Library structure might complicate git workflows.

**Issues**:
- Should library be in separate branch?
- How to handle library updates?
- How to share libraries across projects?

**Recommendation**: 
- Library in main branch (version controlled)
- Consider git submodules for shared libraries
- Document git workflow

### 5. **Performance Concerns**

**Problem**: Searching multiple library locations could be slow.

**Issues**:
- File system scans for workflow discovery
- No caching mechanism mentioned
- Database queries for library items

**Recommendation**:
- Cache workflow locations
- Index library items in database
- Lazy loading for library items

### 6. **Dashboard Format Ambiguity**

**Problem**: Dashboard JSON format is example only, no schema.

**Issues**:
- No validation
- No versioning
- Unclear widget types
- Unclear data source format

**Recommendation**:
- Define JSON schema
- Add validation
- Provide widget library

### 7. **Workstream Consolidation**

**Problem**: Workstreams mentioned but no clear consolidation process.

**Issues**:
- How to merge workstream progress?
- How to handle conflicts?
- When to consolidate?

**Recommendation**: 
- Add consolidation workflow to library
- Define consolidation rules
- Add conflict resolution

### 8. **Version Transition Impact**

**Problem**: How do library workflows handle version transitions?

**Issues**:
- What happens to version-specific libraries on transition?
- How to migrate workflows between versions?
- How to handle breaking changes in workflows?

**Recommendation**:
- Define version transition workflow
- Add workflow compatibility checks
- Support workflow migration

---

## Recommendations Summary

### High Priority Fixes

1. **Add workflow discovery strategy** - Define how engine finds workflows
2. **Clarify active vs library** - Clear distinction and relationship
3. **Update version structure** - Include `library/` folder
4. **Add configuration section** - Update `kaczmarek-ai.config.json`
5. **Extend database schema** - Support library workflows
6. **Add API endpoints** - Library workflow access
7. **Define dashboard schema** - JSON schema and validation

### Medium Priority Fixes

8. **Add migration guide** - Step-by-step migration process
9. **Add testing section** - How to test library items
10. **Clarify path resolution** - Priority order and conflict resolution
11. **Add workstream workflows** - Library workflows for workstream management

### Low Priority Fixes

12. **Performance optimization** - Caching and indexing
13. **Git workflow** - Document git practices
14. **Dashboard implementation** - Implementation details

---

## Action Items

1. ✅ Create this review document
2. ⏳ Update version structure proposal to include `library/` folder
3. ⏳ Update library proposal with workflow discovery strategy
4. ⏳ Add configuration section to both proposals
5. ⏳ Define dashboard JSON schema
6. ⏳ Create detailed migration guide
7. ⏳ Add API integration details
8. ⏳ Add database schema updates
9. ⏳ Add testing and validation section
10. ⏳ Resolve all inconsistencies listed above

