## kaczmarek.ai-dev

`kaczmarek.ai-dev` is an **AI development companion** for the Mirage project.  
It is designed to run locally, alongside Mirage, and to:

- Understand your existing **review + progress** workflow (`review/versionX-Y.md` + `progress/versionX-Y.md`).
- Use **local tools** (CMake, tests, Action Web API) instead of opaque remote pipelines.
- Help you iterate in **small, test-driven steps** with clear verification for each change.

This repository follows the concept described in `docs/concept.md`.

---

### First generic solution: kad CLI (for any repository)

The primary, repo‑agnostic tool is the **`kad` CLI**, exposed via `bin/kad.js`:

- **`kad init`**
  - Creates a `kaczmarek-ai.config.json` file in the current repository.
  - Records basic information such as project name and default locations for:
    - `docs/`
    - `review/`
    - `progress/`

- **`kad scan`**
  - Reads `kaczmarek-ai.config.json` (or uses defaults if it does not exist).
  - Scans the configured:
    - `docs`, `review`, and `progress` directories for markdown docs.
    - `agents`, `tools`, `workflows`, and `prompts` directories (if they exist) for markdown files.
  - Prints a JSON summary including:
    - Paths to documentation/prompt/workflow files.
    - First heading found in each file.
  - This JSON can be pasted directly into an AI prompt so the AI understands:
    - Where your **architecture/docs** live.
    - Where your **agents**, **tools**, **workflows**, and **prompts** are defined.

Run it from any repository (after cloning `kaczmarek.ai-dev` next to it) with:

- `node ./kaczmarek.ai-dev/bin/kad.js init`
- `node ./kaczmarek.ai-dev/bin/kad.js scan`

> Note: Once this project is published as a real npm package, you will be able to install it globally and run `kad` without the `node ./...` prefix.

---

### Mirage‑specific solution: Action Web API health & smoke tests

For your Mirage project, there is an additional **Action Web API client**:

- `tools/mirage/action_api_client.py`
  - `health` – calls `GET /api/health` on the Mirage Action Web API.
  - `list-actions` – calls `GET /api/actions` and prints a summary of registered actions.
  - `test-all` – calls `POST /api/actions/test-all` with a simple permission context and prints the JSON report.

See `tools/mirage/action_api_client.py` and `config/mirage-paths.yaml` for details.



