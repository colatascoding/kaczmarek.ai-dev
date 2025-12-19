# Cloud Agent Orchestration Flow

## High-Level Architecture

```
┌─────────────────┐
│   User Request  │
│  (CLI/Command)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Opt-in Check   │
│  (Global/Mode)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Yes       No
    │         │
    │         └─────────► Use Local Agent
    │
    ▼
┌─────────────────┐
│ Mode Selection  │
│ & Validation    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Queue Manager  │
│  (FIFO/Priority)│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Capacity  No Capacity
 Available
    │         │
    │         └────► Add to Queue
    │
    ▼
┌─────────────────┐
│  Agent Launcher │
│  (Cloud API)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  State Manager  │
│  (Track Status) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Monitor       │
│  (Progress)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Complete  Failed
    │         │
    │         └────► Retry/Notify
    │
    ▼
┌─────────────────┐
│  Result Handler │
│  (PR/Cleanup)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Notification   │
│  (User Alert)   │
└─────────────────┘
```

## Queue System

```
┌─────────────────────────────────────┐
│         Queue Manager               │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────┐                  │
│  │ Immediate    │  Priority: 10     │
│  │ Queue        │  Max: 1 concurrent│
│  │ [Task 1]     │                  │
│  │ [Task 2]     │                  │
│  └──────────────┘                  │
│                                     │
│  ┌──────────────┐                  │
│  │ Background   │  Priority: 5     │
│  │ Queue        │  Max: 1 concurrent│
│  │ [Task A]     │                  │
│  └──────────────┘                  │
│                                     │
│  ┌──────────────┐                  │
│  │ Scheduled    │  Priority: 3     │
│  │ Queue        │  Auto-triggered  │
│  │ [Daily]      │                  │
│  │ [Weekly]     │                  │
│  └──────────────┘                  │
│                                     │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Scheduler      │
│  (Select Next)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent Pool     │
│  (Max: 1)       │
└─────────────────┘
```

## Agent Lifecycle States

```
┌─────────┐
│ QUEUED  │
└────┬────┘
     │
     ▼
┌─────────┐
│STARTING │
└────┬────┘
     │
     ▼
┌─────────┐      ┌─────────┐
│RUNNING  │◄────►│ PAUSED  │
└────┬────┘      └─────────┘
     │
     ├─────────┐
     │         │
     ▼         ▼
┌─────────┐ ┌─────────┐
│COMPLETED│ │ FAILED  │
└─────────┘ └────┬────┘
                  │
                  ▼
            ┌─────────┐
            │ RETRY   │
            └─────────┘
```

## Scheduling Flow (Scheduled Mode)

```
┌─────────────────┐
│  Cron Scheduler │
│  (Evaluates)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Schedule  │
│ (0 9 * * *)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Match    No Match
    │         │
    │         └────► Wait
    │
    ▼
┌─────────────────┐
│ Create Task     │
│ (Scheduled)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Add to Queue    │
│ (Scheduled)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Queue   │
│ (Normal Flow)   │
└─────────────────┘
```

## Example: Multiple Agents

```
Time: 09:00
├─ Scheduled Agent (Daily Progress) → QUEUED
└─ Scheduler → STARTING → RUNNING

Time: 09:15
├─ User: kad cloud-agent --mode interactive "Fix bug"
├─ Interactive Agent → QUEUED (waiting for scheduled to complete)
└─ Scheduled Agent → RUNNING

Time: 09:20
├─ Scheduled Agent → COMPLETED
├─ Queue Manager → Select next (Interactive)
└─ Interactive Agent → STARTING → RUNNING

Time: 09:45
├─ Interactive Agent → COMPLETED
└─ Creates PR, notifies user
```

