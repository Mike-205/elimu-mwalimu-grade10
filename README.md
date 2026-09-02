# Elimu, Mwalimu wa Grade 10

Offline-first lesson-pack generator for a Kenyan Grade 10 teacher covering a strand outside her training. **One answer, not the answer**: pick a strand and a lesson length, get one complete 40- or 80-minute lesson pack — timeline, what to teach, board notes, one no-materials activity, five marked assessment questions, and a plain explainer for the topic itself. Grounded only in loaded KICD-derived curriculum material; refuses ("sijui") rather than fabricating a pack for anything not actually loaded.

See `docs/who-this-helps.md` and `docs/ai-bill-2026-risk-sheet.md` for the two required pin-up sheets, and `docs/project-overview.md` / `docs/technical-design.md` for the full writeups.

## Run it

No install step, no npm dependencies — pure Node.js built-ins.

```
node server/index.js
```

Then open `http://127.0.0.1:4173` in a browser. Everything runs on localhost; no network calls are made, ever. Pick grade/subject/strand/sub-strand/lesson length, click **Generate my lesson pack**, then **Print / save this pack** — that's the "pack she can carry": a printable page, not a screen she has to keep open.

## How "one answer, not the answer" is enforced

There is no free-text box, no menu of five separate questions, and no chat interface. One button produces one assembled pack. There is also no language model anywhere in this path — `server/packBuilder.js` fills a fixed template directly from corpus fields, so there is nothing in the generation step that could hallucinate.

## How the "sijui" rule is enforced (not just promised)

`server/index.js`'s `/api/pack` endpoint does an exact `{grade, subject, strand, subStrand}` match against the loaded corpus. If nothing matches, it returns a refusal (`{ sijui: true, message: ... }`) and builds nothing. The dropdowns in the UI are themselves generated from `/api/options`, which only lists combinations that are actually loaded — so the refusal path is a defence against direct API misuse, not something a teacher can hit by clicking normally.

## Corpus honesty

Every corpus file (`corpus/**/*.json`) carries a `sourceNote` explaining exactly what's verified fact vs. illustrative gap-fill content, and why (KICD's official curriculum-design downloads are JS-rendered and couldn't be scraped in the build window; one alternate copy of the real Grade 10 Core Mathematics PDF was located but is a scanned image with no extractable text). The app surfaces this in the UI via the "illustrative content" badge on every generated pack. Replacing a corpus file with real extracted KICD text requires no code changes.
