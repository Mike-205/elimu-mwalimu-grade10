# Elimu, Mwalimu wa Grade 10 — Technical Design

This describes the system as actually built (not as merely planned) — see `server/`, `public/`, and `corpus/` in this repo. Everything below is verifiable against that code.

## Design constraints, and why they shaped the architecture

| Constraint (from the official track brief) | Architectural consequence |
|---|---|
| The teacher is the user; no child logs in | No login, no learner-facing surface of any kind. |
| No learner's name or work enters the system | No persistence layer, no database. State lives in memory per-request only; nothing survives a restart. |
| Works offline in the classroom; **the output is a pack she can carry** | The primary deliverable of a request is a printable, self-contained document (`window.print()` on a dedicated print stylesheet), not a screen she has to keep the laptop open on. |
| **"One answer, not the answer": a usable plan beats a menu of options** | Exactly one input form, exactly one action ("Generate my lesson pack"), exactly one assembled output. No free-text box, no chat, no menu of separate questions to click through and assemble yourself. |
| Judge test: would a real teacher use this for tomorrow's lesson, offline? | The output has to be a complete, ready-to-use 40/80-minute plan on the first click — not raw material she still has to compose. |

**Note on process:** the first build of this project got the offline/no-learner-data/sijui constraints right but got the *output shape* wrong — it shipped a five-button Q&A menu plus a free-text box, which is precisely the "menu of options" the brief says not to build. This document describes the corrected, second version. The corpus, and the principle of refusing rather than fabricating, carried over unchanged; the generation/retrieval layer and the entire UI did not.

## Component overview

```
corpus/{grade}/{subject}/{strand-file}.json   <- source of truth, config-driven
server/corpus.js       -> loads and flattens corpus into chunks + derives {grade,subject,strand} option tree
server/packBuilder.js  -> assembles ONE lesson pack (timeline + all fields) from a chunk + lesson length
server/index.js         -> HTTP server: static file serving + /api/options, /api/pack
public/index.html + style.css -> teacher-facing UI: grade/subject/strand/sub-strand/length picker,
                              a single "Generate my lesson pack" button, print-styled output
public/js/api.js       -> the only module that knows the /api/options and /api/pack shapes
public/js/builder.js   -> cascade rules over the option tree (no DOM, no fetching)
public/js/pack-view.js -> renders the pack, the sijui refusal, and loading/error states
public/js/app.js       -> wiring: keeps the five selects in sync, runs the one action
```

There is no retrieval engine and no language model anywhere in this version. Both were removed deliberately (see "What changed" below) once the output became a fixed template filled directly from corpus fields — a lookup problem, not a generation problem.

### Corpus layer (`corpus/`)

Each JSON file represents one strand within one `{grade, subject}` pair and contains one or more sub-strands. Every sub-strand entry carries:

- `learningOutcomes`, `boardNotes` — feed the "what to teach" and "board notes" sections directly.
- `activity: { description, materialsNeeded }` — exactly one activity per sub-strand, explicitly tagged with what materials (if any) it needs, because the brief specifies *one* no-materials activity, not a choice of activities.
- `assessmentQuestions` — exactly five `{ question, markingScheme }` pairs per sub-strand, because the brief specifies five marked questions, not a competency rubric.
- `explainer` — the "if you're not confident on this topic yourself" section.
- `citation` — a human-readable pointer back to where this should live in the official curriculum design.
- `verified` — `"illustrative"` (gap-filled content, style-matched to a real curriculum design but not verbatim) vs. a future `"official"` state once real extracted text replaces it.
- A document-level `sourceNote` explaining exactly what was and wasn't obtainable, and why.

Adding a new grade, subject, or strand is "drop a new JSON file in the right folder," not a code change. `server/corpus.js` derives the full `{grade → subject → strand → subStrand}` option tree by walking the directory at startup — the UI's dropdowns are generated from whatever's actually on disk.

### Pack assembly (`server/packBuilder.js`) — deterministic, not generative

`buildPack(chunk, lengthMinutes)` does two things:

1. **Builds a timeline** by splitting the requested lesson length across four fixed phases — introduction/hook (10%), direct instruction (40%), activity (35%), check for understanding (15%) — rounding each and pushing any rounding remainder into the last phase so the total always equals the requested length exactly.
2. **Copies every other field straight from the chunk** — `learningOutcomes`, `boardNotes`, `activity`, `assessmentQuestions`, `explainer` — into the pack's corresponding sections, untouched.

