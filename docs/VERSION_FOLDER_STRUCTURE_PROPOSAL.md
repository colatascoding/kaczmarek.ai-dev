# Version Folder Structure Proposal

**Status**: Proposal  
**Created**: 2025-12-23  
**Author**: kaczmarek.ai-dev  
**Related**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md), [VERSION_TRANSITION.md](./VERSION_TRANSITION.md)

---

## Executive Summary

This proposal outlines a redesign of the version file system from flat markdown files (`review/versionX-Y.md`, `progress/versionX-Y.md`) to a folder-based structure with stage-specific subdirectories. The goal is to improve organization, enable better workflow automation, and provide clearer separation of concerns across the development lifecycle.

---

## Current Structure

### Current Layout
```
project-root/
├── review/
│   ├── version0-1.md
│   └── version0-2.md
├── progress/
│   ├── version0-1.md
│   └── version0-2.md
└── docs/
    └── (various documentation files)
```

### Current Issues
1. **Flat structure** - All version data in single files, hard to navigate
2. **Mixed concerns** - Review and progress files contain overlapping information
3. **No stage separation** - Planning, implementation, testing, and review are all mixed together
4. **Limited scalability** - As versions grow, files become unwieldy
5. **Poor tooling support** - Hard to programmatically access specific stages
6. **Documentation scattered** - Version-specific docs are separate from version files

---

## Proposed Structure

### Option A: Flat Structure (All Versions Equal)
```
project-root/
├── versions/
│   ├── 0-1/
│   │   ├── README.md                    # Version overview and quick reference
│   │   ├── 01_plan/
│   │   ├── 02_implement/
│   │   ├── 03_test/
│   │   ├── 04_review/
│   │   └── docs/
│   ├── 0-2/
│   │   └── (same structure)
│   ├── 1-0/                             # Major version - same structure
│   │   └── (same structure)
│   └── 1-1/
│       └── (same structure)
└── docs/
```

### Option B: Major Version Grouping (Recommended)
```
project-root/
├── versions/
│   ├── v0/                              # Major version 0 group
│   │   ├── 0-1/
│   │   │   ├── README.md
│   │   │   ├── 01_plan/
│   │   │   ├── 02_implement/
│   │   │   ├── 03_test/
│   │   │   ├── 04_review/
│   │   │   ├── docs/                    # Version-specific documentation
│   │   │   └── library/                 # Version-specific library
│   │   │       ├── workflows/
│   │   │       └── dashboards/
│   │   ├── 0-2/
│   │   │   └── (same structure)
│   │   └── README.md                    # Major version 0 overview
│   ├── v1/                              # Major version 1 group
│   │   ├── 1-0/                         # First minor of major 1
│   │   │   └── (same structure)
│   │   ├── 1-1/
│   │   │   └── (same structure)
│   │   └── README.md                    # Major version 1 overview
│   └── INDEX.md                         # Version index across all majors
├── library/                             # Project-level library
│   ├── workflows/
│   ├── dashboards/
│   └── templates/
└── docs/
```

### Option C: Hybrid (Major Versions Get Special Treatment)
```
project-root/
├── versions/
│   ├── 0-1/                             # Minor versions: flat structure
│   │   └── (standard structure)
│   ├── 0-2/
│   │   └── (standard structure)
│   ├── 1-0/                             # Major versions: enhanced structure
│   │   ├── README.md
│   │   ├── 00_migration/                # Special: migration planning
│   │   │   ├── breaking-changes.md
│   │   │   ├── migration-guide.md
│   │   │   └── compatibility.md
│   │   ├── 01_plan/
│   │   ├── 02_implement/
│   │   ├── 03_test/
│   │   ├── 04_review/
│   │   └── docs/
│   └── 1-1/                             # Back to standard after major
│       └── (standard structure)
└── docs/
```

### File Structure Details

#### Root Level: `versions/X-Y/README.md`
**Purpose**: Quick reference and navigation hub for the version

**Content**:
- Version metadata (status, dates, owner)
- Links to all stage folders
- Quick status summary
- Navigation to related docs

