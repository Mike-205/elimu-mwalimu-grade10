const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadCorpus, getOptions } = require('./corpus');
const { retrieve } = require('./retrieval');
const ollama = require('./ollama');

const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const chunks = loadCorpus();
console.log(`Loaded ${chunks.length} curriculum sub-strand chunks.`);

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, filePath.split('?')[0]);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
  });
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function sijuiResponse(reason) {
  return {
    sijui: true,
    message: `Sijui — this isn't in the KICD-derived curriculum material loaded for this grade/subject/strand. (${reason})`,
    citation: null
  };
}

function findExactChunk({ grade, subject, strand, subStrand }) {
  return chunks.find(c => c.grade === grade && c.subject === subject && c.strand === strand && c.subStrand === subStrand);
}

const MODE_FIELD = {
  teach: (c) => ({ label: 'What you are meant to teach', value: c.learningOutcomes }),
  board: (c) => ({ label: 'What to write on the board', value: c.boardNotes }),
  activity: (c) => ({ label: 'Suggested activity', value: c.suggestedActivity }),
  assess: (c) => ({ label: 'How to assess understanding', value: c.assessmentRubric }),
  explain: (c) => ({ label: 'Explain this to me', value: c.explainer })
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/options') {
    return sendJSON(res, 200, { options: getOptions(chunks) });
  }

  if (req.method === 'POST' && req.url === '/api/lookup') {
    const { grade, subject, strand, subStrand, mode } = await readBody(req);
    const chunk = findExactChunk({ grade, subject, strand, subStrand });
    if (!chunk) return sendJSON(res, 200, sijuiResponse('no matching sub-strand loaded'));
    const fieldFn = MODE_FIELD[mode];
    if (!fieldFn) return sendJSON(res, 400, { error: 'unknown mode' });
    const { label, value } = fieldFn(chunk);
    return sendJSON(res, 200, {
      sijui: false,
      label,
      value,
      citation: chunk.citation,
      verified: chunk.verified,
      sourceNote: chunk.sourceNote
    });
  }

  if (req.method === 'POST' && req.url === '/api/ask') {
    const { grade, subject, question } = await readBody(req);
    if (!question || !question.trim()) return sendJSON(res, 400, { error: 'question required' });

    const result = retrieve(chunks, question, { grade, subject });
    if (!result.found) {
      return sendJSON(res, 200, sijuiResponse('no sub-strand scored above the confidence threshold for this question'));
    }

    const chunk = result.chunk;
    const available = await ollama.isAvailable();

    if (available) {
      const generated = await ollama.generate(question, chunk);
      if (generated && !/^sijui/i.test(generated)) {
        return sendJSON(res, 200, {
          sijui: false,
          label: 'Answer',
          value: generated,
          mode: 'generated',
          citation: chunk.citation,
          verified: chunk.verified,
          sourceNote: chunk.sourceNote
        });
      }
    }

    // Fallback: model unavailable, timed out, or itself declined (SIJUI) —
    // degrade to the raw grounded material rather than hallucinate.
    return sendJSON(res, 200, {
      sijui: false,
      label: `Closest curriculum material (${chunk.subStrand})`,
      value: { explainer: chunk.explainer, boardNotes: chunk.boardNotes },
      mode: 'retrieval-only',
      citation: chunk.citation,
      verified: chunk.verified,
      sourceNote: chunk.sourceNote
    });
  }

  return serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Elimu, Mwalimu wa Grade 10 running at http://127.0.0.1:${PORT} (offline, localhost-only)`);
});
