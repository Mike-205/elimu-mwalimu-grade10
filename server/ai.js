// Optional, additive local-model layer for the ai-integration branch.
//
// Nothing in main's request path imports this. /api/pack does not touch it, and the
// app runs identically with no model installed and no Ollama process — see
// isAvailable(), which is the only thing the frontend asks before hiding the feature.
//
// The rule this file exists to enforce is "sijui beats a guess". A model cannot be
// trusted to obey that instruction, so obedience is checked after the fact:
// checkGrounded() re-derives whether every claim in an answer traces back to the
// corpus chunk it was supposed to come from, and anything that does not is discarded
// and replaced with a refusal. A false refusal is a cost we accept; a fabricated
// answer handed to a teacher is not.

const http = require('http');

// Off unless explicitly switched on. CONTRIBUTING.md's first rule says the app must have
// exactly one input and one action, and this feature adds a text box — so it does not
// exist unless someone asks for it by name. With the flag unset the app is, from the
// outside, byte-for-byte the single-action tool the brief describes: no panel, no second
// button, no model call, and /api/ask refuses without probing anything.
//
//   AI_ENABLED=1 node server/index.js
const ENABLED = process.env.AI_ENABLED === '1';

const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// Measured at ~6 tokens/sec on CPU, so 120 tokens is already a ~20s wait. Keeping the
// cap low is a correctness feature as much as a latency one: short answers have less
// room to drift off the corpus.
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 120);
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 90000);

// ponytail: calibration knob. What fraction of an answer's content words must also
// appear in the chunk. Re-measure with server/ai.calibrate.js if the model changes.
//
// Deliberately loose. Measured over 96 real llama3.2:3b answers on the full 31-sub-strand
// corpus, overlap turned out to be a WEAK discriminator — grounded answers ran 0.26-1.00
// and uncovered-question answers 0.22-1.00, and every threshold traded roughly one good
// answer for one bad one. It was a decent signal on the old 4-sub-strand corpus and got
// worse as chunks grew richer, because a bigger chunk gives any fluent answer more
// vocabulary to match by accident.
//
// So it is kept only as a cheap backstop against genuinely off-topic vocabulary — text
// that shares almost no words with the chunk, which is what a prompt failure looks like —
// and set low enough to stop punishing paraphrase: 0.30 keeps 98% of grounded answers and
// rejects none of the uncovered ones that reach it. Every higher value tested discarded
// good answers and caught nothing extra.
//
// The work of rejecting plausible-but-ungrounded answers is done by EXTERNAL_CLAIM below.
// Do not raise this expecting it to help with that; it does not.
const MIN_OVERLAP = Number(process.env.AI_MIN_OVERLAP || 0.3);

// The failure mode overlap cannot see, and the reason this gate exists.
//
// A small model asked something the chunk does not cover rarely invents new vocabulary.
// It reassembles the chunk's own words into a claim the chunk never made — "the previous
// year likely taught...", "the school should buy a walkie-talkie for the message relay
// activity", "learners from other countries may think...". Every content word is from the
// chunk, so overlap scores high and waves it through, and the claim is still false. The
// walkie-talkie one is the clearest harm: it invents a purchase for an activity the brief
// requires to need no materials.
//
// What those answers share is a speculative or outside-the-chunk framing, and a grounded
// answer restating loaded material has no reason to hedge. Measured on the same 96
// answers: 0 of 46 grounded answers matched this pattern, against 28 of the 31 uncovered
// answers that had passed every other gate.
const EXTERNAL_CLAIM = /\b(likely|probably|might (think|assume|have)|may (think|assume|have)|should (buy|bring|consider|purchase|invest|obtain|acquire)|previous year|last year|next year|textbook page|national exam|other (countries|counties)|typically taught|commonly taught)\b/i;

const REFUSAL = 'Sijui — that is not in the loaded curriculum material for this sub-strand.';

// Small closed-class list only. Deliberately not a big stop-word list: the more words
// excluded from the overlap ratio, the weaker the check.
const STOP = new Set(`the a an and or but if then than that this these those of in on at to for
from with without by as is are was were be been being it its it's you your they them their there
here what which who whom how why when where can could should would will shall may might must do
does did not no yes so such into over under about above below between both each few more most
other some any all one two we our us i me my he she his her him`.split(/\s+/));

const words = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

const contentWords = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w));

const numbers = (s) => String(s).match(/\d+(?:\.\d+)?/g) || [];

// The model likes to format answers as "1. ... 2. ...". Those ordinals are formatting,
// not claims, and the chunk has no reason to contain them — left in, they get flagged as
// invented numbers and a perfectly grounded answer is thrown away. Strip line-leading
// list markers only; a digit anywhere else in the sentence is still a claim and still
// checked, so "1. The answer is 42 marks" still trips on 42.
const claimNumbers = (s) => numbers(String(s).replace(/(?:^|\n)[ \t]*\d+[.)][ \t]/g, '\n'));

