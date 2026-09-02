const http = require('http');

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;
const MODEL = process.env.ELIMU_MODEL || 'llama3.2:3b';
const TIMEOUT_MS = 12000;

// Strict grounding: the model is only ever shown the retrieved chunk, never
// asked to use outside knowledge, and is instructed to refuse rather than
// guess. This is the sijui rule enforced in the prompt, on top of the
// retrieval confidence gate that runs before this is ever called.
function buildPrompt(question, chunk) {
  const context = [
    `Grade: ${chunk.grade}`,
    `Subject: ${chunk.subject}`,
    `Strand: ${chunk.strand}`,
    `Sub-strand: ${chunk.subStrand}`,
    `Learning outcomes: ${chunk.learningOutcomes.join('; ')}`,
    `Board notes: ${chunk.boardNotes.join('; ')}`,
    `Suggested activity: ${chunk.suggestedActivity}`,
    `Explainer: ${chunk.explainer}`
  ].join('\n');

  return `You are a teaching assistant for a Kenyan Grade 10 teacher. Answer ONLY using the CURRICULUM CONTEXT below. Do not use any other knowledge. Keep the answer short and classroom-practical. If the CURRICULUM CONTEXT does not actually contain enough to answer the TEACHER QUESTION, respond with exactly: SIJUI

CURRICULUM CONTEXT:
${context}

TEACHER QUESTION:
${question}

ANSWER (grounded only in the context above, or SIJUI):`;
}

function isAvailable() {
  return new Promise((resolve) => {
    const req = http.get({ host: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/tags', timeout: 1500 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function generate(question, chunk) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: MODEL,
      prompt: buildPrompt(question, chunk),
      stream: false,
      options: { temperature: 0.1 }
    });

    const req = http.request({
      host: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: TIMEOUT_MS
    }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve((parsed.response || '').trim());
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

module.exports = { isAvailable, generate, MODEL };
