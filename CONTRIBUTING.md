# Contributing — Elimu, Mwalimu wa Grade 10

## Before you touch anything: the two rules that can't bend

This project exists to satisfy a fixed brief, and two of its rules are the actual grading criteria — not style preferences:

1. **"One answer, not the answer."** The app has exactly one input form and exactly one action: pick a strand + lesson length, click **Generate my lesson pack**, get one assembled plan. Do not add a second button, a free-text box, a chat interface, or a menu of separate answers to choose from. If your change would give the teacher more than one thing to click before she has her plan, it's the wrong shape — stop and raise it instead of building it.
2. **"Sijui" beats a guess.** There is no language model anywhere in this codebase, on purpose (see `docs/technical-design.md`, "What changed"). Every field in a generated pack must trace directly back to a field in a corpus JSON file. If you're tempted to add generation, summarization, or any step that produces text not already present in a corpus file — don't. Extend the corpus instead.

If a change you're making would violate either rule, it's a design conversation, not a PR. Raise it before writing code.

## Project layout

```
corpus/{grade}/{subject}/{strand-file}.json   <- curriculum content (JSON, no code)
server/corpus.js       <- loads corpus, derives dropdown options
server/packBuilder.js  <- assembles one pack from a corpus chunk + lesson length
server/index.js         <- HTTP server (Node built-ins only, no deps)
public/                <- frontend: plain HTML/CSS/JS, no build step
docs/                   <- required deliverable sheets + project writeups
```

## Branches

- `main` — the working app. `server/` is frozen: it's the tested sijui gate and the one thing that costs the most to break. Don't push directly to `server/` on `main` without discussing it first.
- `corpus-content` — add or extend curriculum sub-strands. Pure JSON, no code changes needed.
- `ui-polish` — visual/UX polish, Kiswahili labels, print-stylesheet tweaks. Touches `public/` only.
- `docs-review` — tighten the two required sheets (`docs/who-this-helps.md`, `docs/ai-bill-2026-risk-sheet.md`) and the two writeups (`docs/project-overview.md`, `docs/technical-design.md`).

Pull the latest `main` into your branch before starting work each session (`git checkout <branch> && git merge main`) — `server/` changes on `main` should propagate to you, not the other way around.

## Adding corpus content (the `corpus-content` branch)

Each strand is one JSON file under `corpus/{grade}/{subject}/`. A sub-strand entry needs:

```json
{
  "id": "unique-id",
  "subStrand": "Sub-strand name",
  "citation": "Grade X <Subject> Curriculum Design — Strand: ... — Sub-strand: ... (illustrative; verify against official KICD PDF)",
  "verified": "illustrative",
  "learningOutcomes": ["...", "...", "..."],
  "boardNotes": ["...", "...", "..."],
  "activity": { "description": "one activity, no choice offered", "materialsNeeded": "None — ..." },
  "assessmentQuestions": [
    { "question": "...", "markingScheme": "..." }
  ],
  "explainer": "plain-language explanation for a teacher unfamiliar with the topic"
}
```

Rules for this content:
- **Exactly one `activity`**, and it must be genuinely achievable with no special materials (paper/board/exercise books only) — the brief requires a *no-materials* activity, not "an activity."
- **Exactly five `assessmentQuestions`**, each with its own `markingScheme` (how many marks, for what). Not a competency rubric — actual questions a teacher could ask that lesson, with how to mark them.
- If any of this content is not verified against the real KICD curriculum design PDF, mark `"verified": "illustrative"` and say so honestly in the file-level `sourceNote` — see the existing two corpus files for the expected tone and level of detail. Never present illustrative content as verbatim official text.
- Add the new file, restart the server, and confirm it shows up in the dropdowns via `/api/options` — no other code change should be needed. If you find yourself editing `server/*.js` to make new content work, the schema is probably missing something; raise it instead of hacking around it.

## Running and testing your change

No install step:

```
node server/index.js
```

Open `http://127.0.0.1:4173`. There's no automated test suite — verify by hand:

1. Pick every `{grade, subject, strand, subStrand}` combination that should exist and confirm a pack generates with all sections populated (timeline, what to teach, board notes, activity, 5 questions, explainer).
2. Confirm the "illustrative content" badge and citation appear on every pack.
3. Try **Print / save this pack** and confirm the printed/saved view hides the picker and disclosure banner, leaving only the pack.
4. If you changed `server/`, also confirm the sijui path still works: POST `/api/pack` with a subject/strand that doesn't exist and check you get back `{ "sijui": true, ... }`, not a fabricated pack or a crash.

## Docs branch specifics

`docs/who-this-helps.md` and `docs/ai-bill-2026-risk-sheet.md` are the two artifacts the hackathon rules require to be pinned up — they need to survive a cold read by someone who wasn't in the room when they were written. If you're on `docs-review`, the useful contribution is reading them fresh and flagging anything that doesn't land, not necessarily rewriting them wholesale.

## Commit and PR

Small, focused commits on your branch; open a PR into `main` when ready rather than merging directly, so someone else can sanity-check `server/`-adjacent changes before they land.
