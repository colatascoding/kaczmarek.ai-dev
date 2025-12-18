## kaczmarek.ai-dev – Development Concept

- **Version**: 0.1.1  
- **Status**: Working draft  
- **Last updated**: 2025-12-18  
- **Intended usage**: Checked into the `kaczmarek.ai-dev` Git repository and evolved alongside Mirage, with version bumps when the concept changes.

### 1. Purpose & Scope

- **Goal**: `kaczmarek.ai-dev` is an **AI development companion** for Mirage that:
  - Understands the existing **review/progress workflow** (`review/versionX-Y.md` + `progress/versionX-Y.md`).
  - Operates in a **Cursor‑first, local‑first** way (prefers local tools, tests, and docs over remote magic).
  - Automates repetitive analysis, review, and refactor tasks while keeping humans in control of decisions.

- **Scope**:
  - Help design and maintain architecture (e.g. action/permission system, room migration).
  - Generate and maintain tests, docs, and small refactors.
  - Orchestrate and interpret runs of local tools (C++ tests, Action Web API checks, linters, etc.).

---

### 2. Core Principles

- **Local‑first & reproducible**:
  - Prefer **local CMake builds, tests, and the Action Web API** over remote services.
  - Any `kaczmarek.ai-dev`‑driven action should be **easy to reproduce** as a plain shell/HTTP call.

- **Cursor‑first workflows**:
  - Use Cursor tasks and configuration to run:
    - Builds/tests (`cmake`, `ctest`, focused `mirage_tests` filters).
    - Tooling (`launch.sh --action-api`, ActionTester CLI, format/lint targets).
  - `kaczmarek.ai-dev` “playbooks” should assume they run from within Cursor with these tasks available.

- **Review + progress pairing**:
  - Treat `review/versionX-Y.md` as the **source of truth** for “what this version means”.
  - Treat `progress/versionX-Y.md` as the **high‑granularity log** for decisions and implementation steps.
  - `kaczmarek.ai-dev` should:
    - Prefer the review docs for context.
    - Only dive into progress logs when needed for fine‑grained reasoning or history.

- **Safety & permissions aware**:
  - Leverage the **Action & Permission System**:
    - Use `ActionWebBridge` to query what actions are allowed in a given context.
    - Avoid suggesting operations that would violate permissions/locks.
  - All destructive actions (schema changes, gameplay semantics, build/CI rewrites) should go through:
    - An explicit plan.
    - A human review step (PR + code review).

- **Small, test‑driven iterations**:
  - Default to **narrow, composable changes** with:
    - A clear test or verification step (C++ tests, Jest server tests, action tests, screenshots if relevant).
  - `kaczmarek.ai-dev` proposals should always include **how to verify** (tests, commands, or manual steps).

---

### 3. High‑Level Architecture (Conceptual)

- **AI Orchestrator (`kaczmarek.ai-dev`)**:
  - Runs as an AI agent inside Cursor that:
    - Reads the relevant docs (`docs/`, `review/`, `progress/`).
    - Proposes edits in the Mirage repo.
    - Calls local tools via configured tasks (build, tests, Action API checks).

- **Tooling Layer**:
  - **Mirage integration tools**:
    - HTTP client wrappers for `ActionWebBridge` (list actions, test actions, run `/api/health`, etc.).
    - Scripted runners for:
      - C++ tests (`./build/mirage_tests --gtest_filter=...`).
      - `ctest` suites.
      - Server tests (`npm test` in `server/`) – without hiding them behind opaque scripts.
  - **Dev utilities**:
    - Format/lint runners.
    - Screenshot diff helpers for visual regressions, if needed.

- **Knowledge Layer**:
  - Structured documents `kaczmarek.ai-dev` should **prefer** as context:
    - `review/versionX-Y.md` – curated version reviews.
    - `progress/versionX-Y.md` – for the active version or when deep history is required.
    - `docs/architecture/*`, `docs/REFERENCE/*`, and key design docs (e.g. action/permission, room system).
  - Older reviews/progress logs are **squashed/archived** as described in `review/version0-11.md` to keep context high‑signal.

---

### 4. Proposed Initial Repository Layout

