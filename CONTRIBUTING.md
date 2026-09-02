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
public/index.html      <- markup + inline SVG icon sprite (icons can't be served as .svg; see below)
public/style.css       <- design tokens, components, responsive layers, print stylesheet
public/js/*.js         <- ES modules: api / builder (cascade) / pack-view (render) / app (wiring)
docs/                   <- required deliverable sheets + project writeups
```

## Branches

- `main` — the working app. `server/` is frozen: it's the tested sijui gate and the one thing that costs the most to break. Don't push directly to `server/` on `main` without discussing it first.
- `corpus-content` — add or extend curriculum sub-strands. Pure JSON, no code changes needed.
- `ui-polish` — visual/UX polish, Kiswahili labels, print-stylesheet tweaks. Touches `public/` only.
- `docs-review` — tighten the two required sheets (`docs/who-this-helps.md`, `docs/ai-bill-2026-risk-sheet.md`) and the two writeups (`docs/project-overview.md`, `docs/technical-design.md`).
- `ai-integration` — exploratory local-model work (see below). Not part of the core app; the app must work correctly with this branch never merged.

### Who owns what

| Branch | Owner |
|---|---|
| `corpus-content` | Ronald-Wesh |
| `ui-polish` | Evarline |
| `docs-review` | NgushSavio |
| `ai-integration` | Mike-205 |

Tracked as GitHub issues assigned to each owner — see the repo's Issues tab.

Pull the latest `main` into your branch before starting work each session (`git checkout <branch> && git merge main`) — `server/` changes on `main` should propagate to you, not the other way around.

## The `ai-integration` branch specifically

This is the one place in the repo allowed to experiment with a local LLM (e.g. via Ollama) — everywhere else, "no generative step in the request path" is a hard rule (see the two rules at the top of this file). Ground rules for this branch specifically:

- It must stay **additive and optional**. `main`'s pack-generation flow (`/api/pack`) must keep working, unchanged, with zero setup and no model installed — that's the guaranteed offline demo path, and it doesn't get weaker because this branch exists.
- Whatever it produces must be clearly labelled as AI-generated and distinct from the grounded, corpus-sourced pack content — don't blur the two together in the UI, since the whole compliance argument in `docs/ai-bill-2026-risk-sheet.md` rests on being able to say precisely what is template-filled from a cited source versus what a model produced.
- If it can't say "sijui" / refuse cleanly when it's unsure, it isn't ready to be offered to a teacher — refuse-over-guess applies here too, it just has to be enforced in a prompt/response-checking layer instead of by construction.
- Local setup (no root needed):

```
mkdir -p ~/.local/ollama
curl -fsSL -o /tmp/ollama.tar.zst \
  "https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst"
tar --zstd -xf /tmp/ollama.tar.zst -C ~/.local/ollama

export OLLAMA_MODELS=~/.local/ollama/models
~/.local/ollama/bin/ollama serve &

export PATH="$HOME/.local/ollama/bin:$PATH"
ollama pull llama3.2:3b   # ~2GB, one-time, needs internet; runs fully offline after
```

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
3. Try **Print / save this pack** and confirm the printed/saved view hides the picker and disclosure banner, leaving only the pack — and that the source note prints expanded rather than collapsed.
4. If you changed `server/`, also confirm the sijui path still works: POST `/api/pack` with a subject/strand that doesn't exist and check you get back `{ "sijui": true, ... }`, not a fabricated pack or a crash.
5. If you changed `public/`, also check the states that aren't on the happy path: stop the server and click **Generate** (should show a retryable error, never a silent no-op or a half-built pack); reload with the server down (selects disabled with an explanation); change a dropdown after generating (the pack on screen is marked as belonging to the previous selection). And tab through the page — skip link, disclosure toggle, five selects, then the button, each with a visible focus ring.

### If you're working on `public/` (the `ui-polish` branch)

Three constraints are easy to trip over, and all three come from promises made elsewhere in the project:

- **No dependencies and no build step.** The README's pitch is "no install step, no npm dependencies." A framework, a UI library, an icon package or a CSS toolchain would all break that claim.
- **No web fonts.** The app makes no network calls, ever. Display type comes from a system serif stack; anything fetched from a CDN would silently fail offline, which is the only way this app is ever used.
- **No new file types in `public/`.** The `MIME` map in `server/index.js` covers `.html/.js/.css/.json` only, and `server/` is frozen. An `.svg`, `.woff2` or `.png` file would be served as `application/octet-stream` and refused by the browser. Icons and illustrations go in the inline `<symbol>` sprite in `index.html` instead.

Also: keep the `<select>` elements native. They are restyled with `appearance: none` and a custom chevron, but the element itself is the real thing — a hand-built dropdown would cost the keyboard support and the correct mobile picker that we currently get for free.

## Docs branch specifics

`docs/who-this-helps.md` and `docs/ai-bill-2026-risk-sheet.md` are the two artifacts the hackathon rules require to be pinned up — they need to survive a cold read by someone who wasn't in the room when they were written. If you're on `docs-review`, the useful contribution is reading them fresh and flagging anything that doesn't land, not necessarily rewriting them wholesale.

## Commit and PR

Small, focused commits on your branch; open a PR into `main` when ready rather than merging directly, so someone else can sanity-check `server/`-adjacent changes before they land.
