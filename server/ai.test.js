// Self-check for the response-checking layer in ai.js.
//
// Runs with no model installed and no Ollama process — checkGrounded() is pure, and it
// is the only part of the AI path that decides whether a teacher sees an answer. If
// this passes, a hallucinated answer cannot reach the UI even if the model ignores
// every instruction in the prompt.
//
//   node server/ai.test.js

const assert = require('assert');
const { checkGrounded, chunkText } = require('./ai');

// Inline fixture rather than a real corpus file, so the test does not break when the
// corpus changes and does not silently pass if the corpus is empty.
const chunk = {
  grade: 'Grade 10',
  subject: 'Computer Science',
  strand: 'Foundation of Computer Science',
  subStrand: 'Central Processing Unit (CPU)',
  learningOutcomes: [
    'describe structural elements of the CPU of a computer system',
    'relate structural elements of the CPU to their functions'
  ],
  boardNotes: [
    'CPU structural elements: Arithmetic and Logic Unit (ALU), Control Unit (CU), Registers, Buses',
    'ALU does the sums and the comparisons. Control unit fetches instructions',
    'Fetch - Decode - Execute cycle: fetch instruction from memory, work out what it means, carry it out'
  ],
  activity: { description: 'Learners role play the fetch decode execute cycle at the front of the class.', materialsNeeded: 'None — spoken role play.' },
  assessmentQuestions: [
    { question: 'Name the three main structural elements of the CPU.', markingScheme: '3 marks, 1 each for arithmetic and logic unit, control unit, registers.' }
  ],
  explainer: 'The control unit is the supervisor and the ALU is the worker that adds and compares.'
};

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

check('accepts an answer built from the chunk', () => {
  const v = checkGrounded(
    'The control unit fetches instructions and the arithmetic and logic unit does the sums and comparisons.',
    chunk
  );
  assert.ok(v.ok, `expected ok, got: ${v.reason}`);
});

check('rejects an invented number', () => {
  // 64 appears nowhere in the chunk. A wrong figure handed to a teacher is the worst
  // failure mode this layer exists to stop.
  const v = checkGrounded('The CPU registers are 64 bits wide and hold the current instruction.', chunk);
  assert.ok(!v.ok);
  assert.match(v.reason, /numbers not in source/);
});

check('accepts a number that IS in the chunk', () => {
  const v = checkGrounded('Name the 3 structural elements: arithmetic and logic unit, control unit, registers.', chunk);
  assert.ok(v.ok, `expected ok, got: ${v.reason}`);
});

check('rejects the model self-refusing with the agreed token', () => {
  const v = checkGrounded('SIJUI', chunk);
  assert.ok(!v.ok);
  assert.strictEqual(v.reason, 'model declined');
});

check('rejects a refusal phrased as prose', () => {
  const v = checkGrounded('That is not mentioned in the context provided above.', chunk);
  assert.ok(!v.ok);
});

check('rejects an off-corpus answer', () => {
  // Plausible, fluent, and about the right general topic — but sourced from the model's
  // training data, not this sub-strand. Overlap is what catches it.
  const v = checkGrounded(
    'Modern processors use pipelining, branch prediction and speculative execution to improve throughput across superscalar architectures.',
    chunk
  );
  assert.ok(!v.ok, 'off-corpus answer was accepted');
  assert.match(v.reason, /overlap/);
});

check('rejects invented materials for a no-materials activity', () => {
  // The closest fabrication to the threshold in calibration (0.40 against 0.45), and the
  // one with real consequences: the brief requires an activity needing no materials, so
  // a model telling a teacher to bring beads and cards defeats the point of the pack.
  const v = checkGrounded(
    'Learners should bring coloured beads and a set of place-value cards to model each element.',
    chunk
  );
  assert.ok(!v.ok, 'invented-materials answer was accepted');
  assert.match(v.reason, /overlap/);
});

check('accepts a grounded answer that sits near the threshold', () => {
  // Real llama3.2:3b output scored ~0.5 in calibration. Guards the other direction:
  // if someone raises MIN_OVERLAP past the grounded floor, this fails loudly.
  const v = checkGrounded(
    'Write the structural elements on the board so learners can see that the control unit fetches and the ALU computes.',
    chunk
  );
  assert.ok(v.ok, `grounded near-threshold answer refused: ${v.reason}`);
});

check('rejects empty and whitespace answers', () => {
  assert.ok(!checkGrounded('', chunk).ok);
  assert.ok(!checkGrounded('   \n ', chunk).ok);
  assert.ok(!checkGrounded(null, chunk).ok);
});

check('rejects an answer with no content words', () => {
  const v = checkGrounded('the of and to', chunk);
  assert.ok(!v.ok);
});

check('chunkText includes every teaching field', () => {
  const t = chunkText(chunk);
  for (const needle of ['Arithmetic and Logic Unit', 'role play', '3 marks', 'supervisor', 'describe structural elements'])
    assert.ok(t.includes(needle), `chunkText missing: ${needle}`);
});

check('chunkText survives a chunk with missing optional fields', () => {
  assert.doesNotThrow(() => chunkText({ subStrand: 'X' }));
  assert.ok(!checkGrounded('anything at all here', { subStrand: 'X' }).ok);
});

if (!process.exitCode) console.log(`ai.test.js — ${passed} checks passed`);
