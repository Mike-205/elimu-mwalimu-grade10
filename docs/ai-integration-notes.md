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
node server/ai.test.js                 # no model needed
node server/index.js                   # default: feature absent entirely
AI_ENABLED=1 node server/index.js      # panel appears if a model is also reachable
```

**Off unless asked for.** `CONTRIBUTING.md`'s first rule forbids a second button or a
free-text box, and this adds both — so it does not exist unless `AI_ENABLED=1` is set. The
flag is checked twice and fails closed: `isAvailable()` reports unavailable without
probing, and `askGrounded()` refuses before reaching a model, so a direct POST cannot get
round the hidden panel.

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

248 real `llama3.2:3b` answers over **all 31 sub-strands**. Two question sets per chunk:
**grounded** (answerable from the chunk) and **adjacent** (plausible for the subject, not
covered by that chunk — previous year's teaching, textbook page, misconceptions elsewhere,
what equipment to buy). Saved to `server/ai.calibrate.jsonl`, appended per answer so a run
that dies at call 240 is not lost, and re-scorable offline in milliseconds:

```bash
node server/ai.calibrate.js --all      # ~15 min, all 31 sub-strands, rewrites the jsonl
node server/ai.calibrate.js            # ~4 min, 12-sub-strand sample
node server/ai.calibrate.js --replay   # instant, re-scores the saved answers
```

### Overlap alone does not work, and got worse as the corpus grew

| | Grounded | Adjacent |
|---|---|---|
| Overlap range | 0.25 – 1.00 | 0.22 – 1.00 |

The distributions sit on top of each other. Every threshold traded roughly one good answer
for one bad one — at 0.60, keeping 85% of grounded answers still let 90% of the surviving
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

Every content word is from the chunk, so overlap scores these *high*. The walkie-talkie one
is the clearest harm: it invents a purchase for an activity the brief requires to need no
materials. No threshold can catch this, because the vocabulary is not the problem.

What they share is a speculative or outside-the-chunk framing — and a grounded answer
restating loaded material has no reason to hedge. That became the `EXTERNAL_CLAIM` gate.

### Result, full corpus

124 answerable questions and 124 uncovered ones:

| | Without the gate | With it |
|---|---|---|
| Answerable questions answered | 121/124 (98%) | **121/124 (98%)** |
| Uncovered questions answered | 96/124 (77%) | **10/124 (8%)** |

It costs nothing on the grounded side and removes seven eighths of the uncovered answers.
The rest split 105 blocked as external claims and 9 self-refused.

**All 10 survivors were inspected and none asserts anything false.** In every case the
model ignored the unanswerable question and restated correct chunk content — the
LAN/WAN/PAN list, the physical-versus-logical topology distinction, the cone and sphere
volume formulas, the probability range. One was asked what equipment the school should buy
and answered with the topology definitions, recommending no purchase at all. The residual
failure is a non-answer, not a fabrication.

`MIN_OVERLAP` therefore sits at **0.30**, low enough to stop punishing paraphrase. Every
higher value tested discarded good answers and caught nothing worth having — the survivors
score 0.54–1.00, and reaching even one of them costs 8% of the grounded set. Do not raise
it expecting it to help with ungrounded claims; that is `EXTERNAL_CLAIM`'s job.

The 12-sub-strand sample run beforehand gave 98% grounded and 6% uncovered, within a
couple of points of the full corpus. The fast sample is trustworthy for routine re-checks;
`--all` is only needed when a decision rests on it.

## The other real constraint: speed

**~6 tokens/sec on CPU.** A 120-token answer is roughly 20 seconds; short ones came back in
1–4s once the model was warm. `num_predict` is capped at 120 for that reason, which is also
a correctness feature — shorter answers have less room to drift.

This rules out anything long-form in the request path. Pack translation or full-text
rewriting are not viable interactively at this speed and would have to be background work.
The UI tells the teacher the wait is coming rather than leaving a dead button.

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