Below is a suggested layout for the **`kaczmarek.ai-dev` repository** ([GitHub repo](https://github.com/colatascoding/kaczmarek.ai-dev.git)):

```text
kaczmarek.ai-dev/
  README.md

  docs/
    concept.md              # This document (vision, principles)
    workflows.md            # Describes standard kaczmarek.ai-dev workflows (review update, refactor, test runs)
    prompts.md              # Guidelines for writing/maintaining prompts and tasks

  config/
    cursor.json             # Cursor tasks for builds/tests/tools used by kaczmarek.ai-dev
    mirage-paths.yaml       # Paths into the Mirage repo (actions API, build dir, tests, docs)

  agents/
    reviewer/               # Agent configs for code/doc reviews
      config.yaml
      examples.md
    refactorer/             # Agent configs for targeted refactors
      config.yaml
    tester/                 # Agent configs focused on test creation/maintenance
      config.yaml

  tools/
    mirage/
      action_api_client.py  # Thin client to talk to ActionWebBridge (list/test actions, health checks)
      run_tests.sh          # Wrapper for C++ tests / ctest (no interactivity)
      run_server_tests.sh   # Wrapper for server Jest tests

  workflows/
    version_review.md       # Step‑by‑step kaczmarek.ai-dev workflow to update review/versionX-Y + progress/versionX-Y
    feature_refactor.md     # Template for safe refactor with tests and docs
    ci_update.md            # Steps for changing CI / build pipelines safely

  prompts/
    system/
      architect.md          # System prompt for architecture/large‑scale design work
      reviewer.md           # System prompt for PR and doc reviews
    tasks/
      add-tests.md          # Task prompt for adding tests around a feature
      integrate-actions.md  # Task prompt for wiring features into ActionRegistry/permissions
```

This layout keeps:
- **Concept & docs** separate from:
- **Agent configs** (how the AI behaves) and:
- **Tools/workflows** that actually interact with Mirage.

---

### 5. Short Action List (First Iteration)

- **1. Clarify ownership & location**
  - Use the GitHub repository [`colatascoding/kaczmarek.ai-dev`](https://github.com/colatascoding/kaczmarek.ai-dev.git) as the **canonical home** for this concept.
  - Keep Mirage as a separate checkout (sibling directory) so `kaczmarek.ai-dev` can reference it via relative paths or configuration.

- **2. Bootstrap the repo layout**
  - In the `kaczmarek.ai-dev` repo, create the directories from Section 4 (at minimum: `docs/`, `config/`, `agents/`, `tools/mirage/`, `workflows/`, `prompts/`).
  - Store this `concept.md` as `docs/concept.md` in that repository as the canonical `kaczmarek.ai-dev` vision.

- **3. Define initial Cursor tasks**
  - In `config/cursor.json`, configure tasks for:
    - Building + running C++ tests.
    - Running focused action tests.
    - Starting the Action Web API (`launch.sh --action-api`).
  - These tasks will be what `kaczmarek.ai-dev` (and you) call instead of ad‑hoc commands.

- **4. Create the first agent profiles**
  - Add minimal `agents/reviewer/config.yaml` and `agents/refactorer/config.yaml` that:
    - Point at the Mirage repo path config.
    - Declare which tools/tasks they can call.
    - Reference this concept document in their “principles” section.

- **5. Document one concrete workflow**
  - In `workflows/version_review.md`, write a short, concrete recipe for:
    - Updating `review/versionX-Y.md` and `progress/versionX-Y.md` with `kaczmarek.ai-dev`’s help.
    - Summarising progress and deciding when to archive older docs.

---

### 6. Notes

- This concept is intentionally **lightweight and adaptable** – you can start with just `docs/`, `config/`, and one `agents/` folder and grow from there.
- As soon as you wire `kaczmarek.ai-dev` into real Mirage workflows, remember to **run your own builds and tests locally** to validate outcomes, even when the AI proposes or automates the changes.

---

### 7. Versioning & Repository Usage

- **Version field**:
  - Keep the `Version`/`Status`/`Last updated` block at the top of this file as the **single source of truth** for the concept’s version.
  - Suggested scheme:
    - Bump **patch** (`0.1.1` → `0.1.2`) for small clarifications/typo fixes.
    - Bump **minor** (`0.1.1` → `0.2.0`) for structural changes (new sections, new workflows, updated principles).
    - Bump **major** (`0.1.1` → `1.0.0`) when the overall philosophy or scope of `kaczmarek.ai-dev` changes in a significant way.

- **Repository loading**:
  - Store this file as `docs/concept.md` in your `kaczmarek.ai-dev` repository (or a similar location) and commit it under version control.
  - When you update the concept:
    - Edit the document.
    - Bump the `Version` and `Last updated` fields.
    - Optionally create a Git tag (e.g. `concept-v0.1.1`) so you can easily refer back to specific concept versions.

- **Optional changelog**:
  - If the concept starts changing frequently, add a simple `docs/concept-changelog.md` with dated entries:
    - `YYYY-MM-DD – v0.2.0: Added section on CI workflows; clarified Action Web API usage.`
  - The changelog plus Git history makes it easy for both humans and AI tools to understand how `kaczmarek.ai-dev`’s role has evolved over time.