**Example**:
```markdown
# Version 0-2

**Status**: In Progress  
**Started**: 2025-12-20  
**Owner**: @developer

## Quick Links
- [Planning](./01_plan/goals.md)
- [Implementation](./02_implement/progress.md)
- [Testing](./03_test/test-plan.md)
- [Review](./04_review/review.md)

## Status Summary
- **Goals**: 8 defined, 5 completed
- **Tasks**: 12 total, 7 in progress, 3 completed
- **Tests**: 45 tests, 42 passing
- **Review**: Pending
```

#### Stage 01: Planning (`01_plan/`)

**Files**:
- `goals.md` - High-level goals and objectives
- `scope.md` - What's in/out of scope
- `architecture.md` - Architectural decisions (optional, for major changes)
- `tasks.md` - Initial task breakdown and estimates

**Purpose**: Define what needs to be done before implementation starts

**Example `goals.md`**:
```markdown
# Version 0-2 Goals

## Primary Objectives
- [x] Implement comprehensive testing framework
- [x] Add workflow execution outcome determination
- [ ] Complete documentation updates
- [ ] Validate end-to-end workflows

## Success Criteria
- All new features have unit tests
- Workflow outcomes are automatically determined
- Documentation is up-to-date
```

#### Stage 02: Implementation (`02_implement/`)

**Files**:
- `progress.md` - Chronological implementation log (replaces current progress.md)
- `decisions.md` - Key technical decisions made during implementation
- `changes.md` - Detailed change log (what changed, why, impact)
- `workstreams/` - **NEW**: Parallel workstream tracking (see below)

**Purpose**: Track what's being built and how

**Example `progress.md`**:
```markdown
# Implementation Progress - Version 0-2

## 2025-12-20
**Workflow Engine Refactoring**
- Split engine.js into 5 modules
- Added outcome determination logic
- All tests passing

## 2025-12-21
**Agent Management**
- Added filtering and sorting
- Implemented auto-completion logic
```

##### Parallel Workstreams Support (`02_implement/workstreams/`)

**Structure for parallel workstreams**:
```
02_implement/
├── progress.md              # Consolidated progress (merged from workstreams)
├── decisions.md             # Consolidated decisions
├── changes.md               # Consolidated changes
└── workstreams/            # Individual workstream tracking
    ├── workstream-1/        # First parallel workstream
    │   ├── README.md        # Workstream overview
    │   ├── tasks.md         # Tasks assigned to this workstream
    │   ├── progress.md      # Workstream-specific progress
    │   ├── decisions.md    # Workstream-specific decisions
    │   ├── agent-status.md # Background agent status
    │   └── changes.md      # Workstream-specific changes
    ├── workstream-2/        # Second parallel workstream
    │   └── (same structure)
    └── INDEX.md             # Workstream index and status
```

**Purpose**: Enable parallel development with multiple background agents

**Example `workstreams/workstream-1/README.md`**:
```markdown
# Workstream 1: Testing Framework

**Status**: In Progress  
**Agent**: agent-abc123  
**Started**: 2025-12-20  
**Owner**: Background Agent

## Tasks
- [x] Set up Jest framework
- [x] Create test utilities
- [ ] Add integration tests
- [ ] Update documentation

## Progress
See [progress.md](./progress.md) for detailed logs.

## Agent Status
- **Type**: Cursor Cloud Agent
- **Status**: running
- **Last Update**: 2025-12-21 10:30
```

**Example `workstreams/INDEX.md`**:
```markdown
# Active Workstreams - Version 0-2

## Workstream 1: Testing Framework
- **Status**: In Progress
- **Agent**: agent-abc123
- **Tasks**: 4 total, 2 completed
- **Link**: [workstream-1/](./workstream-1/)

## Workstream 2: API Refactoring
- **Status**: In Progress
- **Agent**: agent-def456
- **Tasks**: 6 total, 1 completed
- **Link**: [workstream-2/](./workstream-2/)

## Summary
- **Active**: 2 workstreams
- **Total Tasks**: 10
- **Completed**: 3
- **In Progress**: 7
```

#### Stage 03: Testing (`03_test/`)

