## kaczmarek.ai-dev

`kaczmarek.ai-dev` is an **AI development companion** for the Mirage project.  
It is designed to run locally, alongside Mirage, and to:

- Understand your existing **review + progress** workflow (`review/versionX-Y.md` + `progress/versionX-Y.md`).
- Use **local tools** (CMake, tests, Action Web API) instead of opaque remote pipelines.
- Help you iterate in **small, test-driven steps** with clear verification for each change.

This repository follows the concept described in `docs/concept.md`.

---

### First implemented solution: Action Web API health & smoke tests

The first concrete feature is a small **Action Web API client** for Mirage:

- `tools/mirage/action_api_client.py`
  - `health` – calls `GET /api/health` on the Mirage Action Web API.
  - `list-actions` – calls `GET /api/actions` and prints a summary of registered actions.
  - `test-all` – calls `POST /api/actions/test-all` with a simple permission context and prints the JSON report.

See `tools/mirage/action_api_client.py` and `config/mirage-paths.yaml` for usage details.


