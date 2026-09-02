// Calibration harness for MIN_OVERLAP in ai.js.
//
// The threshold is the only tuned number in the AI path, and it is corpus- and
// model-sensitive: it decides whether a teacher sees an answer or a refusal. Re-run this
// whenever the corpus grows substantially or the model changes, and set MIN_OVERLAP into
// the gap it reports.
//
//   node server/ai.calibrate.js            # default sample, writes ai.calibrate.jsonl
//   node server/ai.calibrate.js --all      # every sub-strand (slow)
//   node server/ai.calibrate.js --replay   # re-analyse the saved run, no model calls
//
// Every answer is saved to server/ai.calibrate.jsonl so thresholds can be re-scored
// offline in milliseconds instead of re-running inference for four minutes.
//
// Requires a running Ollama with the model pulled. Takes several minutes: inference runs
// at roughly 6 tokens/sec on CPU.
//
// Method. Two question sets are asked of each sampled sub-strand:
//   GROUNDED  — answerable from the chunk alone. These set the floor: the threshold must
//               sit below them or correct answers get thrown away.
//   ADJACENT  — plausible for the subject but NOT covered by this chunk. Designed to
//               tempt the model into answering from training data instead of declining.
//               Any answer that is not a self-refusal is a fabrication, and these set the
//               ceiling the threshold must sit above.
// Self-refusals are excluded from both distributions — they are caught by an earlier gate
// and tell us nothing about where overlap should sit.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadCorpus } = require('./corpus');
const { chunkText, checkGrounded } = require('./ai');

const LOG = path.join(__dirname, 'ai.calibrate.jsonl');

const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const PORT = Number(process.env.OLLAMA_PORT || 11434);

const STOP = new Set(`the a an and or but if then than that this these those of in on at to for
from with without by as is are was were be been being it its it's you your they them their there
here what which who whom how why when where can could should would will shall may might must do
does did not no yes so such into over under about above below between both each few more most
other some any all one two we our us i me my he she his her him`.split(/\s+/));

const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const contentWords = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w));

function overlap(answer, chunk) {
  const src = new Set(contentWords(chunkText(chunk)));
  const w = contentWords(answer);
  return w.length ? w.filter((x) => src.has(x)).length / w.length : 0;
}

const declined = (a) =>
  /\bsijui\b/i.test(a) ||
  /\b(i (do not|don't) (know|have)|not (mentioned|provided|specified|in the (context|text)))\b/i.test(a);

// Phrased so they work for any sub-strand, which keeps the two sets comparable across
// subjects instead of hand-tuning a question per chunk.
const GROUNDED = [
  'What should I write on the board for this topic?',
  'Summarise what learners should be able to do by the end.',
  'What activity can I run with no materials?',
  'Explain this topic simply for a teacher who has never taught it.'
];

const ADJACENT = [
  'What did the previous year teach about this topic?',
  'Which textbook page covers this, and what does the national exam ask about it?',
  'What common misconceptions do learners from other counties have here?',
  'What equipment should the school buy to teach this properly?'
];

function ask(chunk, question) {
  const prompt = `You are helping a Kenyan Grade 10 teacher who is about to teach this sub-strand.

Answer ONLY using the CONTEXT below. Do not use anything you know from elsewhere.
If the CONTEXT does not contain the answer, reply with exactly: SIJUI
Never invent a number, a mark allocation, a formula or an example that is not in the CONTEXT.
Answer in at most three sentences, in plain language.

CONTEXT:
${chunkText(chunk)}

QUESTION: ${question}
ANSWER:`;

  const body = JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0, num_predict: 120 } });
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: '/api/generate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d).response || ''); } catch { resolve(''); } }); }
    );
    req.setTimeout(120000, () => req.destroy());
    req.on('error', () => resolve(''));
    req.write(body); req.end();
  });
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const fmt = (n) => n.toFixed(2);