**Files**:
- `test-plan.md` - Testing strategy, what to test, how
- `test-results.md` - Test execution results and outcomes
- `coverage.md` - Coverage reports and analysis

**Purpose**: Ensure quality and validate implementation

**Example `test-plan.md`**:
```markdown
# Test Plan - Version 0-2

## Unit Tests
- [x] Workflow engine modules
- [x] Outcome determination
- [ ] Follow-up suggestions

## Integration Tests
- [x] Workflow execution
- [ ] Agent processing
```

#### Stage 04: Review (`04_review/`)

**Files**:
- `review.md` - Final version review (replaces current review.md)
- `retrospective.md` - What went well, what didn't, improvements
- `completion.md` - Completion checklist and sign-off

**Purpose**: Reflect on the version and prepare for next

**Example `review.md`**:
```markdown
# Version 0-2 Review

## Summary
This version focused on production readiness...

## Achievements
- Testing framework implemented
- Workflow outcomes automated
...

## Next Steps
- Documentation updates
- Performance optimization
```

#### Version-Specific Docs (`docs/`)

**Files**: Version-specific documentation that doesn't belong in project-wide `docs/`
- API changes
- Migration guides
- Breaking changes
- Version-specific configuration

---

## Benefits of Proposed Structure

### 1. **Clear Separation of Concerns**
- Each stage has its own folder and purpose
- Easy to find information by development phase
- Reduces cognitive load when navigating

### 2. **Better Workflow Integration**
- Workflows can target specific stages
- Automated tools can operate on stage-specific files
- Clear progression through stages

### 3. **Improved Scalability**
- Large versions don't result in massive single files
- Each stage can grow independently
- Easier to archive or reference specific stages

### 4. **Enhanced Tooling Support**
- Programmatic access to specific stages
- Better support for automation (e.g., "update 02_implement/progress.md")
- Easier to generate stage-specific reports

### 5. **Better Documentation Organization**
- Version-specific docs live with the version
- Clear relationship between docs and version
- Easier to find relevant documentation

### 6. **Workflow Automation**
- Workflows can automatically create stage files
- Stage transitions can be automated
- Better integration with CI/CD

---

## Challenges and Concerns

### 1. **Migration Complexity**
**Challenge**: Migrating existing `review/` and `progress/` files to new structure

**Impact**: 
- Need migration script/tool
- Risk of data loss
- Breaking changes to existing workflows

**Mitigation**:
- Create migration tool that preserves all data
- Support both old and new structure during transition
- Provide clear migration guide

### 2. **Breaking Changes to Codebase**
**Challenge**: All code that references `review/versionX-Y.md` needs updating

**Impact**:
- `lib/modules/review/file-operations.js` needs major refactor
- `lib/api/routes/versions.js` needs updates
- CLI commands need updates
- Workflows need updates

**Mitigation**:
- Create abstraction layer for version file access
- Support both old and new paths during transition
- Incremental migration

### 3. **File Proliferation**
**Challenge**: More files to manage, potential for inconsistency

**Impact**:
- More files to track
- Risk of files getting out of sync
- Harder to get "full picture" at a glance

**Mitigation**:
- Strong README.md in each version folder
- Tools to generate consolidated views
- Clear file naming conventions

### 4. **Stage Rigidity**
**Challenge**: Not all versions follow the same stage progression

**Impact**:
- Some versions might skip stages
- Stages might overlap
- Hard to handle non-linear workflows

**Mitigation**:
- Make stages optional
- Allow custom stages
- Support stage skipping

### 5. **Tooling Overhead**
**Challenge**: More complex to find and access version data

**Impact**:
- Need to know folder structure
- More paths to manage
- Harder for simple scripts

**Mitigation**:
- Provide helper functions/utilities
- Abstract file access behind API
- Good documentation

### 6. **Git History**
**Challenge**: Moving files breaks git history

**Impact**:
- Lose file history
- Harder to track changes over time
- Git blame becomes less useful

**Mitigation**:
- Use `git mv` to preserve history
- Consider git submodules or subtrees
- Document migration in commit messages

---

