# Elimu, Mwalimu wa Grade 10

Offline-first lesson-pack generator for a Kenyan Grade 10 teacher covering a strand outside her training. **One answer, not the answer**: pick a strand and a lesson length, get one complete 40- or 80-minute lesson pack — timeline, what to teach, board notes, one no-materials activity, five marked assessment questions, and a plain explainer for the topic itself. Grounded only in loaded KICD-derived curriculum material; refuses ("sijui") rather than fabricating a pack for anything not actually loaded.

See `docs/who-this-helps.md` and `docs/ai-bill-2026-risk-sheet.md` for the two required pin-up sheets, and `docs/project-overview.md` / `docs/technical-design.md` for the full writeups.

## Run it

No install step, no npm dependencies — pure Node.js built-ins.

```
node server/index.js
```

Then open `http://127.0.0.1:4173` in a browser.

There is one optional extra, off by default. `AI_ENABLED=1 node server/index.js` adds a
panel for asking a question about the sub-strand you just generated, answered by a local
model from that sub-strand's material alone and refusing rather than guessing. It needs
Ollama and a pulled model, never touches the printed pack, and with the flag unset none of
it exists. See `docs/ai-integration-notes.md`. Everything runs on localhost; no network calls are made, ever. Pick grade/subject/strand/sub-strand/lesson length, click **Generate my lesson pack**, then **Print / save this pack** — that's the "pack she can carry": a printable page, not a screen she has to keep open.

## How "one answer, not the answer" is enforced

There is no free-text box, no menu of five separate questions, and no chat interface. One button produces one assembled pack. There is also no language model anywhere in this path — `server/packBuilder.js` fills a fixed template directly from corpus fields, so there is nothing in the generation step that could hallucinate.

## How the "sijui" rule is enforced (not just promised)

`server/index.js`'s `/api/pack` endpoint does an exact `{grade, subject, strand, subStrand}` match against the loaded corpus. If nothing matches, it returns a refusal (`{ sijui: true, message: ... }`) and builds nothing. The dropdowns in the UI are themselves generated from `/api/options`, which only lists combinations that are actually loaded — so the refusal path is a defence against direct API misuse, not something a teacher can hit by clicking normally.

## Corpus honesty

Every corpus file (`corpus/**/*.json`) carries a `sourceNote` explaining exactly which fields are quoted from the official KICD curriculum design and which are teacher-authored, and every generated pack carries the same statement as a badge.

The split is the same in all 31 sub-strands. **Learning outcomes are verbatim** from the sub-strand's "Specific Learning Outcomes" list in the official Grade 10 Computer Science and Mathematics curriculum designs — the extracted text of both is committed under `corpus/_source/`, so any quotation can be checked without internet. **Board notes, the activity, the five assessment questions and the explainer are illustrative** teacher-authored content: the design says what a learner must be able to do, not what to write on a board or how to mark it.

`corpus/_source/verify-outcomes.js` enforces this rather than promising it — it checks every quoted outcome against the source designs and fails if one has drifted. Earlier versions of this README said the KICD designs could not be obtained as machine-readable text; text-layer copies of both were subsequently located, and `pdftotext` alone extracts them, so no OCR is involved. See `docs/corpus-content-plan.md` for provenance and the two places where a design contradicts itself.
