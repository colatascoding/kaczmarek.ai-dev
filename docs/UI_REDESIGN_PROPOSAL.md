# UI Redesign Proposal: Stage-Based Wizard Flow

## Current State Analysis

### Current UI Structure
- **Dashboard**: Overview with stats and repo status
- **Workflows**: List of all workflows
- **Agents**: Background agent tasks
- **Executions**: Execution history
- **Versions**: Version list
- **Dashboards**: Library dashboards

### Issues with Current UI
1. **No clear workflow guidance**: Users don't know what to do next
2. **Disconnected views**: Stages are not visually connected
3. **No version creation flow**: Creating a new version requires manual file creation
4. **Workstream management hidden**: Parallel workstreams are not easily accessible
5. **Stage progression unclear**: No visual indication of where you are in the version lifecycle

## Proposed Design: Stage-Based Wizard Flow

### Core Concept
Align the UI with the version folder structure stages:
- **01_plan** → Planning Stage
- **02_implement** → Implementation Stage  
- **03_test** → Testing Stage
- **04_review** → Review Stage

### Main Navigation Structure

```
┌─────────────────────────────────────────────────┐
│  kaczmarek.ai-dev                               │
├─────────────────────────────────────────────────┤
│  [Home] [Versions] [Workflows] [Library] [Help] │
└─────────────────────────────────────────────────┘
```

### Home View (Default Dashboard)
**Purpose**: Quick overview and next actions

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Current Version: v0-2                                  │
│  Status: In Progress                                     │
├─────────────────────────────────────────────────────────┤
│  Stage Progress                                         │
│  [✓ Plan] → [→ Implement] → [○ Test] → [○ Review]    │
├─────────────────────────────────────────────────────────┤
│  Quick Actions                                          │
│  [Create New Version] [Start Workstream] [Run Review]  │
├─────────────────────────────────────────────────────────┤
│  Active Workstreams (2)                                │
│  • Feature A - Implementation (3 tasks)                │
│  • Feature B - Testing (1 task)                        │
├─────────────────────────────────────────────────────────┤
│  Recent Activity                                        │
│  • Workflow "execute-features" completed 2h ago       │
│  • Agent "feature-a" started 1h ago                    │
└─────────────────────────────────────────────────────────┘
```

### Versions View (Main Work Area)
**Purpose**: Manage versions and navigate through stages

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Versions                                               │
│  [+ New Version] [Import] [Settings]                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Version 0-2 (Current)                          │  │
│  │ Status: Implementation                          │  │
│  │                                                  │  │
│  │ Stage Progress:                                 │  │
│  │ [✓] Plan    [→] Implement  [○] Test  [○] Review │  │
│  │                                                  │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐        │  │
│  │ │  Plan    │ │Implement │ │  Test    │        │  │
│  │ │  ✓       │ │  →       │ │  ○       │        │  │
│  │ │          │ │          │ │          │        │  │
│  │ │ Goals    │ │Progress  │ │Results   │        │  │
│  │ │ Ready    │ │Active    │ │Pending   │        │  │
│  │ │          │ │          │ │          │        │  │
│  │ │[View]    │ │[View]    │ │[View]    │        │  │
│  │ └──────────┘ └──────────┘ └──────────┘        │  │
│  │                                                  │  │
│  │ ┌──────────┐                                     │  │
│  │ │ Review   │                                     │  │
│  │ │  ○       │                                     │  │
│  │ │          │                                     │  │
│  │ │ Pending  │                                     │  │
│  │ │          │                                     │  │
│  │ │[View]    │                                     │  │
│  │ └──────────┘                                     │  │
│  │                                                  │  │
│  │ Workstreams (2 active)                          │  │
│  │ • Feature A - 3 tasks remaining                  │  │
│  │ • Feature B - 1 task remaining                   │  │
│  │ [+ New Workstream]                               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Version 0-1 (Completed)                        │  │
│  │ Status: Review Complete                         │  │
│  │ [View Details]                                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Stage Wizard Flow

When clicking on a stage, show a wizard that guides through stage-specific actions:

#### Plan Stage Wizard
```
┌─────────────────────────────────────────────────────────┐
│  Plan Stage - Version 0-2                              │
│  Step 1 of 3                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Define Version Goals                                   │
│                                                          │
│  [ ] Goal 1: Implement feature X                        │
│  [ ] Goal 2: Improve performance                        │
│  [ ] Goal 3: Add documentation                          │
│                                                          │
│  [+ Add Goal]                                           │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ AI Assistant                                    │  │
│  │ "Based on recent commits, I suggest adding:     │  │
│  │  - Refactor API endpoints                       │  │
│  │  - Add unit tests for new features"            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  [← Back]  [Save Draft]  [Next: Review →]              │
└─────────────────────────────────────────────────────────┘
```

#### Implement Stage Wizard
```
┌─────────────────────────────────────────────────────────┐
│  Implementation Stage - Version 0-2                     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Active Workstreams                                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Feature A                                       │  │
│  │ • Task 1: Create API endpoint [In Progress]     │  │
│  │ • Task 2: Add validation [Pending]              │  │
│  │ • Task 3: Write tests [Pending]                 │  │
│  │                                                  │  │
│  │ [View Details] [Launch Agent]                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  [+ Create New Workstream]                              │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Quick Actions                                          │
│  [Extract Next Steps] [Run Implementation Workflow]    │
│  [Consolidate Workstreams]                              │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Progress Summary                                       │
│  • 5 tasks completed                                   │
│  • 3 tasks in progress                                 │
│  • 2 tasks pending                                      │
└─────────────────────────────────────────────────────────┘
```

#### Test Stage Wizard
```
┌─────────────────────────────────────────────────────────┐
│  Testing Stage - Version 0-2                            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Test Execution                                         │
│  [Run All Tests] [Run Unit Tests] [Run Integration]    │
│                                                          │
│  Last Run: 2h ago                                       │
│  Results: 45 passed, 2 failed                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Test Coverage                                          │
│  Unit Tests: 85%                                        │
│  Integration Tests: 72%                                 │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Failed Tests                                           │
│  • test/api.test.js:45 - API validation                │
│  • test/workflow.test.js:12 - Workflow execution       │
│                                                          │
│  [View Details] [Fix Issues]                            │
└─────────────────────────────────────────────────────────┘
```

#### Review Stage Wizard
```
┌─────────────────────────────────────────────────────────┐
│  Review Stage - Version 0-2                             │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Review Status                                          │
│  [ ] Goals completed                                   │
│  [ ] All tests passing                                 │
│  [ ] Documentation updated                              │
│  [ ] Ready for next version                            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Automated Review                                       │
│  [Run Review Workflow] [Generate Summary]              │
│                                                          │
│  Last Review: 1d ago                                    │
│  Status: Needs updates                                  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Next Steps                                             │
│  • Update review document with recent changes          │
│  • Mark completed goals                                │
│  • Create next version                                  │
│                                                          │
│  [Create Next Version] [Mark Complete]                 │
└─────────────────────────────────────────────────────────┘
```

### Version Creation Wizard

```
┌─────────────────────────────────────────────────────────┐
│  Create New Version                                      │
│  Step 1 of 4                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Version Number                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Major: [0]  Minor: [3]                          │  │
│  │ Version: 0-3                                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  Type: ○ Major  ● Minor                                 │
│                                                          │
│  [← Back]  [Next: Goals →]                             │
└─────────────────────────────────────────────────────────┘
```

### Workstream Management UI

```
┌─────────────────────────────────────────────────────────┐
│  Workstream: Feature A                                  │
│  Version: 0-2                                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Tasks (3 remaining)                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [ ] Task 1: Create API endpoint                │  │
│  │     Priority: High | Est: 2h                   │  │
│  │     [Launch Agent] [Edit]                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  Progress                                               │
│  ████████░░░░░░░░░░ 40%                                │
│                                                          │
│  Agent Status                                           │
│  • Background agent running (task 1)                   │
│  • Started 1h ago                                      │
│                                                          │
│  [View Progress] [Consolidate] [Close Workstream]       │
└─────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Navigation (Week 1)
- [ ] Redesign main navigation
- [ ] Create stage-based version view
- [ ] Add stage progress indicators
- [ ] Implement stage cards/panels