## Alternative Approaches

### Alternative 1: Hybrid Approach
Keep flat files but add stage metadata:

```
review/
├── version0-1.md (with stage markers: <!-- STAGE:plan -->)
└── version0-2.md

progress/
├── version0-1.md
└── version0-2.md
```

**Pros**: Minimal migration, backward compatible  
**Cons**: Still flat, limited organization

### Alternative 2: Single Version Folder with Metadata
```
versions/
└── 0-2/
    ├── README.md
    ├── review.md
    ├── progress.md
    └── metadata.json  # Stage info, status, etc.
```

**Pros**: Simpler than full stage structure  
**Cons**: Still doesn't separate concerns well

### Alternative 3: Tag-Based Organization
Keep flat files but use tags/metadata:

```markdown
# Version 0-2
<!-- stage: implement -->
<!-- status: in-progress -->
```

**Pros**: No file structure changes  
**Cons**: Requires parsing, less visible organization

---

## Recommended Improvements

### 1. **Flexible Stage System**
Instead of fixed `01_plan`, `02_implement`, etc., use a configurable system:

```json
{
  "stages": [
    { "id": "plan", "name": "Planning", "required": true },
    { "id": "implement", "name": "Implementation", "required": true },
    { "id": "test", "name": "Testing", "required": false },
    { "id": "review", "name": "Review", "required": true }
  ]
}
```

**Benefit**: Projects can customize stages to their workflow

### 2. **Stage Status Tracking**
Add status to each stage folder:

```
01_plan/
├── .status          # "completed" | "in-progress" | "pending"
├── goals.md
└── scope.md
```

**Benefit**: Clear visibility of version progress

### 3. **Consolidated Views**
Provide tools to generate consolidated views:

```bash
kad version consolidate 0-2  # Generates single-file view
kad version stage 0-2 plan    # Shows only planning stage
```

**Benefit**: Best of both worlds - organized structure + easy overview

### 4. **Version Metadata File**
Add `version.json` to each version folder:

```json
{
  "version": "0-2",
  "status": "in-progress",
  "started": "2025-12-20",
  "stages": {
    "plan": { "status": "completed", "completedAt": "2025-12-20" },
    "implement": { "status": "in-progress" },
    "test": { "status": "pending" },
    "review": { "status": "pending" }
  }
}
```

**Benefit**: Machine-readable metadata for tooling

### 5. **Backward Compatibility Layer**
Create abstraction that supports both old and new structures:

```javascript
const versionFiles = getVersionFiles("0-2");
// Returns same interface whether old or new structure
```

**Benefit**: Gradual migration, no breaking changes

### 6. **Stage Templates**
Provide templates for each stage:

```
templates/
├── 01_plan/
│   ├── goals.md.template
│   └── scope.md.template
└── 02_implement/
    └── progress.md.template
```

**Benefit**: Consistency across versions

### 7. **Version Index**
Create `versions/INDEX.md` that lists all versions:

```markdown
# Version Index

- [Version 0-2](./0-2/README.md) - In Progress
- [Version 0-1](./0-1/README.md) - Completed
```

**Benefit**: Easy navigation and discovery

---

## Migration Strategy

### Phase 1: Preparation (Week 1)
1. Create migration tool
2. Add backward compatibility layer
3. Update documentation
4. Test migration on copy of repo

### Phase 2: Implementation (Week 2-3)
1. Implement version folder structure creation
2. Update code to use new structure
3. Migrate one version as pilot
4. Gather feedback

### Phase 3: Full Migration (Week 4)
1. Migrate all existing versions to new structure
2. Update workflows to use new paths (see WORKFLOW_LIBRARY_PROPOSAL.md)
3. Update CLI commands
4. Test all functionality

### Phase 4: Integration (Week 5)
1. Integrate with library system
2. Add version-specific library support
3. Update all documentation
4. Final testing

---

## Implementation Considerations

### Code Changes Required

1. **`lib/modules/review/file-operations.js`**
   - Update `findCurrentVersion` to look in `versions/` folder
   - Update file path resolution
   - Add stage-aware file access

