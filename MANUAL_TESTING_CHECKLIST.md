# Manual Testing Checklist - Quick Reference

**Use this for quick testing. See `MANUAL_TESTING_SUITE.md` for detailed instructions.**

## Stage 1: Core CLI Basics ⚙️
- [ ] `kad --help` works
- [ ] `kad init` or database initializes
- [ ] `.kaczmarek-ai/` directory exists

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 2: Basic Workflow System 📋
- [ ] `kad workflow list` shows workflows
- [ ] `kad workflow show <name>` displays workflow
- [ ] `kad workflow validate <name>` works
- [ ] `kad workflow run <name>` starts execution

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 3: Agent System Basics 🤖
- [ ] `.kaczmarek-ai/agent-queue/` exists
- [ ] `kad agent list` works
- [ ] `kad agent status` works
- [ ] `kad agent start` works

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 4: API Server 🌐
- [ ] `npm run api` starts server
- [ ] `http://localhost:3100/health` responds
- [ ] Server can be stopped cleanly

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 5: Frontend UI Basics 🖥️
- [ ] `http://localhost:3100` loads
- [ ] Navigation bar visible
- [ ] Dashboard view loads
- [ ] View switching works

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 6: Workflow + Agent Integration 🔄
- [ ] Workflow creates agent task
- [ ] Agent appears in queue
- [ ] Agent gets processed
- [ ] Executions visible in UI

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 7: Version Management 📦
- [ ] Versions listed (CLI + UI)
- [ ] Version details display
- [ ] Progress files work
- [ ] Review files work

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 8: Advanced Workflow Features 🚀
- [ ] Multi-step workflow executes
- [ ] Conditional logic works
- [ ] Error handling works
- [ ] Workflow resume works

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 9: Agent Execution Features ⚡
- [ ] Simple tasks execute
- [ ] `kad agent debug` works
- [ ] Agent completion updates state
- [ ] Agent failures handled

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Stage 10: Full System Integration 🎯
- [ ] End-to-end workflow works
- [ ] UI updates during execution
- [ ] Concurrent workflows work
- [ ] System recovery works

**Status**: ⬜ | 🟡 | ✅ | ❌

---

## Overall Progress
**Current Stage**: _____  
**Stages Passed**: ___ / 10  
**Date**: _____