### Phase 2: Stage Wizards (Week 2)
- [ ] Plan stage wizard
- [ ] Implement stage wizard
- [ ] Test stage wizard
- [ ] Review stage wizard

### Phase 3: Version Creation (Week 2)
- [ ] Version creation wizard
- [ ] Version type selection (major/minor)
- [ ] Goal definition UI
- [ ] Initial stage setup

### Phase 4: Workstream UI (Week 3)
- [ ] Workstream list view
- [ ] Workstream detail view
- [ ] Workstream creation UI
- [ ] Workstream consolidation UI

### Phase 5: Integration (Week 3)
- [ ] Connect wizards to backend APIs
- [ ] Add workflow triggers from UI
- [ ] Real-time status updates
- [ ] Error handling and validation

## Benefits

1. **Clear Guidance**: Users always know what stage they're in and what to do next
2. **Progressive Disclosure**: Information shown when needed, not all at once
3. **Workflow Alignment**: UI matches the actual version folder structure
4. **Better Onboarding**: New users can follow the wizard flow
5. **Visual Progress**: Clear indication of version lifecycle progress
6. **Parallel Work**: Workstreams are prominently displayed and manageable

## Alternative: Hybrid Approach

Keep current views but add:
- **Stage navigation** in version view
- **Quick actions** panel on dashboard
- **Wizard overlays** for complex operations (version creation, workstream setup)
- **Contextual help** showing next steps based on current stage

This provides wizard benefits without completely replacing the current UI.

## Questions to Consider

1. **Should we replace the current UI entirely or add wizard overlays?**
   - Recommendation: Hybrid approach - keep current views, add wizards for complex flows

2. **How much automation vs manual control?**
   - Recommendation: Provide both - automated workflows with manual override options

3. **Mobile responsiveness?**
   - Recommendation: Start with desktop-optimized, add mobile later

4. **Real-time updates?**
   - Recommendation: Polling initially, WebSocket later for live updates

