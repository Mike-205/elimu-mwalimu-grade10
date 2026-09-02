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

check('treats numbered-list ordinals as formatting, not claims', () => {
  // The model likes to answer with "1. ... 2. ...". Those ordinals are not in the chunk,
  // and before they were stripped a perfectly grounded list answer was refused as
  // containing invented numbers. Seen live, and twice in the calibration sample.
  const listed = checkGrounded(
    'The parts of the CPU are:\n1. control unit\n2. registers\n3. arithmetic and logic unit',
    chunk
  );
  assert.ok(listed.ok, `list-formatted grounded answer refused: ${listed.reason}`);

  // But only the marker is exempt — a number inside the text is still a claim.
  const smuggled = checkGrounded(
    'The parts of the CPU are:\n1. control unit\n2. registers running at 42 gigahertz',
    chunk
  );
  assert.ok(!smuggled.ok, 'invented number inside a list item was accepted');
  assert.match(smuggled.reason, /42/);
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
  // The brief requires an activity needing no materials, so a model telling a teacher to
  // buy or bring equipment defeats the point of the pack. Overlap cannot catch this —
  // every content word is lifted from the chunk — which is why EXTERNAL_CLAIM exists.
  for (const answer of [
    'Learners should bring coloured beads and a set of place-value cards to model each element.',
    'The school should buy a walkie-talkie so learners can act out the fetch decode execute cycle.'
  ]) {
    const v = checkGrounded(answer, chunk);
    assert.ok(!v.ok, `invented-materials answer accepted: ${answer}`);
    assert.match(v.reason, /outside the chunk/);
  }
});

check('rejects claims about things outside the chunk', () => {
  // Measured failure mode: the model reassembles the chunk's own vocabulary into a claim
  // the chunk never made. High overlap, still false. 28 of 31 such answers in calibration
  // carried one of these framings.
  for (const answer of [
    'The previous year likely taught that the control unit fetches instructions.',
    'Learners from other countries may think the ALU stores data.',
    'This is covered on the textbook page dealing with the control unit and registers.'
  ]) {
    const v = checkGrounded(answer, chunk);
    assert.ok(!v.ok, `external claim accepted: ${answer}`);
    assert.match(v.reason, /outside the chunk/);
  }
});

check('the external-claim gate does not fire on grounded answers', () => {
  // The other direction. In calibration this pattern matched 0 of 46 grounded answers;
  // if someone widens the regex carelessly, this fails loudly.
  for (const answer of [
    'The control unit fetches instructions and the arithmetic and logic unit does the sums.',
    'Learners can act out the fetch decode execute cycle at the front of the class.',
    'The CPU is basically a supervisor and a worker: one fetches instructions, the other adds and compares.'
  ]) {
    const v = checkGrounded(answer, chunk);
    assert.ok(v.ok, `grounded answer wrongly refused as an external claim: ${v.reason}`);
  }
});

check('accepts grounded answers that paraphrase rather than quote', () => {
  // Guards MIN_OVERLAP from creeping back up. Two correct answers were lost to paraphrase
  // at 0.40 during calibration, which is why the threshold sits at 0.30. These three
  // score 0.40-0.50 against this fixture and must survive.
  for (const answer of [
    'Think of the control unit as a supervisor telling everyone what to do, while the ALU quietly adds and compares numbers.',
    'The registers sit inside the CPU alongside the buses and hold values during the cycle.',
    'In simple terms the CPU repeats one loop forever: fetch, decode, execute.'
  ]) {
    const v = checkGrounded(answer, chunk);
    assert.ok(v.ok, `paraphrased grounded answer refused: ${v.reason}`);
  }
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
