# Elimu, Mwalimu wa Grade 10 — Technical Design

This describes the system as actually built (not as merely planned) — see `server/`, `public/`, and `corpus/` in this repo. Everything below is verifiable against that code.

## Design constraints, and why they shaped the architecture

| Constraint (from the brief) | Architectural consequence |
|---|---|
| No internet in the room | No network call may occur at request time. Server runs on `127.0.0.1` only; frontend is static files served by the same process; any LLM used must run locally. |
| No learner data enters the system | No login, no persistence layer, no database. State lives in memory per-request only; nothing survives a restart. |
| "Sijui" beats a confident guess | Refusal must be enforced in code, at more than one layer, not left to a prompt's good behavior alone. |
| Ground answers only in approved curriculum material | Retrieval-first, not generation-first. The LLM (when present) is a formatting layer over retrieved text, never a free-standing knowledge source. |
| Build must run in a bare hackathon environment | Zero npm dependencies — Node.js built-ins only (`http`, `fs`, `path`). No install step, no version drift, no network needed to set up the app itself. |

## Component overview

```
corpus/{grade}/{subject}/{strand-file}.json   <- source of truth, config-driven
server/corpus.js     -> loads and flattens corpus into chunks + derives {grade,subject,strand} option tree
server/retrieval.js  -> keyword-overlap scorer + confidence threshold (the sijui gate)
server/ollama.js     -> optional local-LLM client, strictly grounded prompt, refuses-to-guess instruction
server/index.js       -> HTTP server: static file serving + /api/options, /api/lookup, /api/ask
public/index.html/.js/.css -> teacher-facing UI: grade/subject/strand/sub-strand pickers,
                              five structured question buttons, free-text fallback
```

### Corpus layer (`corpus/`)

Each JSON file represents one strand within one `{grade, subject}` pair and contains one or more sub-strands. Every sub-strand entry carries:

- `learningOutcomes`, `boardNotes`, `suggestedActivity`, `assessmentRubric`, `explainer` — the actual content the five teacher-questions map onto directly.
- `citation` — a human-readable pointer back to where this should live in the official curriculum design, so any answer can be checked against source.
- `verified` — `"illustrative"` (gap-filled content, style-matched to a real curriculum design but not verbatim) vs. a future `"official"` state once real extracted text replaces it.
- A document-level `sourceNote` explaining exactly what was and wasn't obtainable, and why.

This structure is deliberately config-driven: adding a new grade, subject, or strand is "drop a new JSON file in the right folder," not a code change. `server/corpus.js` derives the full `{grade → subject → strand → subStrand}` option tree by walking the directory at startup — the UI's dropdowns are generated from whatever's actually on disk, never hardcoded to one subject.

### Retrieval layer (`server/retrieval.js`) — the sijui gate

No embeddings, no vector database, no external service: retrieval is keyword-overlap scoring against a stopword-filtered token set, with a fixed confidence threshold (`CONFIDENCE_THRESHOLD = 0.12`). This is intentional, not a shortcut:

- It has zero setup cost and zero additional dependency — consistent with the "runs anywhere, offline, no install" constraint.
- It's inspectable and predictable under demo conditions — a score is just "how many of the query's meaningful words appear in this chunk," which is easy to reason about live if a judge asks "why did it say that."
- Crucially, this same score is the enforcement mechanism for "sijui": if nothing clears the threshold, the API returns a refusal object (`{ sijui: true, message: ... }`) and **no LLM call is even attempted**. Refusal is a retrieval-layer decision, not something delegated to the language model's judgment.

### Structured question flow (`/api/lookup`)

For the five canned teacher-questions, the teacher has already disambiguated grade/subject/strand/sub-strand via the dropdowns, so there is no retrieval ambiguity to resolve — the endpoint does an exact `{grade, subject, strand, subStrand}` match and returns the corresponding field directly (`learningOutcomes` for "what do I teach," `boardNotes` for "what goes on the board," etc.). This path never touches the LLM at all: it is pure, deterministic lookup, which is why it's the most reliable part of the system and the right thing to demo first.

### Free-text flow (`/api/ask`) — retrieval, then optional generation, then fallback

1. `retrieve()` scores the question against all loaded chunks for the selected `{grade, subject}`. Below threshold → immediate `sijui`, no LLM call.
2. If a chunk clears the threshold, and a local Ollama server is reachable (`ollama.isAvailable()`, a 1.5s-timeout probe against `/api/tags`), the question and *only* the retrieved chunk's fields are sent to the model (`ollama.generate()`), with an explicit instruction: answer only from the given context, and respond with exactly `SIJUI` if the context doesn't actually support an answer.
3. If Ollama is unavailable, times out, or itself returns `SIJUI`, the endpoint does **not** fail or return nothing — it falls back to returning the retrieved chunk's raw `explainer` and `boardNotes` with its citation, tagged `mode: "retrieval-only"`. The teacher always gets grounded material with a source; worst case is "plain," never "wrong."

This fallback was verified directly: with no Ollama process running, `/api/ask` for an in-corpus question correctly returned `retrieval-only` grounded content, and for an out-of-corpus question correctly returned `sijui` — both without any language model involved.

### Why generation is optional, not central

The five-button structured flow and the retrieval-only fallback are both already a complete, correct, gradeable product on their own — every answer is either an exact grounded lookup or an honest refusal. A local LLM (via Ollama, pulled at prep time while internet is available, run fully offline thereafter) is layered on top purely to make free-text answers read more naturally; it is never the only path to a correct-or-refused answer, and its absence degrades the UX, not the correctness or the safety properties.

### Frontend (`public/`)

Plain HTML/CSS/vanilla JS, no build step, no framework. On load, it fetches `/api/options` and populates cascading `grade → subject → strand → subStrand` selects from whatever the corpus actually contains — so the "teachers carry multiple subjects/grades" requirement is a UI consequence of the corpus structure, not a separate feature. A persistent banner discloses "AI is involved in this session" and the no-learner-data policy before any interaction, addressing the disclosure requirement structurally rather than as a one-time notice.

## Compliance alignment (see `docs/ai-bill-2026-risk-sheet.md` for the full reasoning)

The build implements, in code, several of the safeguards the Kenya AI Bill 2026 requires specifically of high-risk systems — regardless of which risk tier this ultimately lands in:

- **Human oversight**: every output is advisory; nothing reaches a learner without the teacher acting on it independently.
- **Transparency**: AI-involvement disclosure is a persistent UI element, not a one-time modal.
- **Traceability**: every non-refused answer carries a citation and a `verified` flag.
- **Refuse-over-guess**: enforced at the retrieval layer and the prompt layer, independently, as described above.

## Known limitations and next steps

- **Corpus content is illustrative, not verbatim official text**, for the reasons stated in `docs/project-overview.md` and each corpus file's `sourceNote`. Priority next step: OCR the located scanned KICD Core Mathematics PDF, or obtain a text-based copy, and replace the illustrative sub-strand content — no code changes required to do this.
- **Keyword retrieval is deliberately simple** and will miss paraphrased questions that share no vocabulary with the corpus text. An embedding-based retriever would improve recall, at the cost of a model download and added setup complexity — a reasonable trade for a future iteration, not for a same-day offline build.
- **Local generation (Ollama) was not verified end-to-end in this build session** due to a 1.4GB binary download not completing in the available time; the system was explicitly designed so this is a UX enhancement whose absence doesn't compromise correctness or safety.