2. **`lib/modules/review/version-management.js`**
   - Update `createNextVersion` to create folder structure
   - Add stage management functions

3. **`lib/api/routes/versions.js`**
   - Update to read from new structure
   - Add stage-specific endpoints

4. **Workflows**
   - Update `review-self-auto.yaml` to use new paths
   - Update `execute-features.yaml` to use new paths

5. **CLI Commands**
   - Update `kad scan` to recognize new structure
   - Update `kad progress` to write to new location
   - Add `kad version stage` command

### Configuration Changes

Update `kaczmarek-ai.config.json`:

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

**Configuration Fields**:
- `docs.versionsDir`: Root directory for version folders
- `library.libraryDir`: Project-level library directory
- `library.versionSpecificLibraries`: Enable version-specific libraries
- `workflows.activeDir`: Directory for active (currently used) workflows
- `workflows.discoveryOrder`: Priority order for workflow discovery

---

## Major vs Minor Version Differentiation

### Current Behavior
Currently, the system **only increments minor versions** (0-1 → 0-2 → 0-3). There's no mechanism to create major versions (0-X → 1-0).

### Should We Differentiate?

**Arguments FOR differentiation:**
1. **Semantic meaning** - Major versions typically represent breaking changes, major milestones, or architectural shifts
2. **Organization** - Grouping minor versions under major versions improves navigation
3. **Documentation** - Major versions often need migration guides, breaking change docs
4. **Workflow differences** - Major versions might need different workflows (migration planning, compatibility checks)
5. **Historical context** - Easier to see evolution within a major version line

**Arguments AGAINST differentiation:**
1. **Simplicity** - Flat structure is easier to navigate
2. **Flexibility** - Projects might not follow semantic versioning
3. **Overhead** - Additional complexity in code and workflows
4. **Current usage** - Most projects might only use minor versions

### Recommended Approach: **Option B with Flexibility**

**Structure**: Major version grouping (Option B) with configurable behavior

**Rationale**:
- Major versions are significant milestones that deserve special treatment
- Grouping minor versions under major versions improves organization
- But keep it flexible - projects can opt for flat structure if preferred

**Implementation**:
1. **Default**: Group by major version (`versions/v0/`, `versions/v1/`)
2. **Configurable**: Allow flat structure via config
3. **Workflow differentiation**:
   - Minor version transition: Standard workflow (current behavior)
   - Major version transition: Enhanced workflow with migration planning
4. **Documentation**: Major versions get additional docs (migration guides, breaking changes)

### Major Version Workflow Differences

#### Minor Version Transition (0-2 → 0-3)
- Standard workflow: Complete tasks → Create next version
- Same structure as previous
- Inherits context from previous minor version

#### Major Version Transition (0-X → 1-0)
- Enhanced workflow:
  1. **Migration Planning Stage** (`00_migration/`)
     - Breaking changes analysis
     - Migration guide creation
     - Compatibility assessment
  2. **Standard stages** (plan, implement, test, review)
  3. **Additional validation**:
     - Breaking change checklist
     - Migration guide completeness
     - Backward compatibility notes

### Configuration

Add to `kaczmarek-ai.config.json`:

```json
{
  "versioning": {
    "groupByMajor": true,              // Group minor versions under major
    "majorVersionWorkflow": "enhanced", // Use enhanced workflow for majors
    "autoIncrementType": "minor"       // "minor" | "major" | "prompt"
  }
}
```

### Version Creation Logic

```javascript
// Current: Always increments minor
createNextVersion() → 0-1 → 0-2 → 0-3

// Proposed: Configurable increment
createNextVersion({ incrementType: "minor" }) → 0-1 → 0-2
createNextVersion({ incrementType: "major" }) → 0-2 → 1-0
createNextVersion({ incrementType: "auto" })  → Prompts user
```

### Folder Structure Impact

**If grouping by major version:**
- `versions/v0/0-1/` - First minor of major 0
- `versions/v0/0-2/` - Second minor of major 0
- `versions/v1/1-0/` - First minor of major 1 (major version transition)
- `versions/v1/1-1/` - Second minor of major 1

