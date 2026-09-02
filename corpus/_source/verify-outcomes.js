// Verifies each learningOutcome is a faithful de-interleaving of the source PDF text:
// every word must appear in the source IN ORDER within a bounded window, allowing the
// adjacent table column's words to be interleaved between them.
const fs = require('fs');
const {loadCorpus} = require('../../server/corpus.js');

const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const src = norm(fs.readFileSync(process.argv[2], 'utf8'));

let fail = 0, clean = 0, deinter = 0;
for (const chunk of loadCorpus()) {
  for (const outcome of chunk.learningOutcomes) {
    const want = norm(outcome);
    let best = null;
    for (let start = 0; start < src.length; start++) {
      if (src[start] !== want[0]) continue;
      let wi = 0, si = start;
      while (si < src.length && wi < want.length && si - start < 400) {
        if (src[si] === want[wi]) wi++;
        si++;
      }
      if (wi === want.length && (!best || si - start < best)) best = si - start;
    }
    if (best === null) { fail++; console.log(`UNTRACED  ${chunk.id}: ${outcome}`); }
    else if (best === want.length) clean++;
    else { deinter++; console.log(`de-interleaved (${best - want.length} foreign words removed)  ${chunk.id}: ${outcome.slice(0, 55)}...`); }
  }
}
console.log(`\n${clean} contiguous, ${deinter} de-interleaved, ${fail} untraced`);
process.exit(fail ? 1 : 0);
