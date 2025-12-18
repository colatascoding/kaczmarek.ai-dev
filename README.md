## kaczmarek.ai-dev

`kaczmarek.ai-dev` is an **AI development companion** for the Mirage project (and other repositories).  
It is designed to run locally, alongside your code, and to:

- Understand your existing **review + progress** workflow (`review/versionX-Y.md` + `progress/versionX-Y.md`).
- Use **local tools** (builds, tests, HTTP APIs) instead of opaque remote pipelines.
- Help you iterate in **small, test-driven steps** with clear verification for each change.

This repository follows the concept described in `docs/concept.md`.

---

### kad CLI – generic helper for any repository

The primary, repo‑agnostic tool is the **`kad` CLI**, exposed via `bin/kad.js`.

- **Config file: `kaczmarek-ai.config.json`**
  - Created by `kad init` (see below) with sensible defaults:
    - `docs.docsDir` (e.g. `docs/`)
    - `docs.reviewDir` (e.g. `review/`)
    - `docs.progressDir` (e.g. `progress/`)
    - `ai.agentsDir`, `ai.toolsDir`, `ai.workflowsDir`, `ai.promptsDir`
    - `timeline.diagramFile` (e.g. `docs/TIMELINE.mmd`)
  - You can edit this file to match your project’s layout.

- **`kad init`**
  - Creates `kaczmarek-ai.config.json` in the current repository if it does not exist.
  - Records project name and default locations for `docs/`, `review/`, `progress/`, AI folders, and the timeline file.

- **`kad scan`**
  - Reads `kaczmarek-ai.config.json` (or uses defaults).
  - Scans the configured:
    - `docs`, `review`, and `progress` directories for markdown docs.
    - `agents`, `tools`, `workflows`, and `prompts` directories (if they exist) for markdown files.
  - Prints a JSON summary including:
    - Paths to documentation/prompt/workflow files.
    - First heading found in each file.
    - Timeline file path and whether it exists.
  - This JSON can be pasted directly into an AI prompt so the AI understands:
    - Where your **architecture/docs** live.
    - Where your **agents**, **tools**, **workflows**, and **prompts** are defined.

- **`kad ai`**
  - Produces a **ready‑to‑paste prompt** that:
    - Embeds the `kad scan` JSON.
    - Instructs an AI agent to adapt AI‑related configuration, agents, tools, workflows, and prompts to this repository.
    - Emphasises alignment with the `kaczmarek.ai-dev` concept (local‑first, Cursor‑first, review+progress pairing, small test‑driven iterations).

- **`kad progress`**
  - Detects the **current version** from `review/versionX-Y.md` files (e.g. `version0-11`).
  - Finds the matching `progress/versionX-Y.md` if it exists.
  - Emits a prompt focused on maintaining the **current review + progress pair**, keeping:
    - Review: high‑level, curated summary.
    - Progress: detailed, chronological implementation log.

- **`kad run`**
  - Similar to `kad progress`, but focused on **implementation**:
  - Asks an AI agent to:
    - Read the current review (especially “Next Steps”).
    - Propose 1–3 very small, concrete tasks (files to touch, what to change, how to verify).
    - Keep the progress log and review doc in sync with the actual work.

- **`kad changes`**
  - Uses `git log`, `git status`, and `git diff --stat` to summarise **recent changes**.
  - Emits a prompt that asks an agent to:
    - Compare recent code/doc changes with the **current review/progress docs**.
    - Identify inconsistencies or missing entries.
    - Suggest small, concrete edits to bring docs back in sync.

- **`kad timeline`**
  - Uses `kaczmarek-ai.config.json.timeline.diagramFile` (default `docs/TIMELINE.mmd`).
  - Reads existing timeline contents if present.
  - Includes git tags and a decorated git log.
  - Emits a prompt asking an agent to **create or update a Mermaid timeline diagram** that:
    - References review versions (e.g. `version0-1`, `version0-11`).
    - References important tagged commits as milestones.

Run it from any repository (after cloning `kaczmarek.ai-dev` next to it) with:

- `node ./kaczmarek.ai-dev/bin/kad.js init`
- `node ./kaczmarek.ai-dev/bin/kad.js scan`
- `node ./kaczmarek.ai-dev/bin/kad.js ai`
- `node ./kaczmarek.ai-dev/bin/kad.js progress`
- `node ./kaczmarek.ai-dev/bin/kad.js run`
- `node ./kaczmarek.ai-dev/bin/kad.js changes`
- `node ./kaczmarek.ai-dev/bin/kad.js timeline`

> Note: Once this project is published as a real npm package, you will be able to install it globally and run `kad` (and its subcommands) without the `node ./...` prefix.

---

### Mirage‑specific solution: Action Web API health & smoke tests

For your Mirage project, there is an additional **Action Web API client**:

- `tools/mirage/action_api_client.py`
  - `health` – calls `GET /api/health` on the Mirage Action Web API.
  - `list-actions` – calls `GET /api/actions` and prints a summary of registered actions.
  - `test-all` – calls `POST /api/actions/test-all` with a simple permission context and prints the JSON report.

See `tools/mirage/action_api_client.py` and `config/mirage-paths.yaml` for details.