**Benefits**:
- Clear major version boundaries
- Easier to see evolution within a major line
- Natural place for major version docs (`versions/v1/README.md`)

**Challenges**:
- More complex path resolution
- Need to handle both grouped and flat structures
- Migration from flat to grouped

## Parallel Workstreams with Background Agents

### Use Case
When implementing multiple features simultaneously using background agents, each workstream needs:
- **Isolated tracking** - Each agent writes to its own space
- **Progress visibility** - See what each workstream is doing
- **Consolidation** - Merge results back together
- **Coordination** - Avoid conflicts and track dependencies

### Proposed Structure

#### Option A: Workstream Subfolders (Recommended)
```
versions/v0/0-2/
├── 02_implement/
│   ├── progress.md              # Consolidated from all workstreams
│   ├── decisions.md             # Consolidated decisions
│   ├── changes.md               # Consolidated changes
│   └── workstreams/
│       ├── INDEX.md             # Active workstreams overview
│       ├── workstream-1/        # First workstream
│       │   ├── README.md        # Workstream overview
│       │   ├── tasks.md         # Assigned tasks
│       │   ├── progress.md      # Workstream progress
│       │   ├── decisions.md    # Workstream decisions
│       │   ├── agent-status.md # Agent tracking
│       │   └── changes.md      # Workstream changes
│       └── workstream-2/        # Second workstream
│           └── (same structure)
```

**Benefits**:
- Clear separation between workstreams
- Easy to track individual agent progress
- Natural consolidation point
- Can merge workstreams at review stage

#### Option B: Tagged Entries in Single Files
```
02_implement/
├── progress.md  # All entries tagged with workstream ID
├── decisions.md # All entries tagged with workstream ID
```

**Example**:
```markdown
## 2025-12-20 [workstream-1]
**Testing Framework Setup**
- Set up Jest framework
- Created test utilities

## 2025-12-20 [workstream-2]
**API Refactoring**
- Started API route refactoring
```

**Benefits**:
- Simpler structure
- All progress in one place
- Easy to filter by workstream

**Drawbacks**:
- Harder to isolate workstream work
- Potential merge conflicts
- Less clear organization

### Workflow Integration

#### Creating Workstreams
```yaml
# In execute-features workflow
- id: "create-workstream"
  module: "implementation"
  action: "create-workstream"
  inputs:
    versionTag: "{{ steps.find-version.outputs.versionTag }}"
    tasks: "{{ steps.create-plan.outputs.plan.tasks }}"
    agentId: "{{ steps.launch-agent.outputs.agentTaskId }}"
  outputs:
    - name: "workstreamId"
      type: "string"
      - name: "workstreamPath"
        type: "string"
```

#### Agent Writing to Workstream
```yaml
# Agent writes to its workstream folder
- id: "update-workstream-progress"
  module: "implementation"
  action: "update-workstream-progress"
  inputs:
    workstreamId: "{{ steps.create-workstream.outputs.workstreamId }}"
    progress: "{{ agent.progress }}"
```

#### Consolidating Workstreams
```yaml
# At review stage, merge all workstreams
- id: "consolidate-workstreams"
  module: "implementation"
  action: "consolidate-workstreams"
  inputs:
    versionTag: "{{ steps.find-version.outputs.versionTag }}"
  outputs:
    - name: "consolidatedProgress"
      type: "string"
```

### Workstream Metadata

Each workstream should have metadata:

```json
{
  "workstreamId": "workstream-1",
  "name": "Testing Framework",
  "status": "in-progress",
  "agentId": "agent-abc123",
  "agentType": "cursor-cloud",
  "started": "2025-12-20",
  "tasks": {
    "total": 4,
    "completed": 2,
    "inProgress": 1,
    "pending": 1
  },
  "dependencies": ["workstream-2"],  // Optional
  "conflicts": []  // Track potential conflicts
}
```

### Recommendations

1. **Default Structure**: Use workstream subfolders (Option A)
   - Better isolation
   - Easier to track individual progress
   - Natural merge point

