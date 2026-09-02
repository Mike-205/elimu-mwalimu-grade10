# `ai-integration` — what was built and what was measured

Exploratory branch. Per `CONTRIBUTING.md` the core app must work correctly **with this
branch never merged**, and it does: `server/corpus.js` and `server/packBuilder.js` are
untouched, and `server/index.js` gains 21 lines and deletes none.

## What it does

After a pack is generated, a separate panel lets the teacher ask **one question about
that sub-strand**. A local model answers using only that sub-strand's corpus fields, and
refuses otherwise.

| File | Role |
|---|---|
| `server/ai.js` | Prompt, Ollama client, and the response-checking layer |
| `server/ai.test.js` | Self-check for the checker. Runs with no model installed |
| `server/index.js` | Adds `GET /api/ai-status` and `POST /api/ask`. Nothing else |
| `public/*` | The panel, its styling, and the availability check |

```bash
node server/ai.test.js     # no model needed
node server/index.js       # panel appears only if a model is reachable
```

## How the guardrails are actually met

**Additive and optional.** `/api/pack` does not import `ai.js` and its code path is
unchanged. Delete both new routes and the app is byte-identical to `main`.

**Works with no model.** Verified by pointing `OLLAMA_PORT` at a dead port:
`/api/pack` still returns a full pack, `/api/ai-status` reports `available: false`, the
frontend never unhides the panel, and `/api/ask` refuses rather than erroring.

**Never enters the printed pack.** The panel sits outside `<article id="packBox">` and
carries `no-print`, which the existing print stylesheet already hides. The page the
teacher carries into class stays 100% corpus-sourced, so the argument in
`docs/ai-bill-2026-risk-sheet.md` holds word for word.

**Refuses cleanly.** Two independent gates. The sub-strand must match the loaded corpus
exactly — an unknown one is refused *before a model is ever called*, same gate as
`/api/pack`. Then `checkGrounded()` re-derives whether the answer traces back to the
chunk, and discards it if not. Every failure path returns the refusal string; there is no
branch that returns partial or best-effort text.

## The checker

A model cannot be trusted to obey "only use the context", so obedience is verified after
the fact, in four cheap checks:

1. **Self-refusal** — the agreed `SIJUI` token, or a refusal phrased as prose.
2. **Invented numbers** — every number in the answer must already appear in the chunk.
   This is the highest-value check: a wrong mark allocation or wrong angle handed to a
   teacher is worse than no answer at all.
3. **Content-word overlap** — the fraction of the answer's content words present in the
   chunk must clear a threshold.
4. **Shape** — non-empty, has content words, question within length bounds.

### Calibration — re-measure this if the model changes

`MIN_OVERLAP` is the one tuned number here. Measured against real `llama3.2:3b` output:

| | Overlap |
|---|---|
| Grounded answers | 0.50 – 0.72 |
| Plausible fabrications | 0.00 – 0.40 |

Threshold set at **0.45**, in the gap. The first guess of 0.6 was wrong: it refused
correct, fully grounded answers, and a teacher refused three times stops asking.

The worst fabrication scored **0.40** — telling a teacher to bring coloured beads and
place-value cards for an activity the brief requires to need *no materials*. It is
pinned as a test case, because it is both the closest to the threshold and the one with
real classroom consequences.

## Measured behaviour

Off-corpus questions — the World Cup, quantum entanglement, a recipe for ugali — were all
caught by the **model self-declining**, never reaching the overlap check. That is worth
knowing: on this model the overlap gate is a backstop, not the primary defence. It earns
its place for the case where the model confabulates confidently instead of declining,
which the invented-materials example shows it will do.

## The real constraint: speed

**~6 tokens/sec on CPU.** A 120-token answer is roughly 20 seconds; short ones came back
in 1–3s once the model was warm. `num_predict` is capped at 120 for that reason, which is
also a correctness feature — shorter answers have less room to drift.

This rules out anything long-form in the request path. Pack translation or full-text
rewriting are not viable interactively at this speed; they would need to be background
work. The UI tells the teacher the wait is coming rather than leaving a dead button.

## Known gaps

- **The threshold is corpus-sensitive.** It was calibrated on the sub-strands loaded at
  the time. Re-run the measurement after `corpus-content` merges, since 31 richer chunks
  will shift overlap upward and may allow a stricter threshold.
- **No conversation.** One question, one answer, no history. Deliberate — multi-turn
  gives the model room to drift from the chunk across turns.
- **Overlap is lexical, not semantic.** A correctly grounded answer that paraphrases
  heavily will score low and be refused. That is the intended direction of failure, but
  it is a real source of false refusals.
- **Not tested against a second model.** Every number here is `llama3.2:3b` on CPU.