There is no model call, no scoring, no interpretation step. Every value in the output traces directly to a value in the corpus file that produced it. This is why the "never invents an answer" guarantee is structural here, not prompt-engineered: there is no code path capable of producing a sentence that didn't already exist in a corpus JSON file.

### The sijui gate (`server/index.js` → `/api/pack`)

The endpoint does an exact `{grade, subject, strand, subStrand}` match against the loaded corpus (`corpus.findChunk`). If nothing matches, it returns `{ sijui: true, message: ... }` and calls `buildPack` for nothing. Because the UI's dropdowns are themselves populated from `/api/options` — which only lists combinations that actually exist in the loaded corpus — a teacher clicking through the UI normally can never trigger this path; it exists to protect against direct API calls with an invalid combination, and it was verified directly by calling `/api/pack` with a non-existent subject.

### Frontend (`public/`)

Plain HTML/CSS/vanilla JS, no build step, no framework, no dependencies — split into ES modules served directly by the static handler. On load, it fetches `/api/options` and populates cascading `grade → subject → strand → subStrand` selects, plus a lesson-length select (`40`/`80` minutes) from `validLengths`. One button, `Generate my lesson pack`, posts the current selection to `/api/pack` and renders the full pack in one pass. A dedicated print stylesheet (`@media print` in `public/style.css`) hides the picker/button/disclosure and leaves only the pack itself, so "Print / save this pack" produces the carryable artifact the brief asks for.

Two constraints shape the presentation layer. There are **no web fonts** — the app makes no network calls, so display type comes from a system serif stack. And the `MIME` map in `server/index.js` covers only `.html/.js/.css/.json`, so every icon and illustration is **inline SVG** (a hidden `<symbol>` sprite in `index.html`) rather than a served `.svg` file; no `server/` change was needed to add artwork. The `<select>` elements are deliberately native, restyled with `appearance: none` and a custom chevron — a bespoke dropdown would cost the keyboard support and the correct mobile picker that native controls give for free.

There is no account UI, because there is no account: no login, no session, no user model (see the constraints table above). The header carries the logo and nothing else.

## What changed from the first build, and why

| First build | This build | Reason |
|---|---|---|
| Five question-buttons + free-text box | One form, one button, one output | Brief explicitly rules out "a menu of options." |
| `server/retrieval.js` — keyword-overlap scoring against arbitrary free text | Removed | No free text exists anymore to score; exact dropdown match replaces it entirely. |
| `server/ollama.js` — optional local-LLM generation, grounded prompt | Removed | The output is now template-filled from structured fields, not generated prose; there is nothing for a model to add. |
| Competency rubric (`BE/AE/ME/EE` descriptors) | Five `{question, markingScheme}` pairs | Brief specifies "five questions... with a marking scheme," not a competency-level rubric. |
| `suggestedActivity` (free text, choice implied) | `activity` (singular, tagged `materialsNeeded`) | Brief specifies *one* no-materials activity. |
| On-screen only | Print stylesheet + explicit "Print / save this pack" action | Brief: "the output is a pack she can carry." |

## Compliance alignment (see `docs/ai-bill-2026-risk-sheet.md` for the full reasoning)

Removing the generation layer strengthens, not just preserves, the compliance argument: there is no longer a language model in the request path at all, so "refuse rather than guess" is no longer a matter of prompt discipline — it's a matter of there being no code path that could produce ungrounded text in the first place.

## Known limitations and next steps

- **Corpus content is illustrative, not verbatim official text**, for the reasons stated in `docs/project-overview.md` and each corpus file's `sourceNote`. Priority next step: OCR the located scanned KICD Core Mathematics PDF, or obtain a text-based copy, and replace the illustrative sub-strand content — no code changes required to do this.
- **Only two sub-strands per subject are loaded.** The corpus format scales trivially (drop in another JSON file), but content depth is currently a coverage limitation, not an architectural one.
- **Lesson length is currently fixed to 40/80 minutes** (single/double period), matching common Kenyan timetabling; the timeline split (10/40/35/15%) is a reasonable default, not sourced from KICD pacing guidance specifically.