2. **Workstream Naming**: Use descriptive names or IDs
   - `workstream-testing-framework/`
   - `workstream-api-refactoring/`
   - Or: `workstream-1/`, `workstream-2/` with README.md for description

3. **Consolidation Strategy**:
   - **During implementation**: Keep separate
   - **At review stage**: Merge into consolidated files
   - **Option**: Keep both (separate + consolidated)

4. **Agent Integration**:
   - Agents write to their workstream folder
   - Workstream index tracks all active workstreams
   - UI shows workstream status

5. **Conflict Detection**:
   - Track file changes per workstream
   - Detect overlapping changes
   - Warn about potential conflicts

## Recommendations

### ✅ Recommended Approach

**Major Version Grouping with Flexibility + Parallel Workstreams**:
1. **Default**: Group minor versions under major versions (`versions/v0/0-1/`)
2. **Configurable**: Allow flat structure for projects that prefer it
3. **Workflow differentiation**: Enhanced workflow for major version transitions
4. **Metadata**: Add `version.json` with version type (major/minor)
5. **Backward compatibility**: Support both structures during migration
6. **Stages**: Make stages configurable per project
7. **Consolidated views**: Generate single-file views when needed
8. **Parallel workstreams**: Support `02_implement/workstreams/` for concurrent agent work ⭐ **NEW**
   - Each workstream gets its own subfolder
   - Workstream index tracks all active workstreams
   - Consolidation happens at review stage
   - Agents write to their assigned workstream folder

### Key Improvements to Include

1. **Flexible stage configuration** - Don't force all projects into same stages
2. **Stage status tracking** - Clear visibility of progress
3. **Consolidated views** - Best of both worlds
4. **Version metadata** - Machine-readable for tooling
5. **Backward compatibility** - Smooth migration path
6. **Templates** - Consistency and ease of use

### Migration Priority

1. **High Priority**: Backward compatibility layer
2. **High Priority**: Migration tool
3. **Medium Priority**: Stage flexibility
4. **Medium Priority**: Consolidated views
5. **Low Priority**: Templates (can add later)

---

## Questions to Consider

1. **Do all versions need all stages?**
   - Some versions might be bug fixes (no planning stage)
   - Some might skip testing
   - Solution: Make stages optional

2. **How to handle overlapping stages?**
   - Implementation and testing often overlap
   - Solution: Allow concurrent stages, track in metadata

3. **What about version-specific docs?**
   - Should they be in `versions/X-Y/docs/` or `docs/versions/X-Y/`?
   - Recommendation: `versions/X-Y/docs/` (keeps version together)

4. **How to handle archived versions?**
   - Should old versions be moved to `versions/archive/`?
   - Recommendation: Keep in `versions/`, mark as archived in metadata

5. **What about cross-version documentation?**
   - Some docs span multiple versions
   - Recommendation: Keep in project-wide `docs/`

---

## Conclusion

The proposed folder-based structure offers significant benefits in organization, scalability, and tooling support. However, it requires careful migration planning and consideration of backward compatibility.

**Recommended Next Steps**:
1. Review and discuss this proposal
2. Decide on stage flexibility requirements
3. Create detailed migration plan
4. Build backward compatibility layer
5. Implement migration tool
6. Pilot with one version
7. Iterate based on feedback

---

## Appendix: Example File Contents

### `versions/v0/0-2/README.md` (Minor Version)
```markdown
# Version 0-2

**Type**: Minor Version  
**Status**: In Progress  
**Started**: 2025-12-20  
**Current Stage**: Implementation

## Quick Navigation
- 📋 [Planning](./01_plan/goals.md) - ✅ Completed
- 🔨 [Implementation](./02_implement/progress.md) - 🔄 In Progress
- 🧪 [Testing](./03_test/test-plan.md) - ⏳ Pending
- 📝 [Review](./04_review/review.md) - ⏳ Pending

## Summary
This version focuses on production readiness and developer experience improvements.

## Metrics
- Goals: 8 defined, 5 completed (62%)
- Tasks: 12 total, 7 in progress, 3 completed (25%)
- Tests: 45 tests, 42 passing (93%)
```

