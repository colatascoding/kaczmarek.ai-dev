## Workflow: Version Review & Progress Update with kaczmarek.ai-dev

This is a lightweight, repeatable workflow for maintaining:

- `review/versionX-Y.md` – curated summary and plan.
- `progress/versionX-Y.md` – granular implementation log.

It is designed to be run with help from `kaczmarek.ai-dev` and Cursor.

---

### 1. Pick the active version

- Decide which version you are working on (e.g. `version0-11`).
- Ensure the following files exist in the Mirage repo:
  - `review/version0-11.md`
  - `progress/version0-11.md`

If they do not exist, create them based on the latest previous version and your current goals.

---

### 2. Gather context

- Open in Cursor:
  - `review/version0-11.md`
  - `progress/version0-11.md`
  - Any relevant design docs in `docs/`.
- Ask `kaczmarek.ai-dev` (via Cursor) to:
  - Summarise the current state of the version.
  - Extract a short checklist of remaining work items.

Keep the **review** file focused on high‑signal information; use the **progress** file for detailed notes.

---

### 3. Implement changes and log progress

- As you make code and documentation changes in Mirage:
  - Append short, dated entries to `progress/version0-11.md` (what changed, why, and how to verify).
  - When a change is significant, update the relevant section in `review/version0-11.md` (summary, risks, next steps).
- Use `kaczmarek.ai-dev` to:
  - Propose wording for review sections based on the progress log.
  - Suggest small refactors or tests tied to the actions you just took.

---

### 4. Verify via local tools

- For each meaningful change, ensure there is a clear verification step:
  - C++ tests (e.g. `mirage_tests` / `ctest`).
  - Focused action tests via the Mirage Action Web API and `tools/mirage/action_api_client.py`.
  - Server tests where applicable.
- You should **run these tests yourself** locally to confirm everything passes.

When tests fail, capture key findings and fixes in the progress file, and only summarise the outcome in the review.

---

### 5. Close or archive the version

- When you consider a version “done”:
  - Make sure `review/version0-11.md` accurately reflects the final state and decisions.
  - Mark `progress/version0-11.md` as closed (e.g. with a short closing note).
- Periodically:
  - Use `kaczmarek.ai-dev` to help **squash** older reviews/progress into archive summaries, as described in `review/version0-11.md`.
  - Keep only a small number of recent versions “live” to reduce noise for future AI runs.