/** Everything the model is allowed to know, flattened. Also what answers are checked against. */
function chunkText(chunk) {
  return [
    chunk.grade, chunk.subject, chunk.strand, chunk.subStrand,
    ...(chunk.learningOutcomes || []),
    ...(chunk.boardNotes || []),
    chunk.activity && chunk.activity.description,
    chunk.activity && chunk.activity.materialsNeeded,
    ...(chunk.assessmentQuestions || []).flatMap((q) => [q.question, q.markingScheme]),
    chunk.explainer
  ].filter(Boolean).join('\n');
}

/**
 * The response-checking layer. Pure, synchronous, and testable without a model —
 * see server/ai.test.js. Returns { ok, reason }.
 */
function checkGrounded(answer, chunk) {
  const text = String(answer || '').trim();
  if (!text) return { ok: false, reason: 'empty answer' };

  // The model was told to emit this when the context does not cover the question.
  if (/\bsijui\b/i.test(text)) return { ok: false, reason: 'model declined' };

  // A refusal that arrives as prose rather than the agreed token still counts.
  if (/\b(i (do not|don't) (know|have)|not (mentioned|provided|specified|in the (context|text)))\b/i.test(text))
    return { ok: false, reason: 'model declined in prose' };

  // Runs before the vocabulary checks precisely because these answers pass them.
  const speculation = text.match(EXTERNAL_CLAIM);
  if (speculation) return { ok: false, reason: `claim outside the chunk: "${speculation[0]}"` };

  const source = chunkText(chunk);

  // Numbers are where a small model invents most confidently, and a wrong mark
  // allocation or wrong angle is worse than no answer. Every number in the answer must
  // already appear in the chunk.
  const known = new Set(numbers(source));
  const invented = claimNumbers(text).filter((n) => !known.has(n));
  if (invented.length) return { ok: false, reason: `numbers not in source: ${invented.join(', ')}` };

  const answerWords = contentWords(text);
  if (!answerWords.length) return { ok: false, reason: 'no content words' };

  const sourceWords = new Set(contentWords(source));
  const hits = answerWords.filter((w) => sourceWords.has(w)).length;
  const overlap = hits / answerWords.length;
  if (overlap < MIN_OVERLAP)
    return { ok: false, reason: `overlap ${overlap.toFixed(2)} below ${MIN_OVERLAP}` };

  return { ok: true, overlap: Number(overlap.toFixed(2)) };
}

function buildPrompt(chunk, question) {
  return `You are helping a Kenyan Grade 10 teacher who is about to teach this sub-strand.

Answer ONLY using the CONTEXT below. Do not use anything you know from elsewhere.
If the CONTEXT does not contain the answer, reply with exactly: SIJUI
Never invent a number, a mark allocation, a formula or an example that is not in the CONTEXT.
Answer in at most three sentences, in plain language.

CONTEXT:
${chunkText(chunk)}

QUESTION: ${question}
ANSWER:`;
}

function ollama(path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: OLLAMA_HOST, port: OLLAMA_PORT, path,
        method: payload ? 'POST' : 'GET',
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Is a local model reachable right now? Frontend hides the whole feature when false. */
async function isAvailable() {
  // Fail closed, and do not even probe: with the flag off there is nothing to offer.
  if (!ENABLED) return { available: false, enabled: false, model: MODEL, installed: [] };
  try {
    const tags = await ollama('/api/tags', null, 2000);
    const models = (tags.models || []).map((m) => m.name);
    return { available: models.includes(MODEL), enabled: true, model: MODEL, installed: models };
  } catch {
    return { available: false, enabled: true, model: MODEL, installed: [] };
  }
}

/**
 * Ask one question about one sub-strand. Always resolves — never throws at the caller —
 * and every failure path returns a refusal rather than anything a teacher could mistake
 * for an answer.
 */
async function askGrounded(chunk, question) {
  // Second, independent guard. The frontend already hides the panel when disabled, but a
  // direct POST must not reach a model either.
  if (!ENABLED) return { sijui: true, message: REFUSAL, reason: 'ai disabled' };

  const q = String(question || '').trim();
  if (q.length < 3) return { sijui: true, message: REFUSAL, reason: 'question too short' };
  if (q.length > 300) return { sijui: true, message: REFUSAL, reason: 'question too long' };

  let raw;
  try {
    const out = await ollama('/api/generate', {
      model: MODEL,
      prompt: buildPrompt(chunk, q),
      stream: false,
      options: { temperature: 0, num_predict: MAX_TOKENS }
    }, TIMEOUT_MS);
    raw = out.response;
  } catch (e) {
    return { sijui: true, message: REFUSAL, reason: `model unavailable: ${e.message}` };
  }

  const verdict = checkGrounded(raw, chunk);
  if (!verdict.ok) return { sijui: true, message: REFUSAL, reason: verdict.reason };

  return {
    sijui: false,
    answer: String(raw).trim(),
    model: MODEL,
    overlap: verdict.overlap,
    // The frontend must render this verbatim. AI output never enters the printed pack.
    warning: 'Generated by a local AI model from this sub-strand only. Not KICD text. Check it before teaching it.'
  };
}

module.exports = { isAvailable, askGrounded, checkGrounded, chunkText, REFUSAL, ENABLED };
