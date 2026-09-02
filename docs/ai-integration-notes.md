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
the fact. Gates run in this order, cheapest and most decisive first:

1. **Self-refusal** — the agreed `SIJUI` token, or a refusal phrased as prose.
2. **Claim outside the chunk** — speculative or external framing. Does the heavy lifting;
   see below.
3. **Invented numbers** — every number in the answer must already appear in the chunk.
   Line-leading list ordinals are stripped first: `1.` and `2.` are formatting, not
   claims, and flagging them threw away grounded answers. A digit anywhere else is still
   checked.
4. **Content-word overlap** — a loose floor, kept only as a backstop.
5. **Shape** — non-empty, has content words, question within length bounds.

## What calibration actually found — read this before tuning anything

96 real `llama3.2:3b` answers over 12 sub-strands spanning all 6 strands. Two question
sets per chunk: **grounded** (answerable from the chunk) and **adjacent** (plausible for
the subject, not covered by that chunk — previous year's teaching, textbook page, what
equipment to buy). Saved to `server/ai.calibrate.jsonl`, so thresholds re-score offline
in milliseconds:

```bash
node server/ai.calibrate.js            # ~4 minutes, calls the model, rewrites the jsonl
node server/ai.calibrate.js --replay   # instant, re-scores the saved answers
```

### Overlap alone does not work, and got worse as the corpus grew

| | Grounded | Adjacent |
|---|---|---|
| Overlap range | 0.26 – 1.00 | 0.22 – 1.00 |

The distributions sit on top of each other. Every threshold traded roughly one good
answer for one bad one — at 0.60, keeping 81% of grounded answers still let 50% of
adjacent ones through.

This **reversed** the earlier reading. On the old 4-sub-strand corpus, grounded answers
scored 0.50–0.72 and fabrications 0.00–0.40, a clean gap. The expectation was that richer
chunks would allow a *stricter* threshold. The opposite happened: a bigger chunk gives any
fluent answer more vocabulary to match by accident, so the signal degrades as the corpus
improves. Worth remembering before trusting a threshold measured on a thin corpus.

### The failure mode overlap cannot see

Inspecting the answers that passed every gate explains why. A small model asked something
its chunk does not cover rarely invents new vocabulary — it reassembles the chunk's own
words into a claim the chunk never made:

> "The **previous year likely taught** that a well-designed network should have five
> qualities: performance, security, scalability, reliability and availability."
>
> "The school **should buy** a walkie-talkie for the whole-class message relay activity."
>
> "**Learners from other countries may think** that all computer storage is internal."

Every content word is from the chunk, so overlap scores these *high*. The walkie-talkie
one is the clearest harm: it invents a purchase for an activity the brief requires to
need no materials. No threshold can catch this, because the vocabulary is not the problem.

What they share is a speculative or outside-the-chunk framing — and a grounded answer
restating loaded material has no reason to hedge. Measured on the same 96 answers:

| | matched the pattern |
|---|---|
| Grounded answers | **0 / 46** |
| Adjacent answers that had passed every other gate | **28 / 31** |

That became the `EXTERNAL_CLAIM` gate.

### Result

| | Before the gate | After |
|---|---|---|
| Grounded questions answered | 46/48 (96%) | **47/48 (98%)** |
| Uncovered questions answered | 31/48 (65%) | **3/48 (6%)** |

The three that still get through are benign: the model ignored the unanswerable question
and restated correct chunk content — the LAN/WAN/PAN list, the probability range. Nothing
false is asserted. The remainder split 42 blocked as external claims and 3 self-refused.

`MIN_OVERLAP` therefore sits at **0.30**, low enough to stop punishing paraphrase. Every
higher value tested discarded good answers and caught nothing extra — the three survivors
score 0.84–1.00, so raising the threshold is pure cost. Do not raise it expecting it to
help with ungrounded claims; that is `EXTERNAL_CLAIM`'s job.

## Known gaps

- **`EXTERNAL_CLAIM` is a phrase list, so it is evadable.** It catches the framings this
  model actually produced, not the category in general. A different model that hedges
  differently would need it re-derived — rerun the calibration and inspect what gets
  through, rather than assuming the current list transfers.
- **Both gates are lexical, not semantic.** A false claim stated flatly, in the chunk's
  own vocabulary, with no hedge and no number, passes everything. Nothing here understands
  the answer; the defence is that a small model rarely writes that way.
- **No conversation.** One question, one answer, no history. Deliberate — multi-turn
  gives the model room to drift from the chunk across turns.
- **Overlap is lexical, not semantic.** A correctly grounded answer that paraphrases
  heavily will score low and be refused. That is the intended direction of failure, but
  it is a real source of false refusals.
- **Not tested against a second model.** Every number here is `llama3.2:3b` on CPU.
- **The sample is 12 of 31 sub-strands.** Run `--all` for the full corpus if a decision
  rests on it.