### `versions/v1/1-0/README.md` (Major Version)
```markdown
# Version 1-0

**Type**: Major Version  
**Status**: In Progress  
**Started**: 2025-12-25  
**Previous Major**: 0-5  
**Current Stage**: Migration Planning

## Quick Navigation
- 🚀 [Migration Planning](./00_migration/breaking-changes.md) - 🔄 In Progress
- 📋 [Planning](./01_plan/goals.md) - ⏳ Pending
- 🔨 [Implementation](./02_implement/progress.md) - ⏳ Pending
- 🧪 [Testing](./03_test/test-plan.md) - ⏳ Pending
- 📝 [Review](./04_review/review.md) - ⏳ Pending

## Summary
This major version introduces breaking changes and requires migration from v0.

## Breaking Changes
- API endpoint restructuring
- Database schema migration required
- Configuration format changes

## Metrics
- Breaking Changes: 3 identified
- Migration Tasks: 5 defined
```

### `versions/v0/0-2/01_plan/goals.md`
```markdown
# Version 0-2 Goals

## Primary Objectives
- [x] Implement comprehensive testing framework
- [x] Add workflow execution outcome determination
- [ ] Complete documentation updates
- [ ] Validate end-to-end workflows

## Success Criteria
- All new features have unit tests
- Workflow outcomes are automatically determined
- Documentation is up-to-date
```

### `versions/v0/0-2/02_implement/progress.md`
```markdown
# Implementation Progress - Version 0-2

## 2025-12-20
**Workflow Engine Refactoring**
- Split engine.js into 5 modules
- Added outcome determination logic
- All tests passing

## 2025-12-21
**Agent Management**
- Added filtering and sorting
- Implemented auto-completion logic
```

### `versions/v0/0-2/version.json` (Minor Version)
```json
{
  "version": "0-2",
  "major": 0,
  "minor": 2,
  "type": "minor",
  "status": "in-progress",
  "started": "2025-12-20",
  "stages": {
    "plan": {
      "status": "completed",
      "completedAt": "2025-12-20"
    },
    "implement": {
      "status": "in-progress",
      "startedAt": "2025-12-20"
    },
    "test": {
      "status": "pending"
    },
    "review": {
      "status": "pending"
    }
  }
}
```

### `versions/v1/1-0/version.json` (Major Version)
```json
{
  "version": "1-0",
  "major": 1,
  "minor": 0,
  "type": "major",
  "status": "in-progress",
  "started": "2025-12-25",
  "previousMajor": "0-5",
  "stages": {
    "migration": {
      "status": "in-progress",
      "startedAt": "2025-12-25"
    },
    "plan": {
      "status": "pending"
    },
    "implement": {
      "status": "pending"
    },
    "test": {
      "status": "pending"
    },
    "review": {
      "status": "pending"
    }
  },
  "breakingChanges": [
    "API endpoint changes",
    "Database schema migration required",
    "Configuration format changes"
  ]
}
```

### `versions/v0/README.md` (Major Version Overview)
```markdown
# Major Version 0

**Status**: Active  
**Versions**: 0-1 through 0-5  
**Current**: 0-5

## Version History
- [Version 0-5](./0-5/README.md) - In Progress
- [Version 0-4](./0-4/README.md) - Completed
- [Version 0-3](./0-3/README.md) - Completed
- [Version 0-2](./0-2/README.md) - Completed
- [Version 0-1](./0-1/README.md) - Completed

## Major Version Summary
This major version focused on establishing core functionality and workflows.

## Key Achievements
- Testing framework implementation
- Workflow automation
- Agent management system
- API server architecture
```

### `versions/v1/1-0/00_migration/breaking-changes.md` (Major Version Migration)
```markdown
# Breaking Changes - Version 1-0

## API Changes
- **Endpoint restructuring**: All endpoints now use `/api/v1/` prefix
- **Authentication**: New token-based auth required
- **Response format**: JSON structure changed

## Database Changes
- **Schema migration**: New tables added, old tables deprecated
- **Migration script**: `npm run migrate:v1`

## Configuration Changes
- **Config format**: YAML → JSON
- **Environment variables**: New required variables added
```