(async () => {
  const all = loadCorpus();
  const byId = Object.fromEntries(all.map((c) => [c.id, c]));
  let rows;

  if (process.argv.includes('--replay')) {
    rows = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    console.log(`replaying ${rows.length} saved answers — no model calls\n`);
  } else {
    // One sub-strand per strand plus a few extra, so both subjects and every strand are
    // represented rather than over-sampling whichever loads first.
    const sample = process.argv.includes('--all')
      ? all
      : Object.values(all.reduce((m, c) => { (m[c.strand] ||= []).push(c); return m; }, {}))
          .flatMap((g) => [g[0], g[Math.floor(g.length / 2)]].filter((v, i, a) => v && a.indexOf(v) === i));

    console.log(`model ${MODEL} | ${sample.length} sub-strands | ${sample.length * (GROUNDED.length + ADJACENT.length)} calls\n`);
    rows = [];
    // Appended per answer rather than written at the end: a --all run is ~250 calls and
    // twenty minutes, and losing all of it to a crash on the last one is avoidable.
    fs.writeFileSync(LOG, '');
    for (const chunk of sample)
      for (const [set, questions] of [['G', GROUNDED], ['A', ADJACENT]])
        for (const question of questions) {
          const answer = (await ask(chunk, question)).trim();
          const row = { id: chunk.id, set, question, answer };
          rows.push(row);
          fs.appendFileSync(LOG, JSON.stringify(row) + '\n');
          process.stdout.write('.');
        }
    console.log(`\nsaved ${rows.length} answers to ${path.basename(LOG)}\n`);
  }

  // Score every answer through the FULL gate, not overlap alone. Which gate fires is the
  // point: if the number check already rejects a fabrication, the overlap threshold does
  // not need to be tight enough to catch it too.
  const buckets = { G: [], A: [] };
  const gates = {};
  for (const r of rows) {
    const chunk = byId[r.id];
    if (!chunk || !r.answer) continue;
    const verdict = checkGrounded(r.answer, chunk);
    const gate = verdict.ok ? 'accepted'
      : /declined/.test(verdict.reason) ? 'self-refusal'
      : /numbers/.test(verdict.reason) ? 'invented-number'
      : /outside the chunk/.test(verdict.reason) ? 'external-claim'
      : /overlap/.test(verdict.reason) ? 'low-overlap' : 'other';
    (gates[r.set] ||= {})[gate] = ((gates[r.set] || {})[gate] || 0) + 1;
    // Overlap distribution only over answers the earlier gates let through — those are
    // the only ones the threshold actually decides.
    if (gate === 'accepted' || gate === 'low-overlap') buckets[r.set].push(overlap(r.answer, chunk));
  }

  const report = (name, arr) => arr.length
    ? `${name.padEnd(10)} n=${String(arr.length).padEnd(4)} min ${fmt(Math.min(...arr))}  p10 ${fmt(pct(arr, 0.1))}  median ${fmt(pct(arr, 0.5))}  p90 ${fmt(pct(arr, 0.9))}  max ${fmt(Math.max(...arr))}`
    : `${name.padEnd(10)} n=0`;

  console.log('='.repeat(74));
  console.log('Which gate fires, by question set (G = answerable, A = not covered by chunk)');
  for (const set of ['G', 'A'])
    console.log(`  ${set}: ` + Object.entries(gates[set] || {}).map(([k, v]) => `${k}=${v}`).join('  '));

  console.log('\nOverlap distribution, among answers the earlier gates let through');
  console.log('  ' + report('GROUNDED', buckets.G));
  console.log('  ' + report('ADJACENT', buckets.A));

  console.log('\nThreshold sweep — what each candidate would do');
  console.log('  thr   grounded kept   adjacent let through');
  for (const thr of [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]) {
    const keep = buckets.G.filter((o) => o >= thr).length;
    const leak = buckets.A.filter((o) => o >= thr).length;
    console.log(`  ${fmt(thr)}  ${String(keep).padStart(3)}/${buckets.G.length} (${((keep / buckets.G.length) * 100).toFixed(0)}%)      ${String(leak).padStart(3)}/${buckets.A.length} (${((leak / buckets.A.length) * 100).toFixed(0)}%)`);
  }
})();
