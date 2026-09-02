const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadCorpus, getOptions, findChunk } = require('./corpus');
const { buildPack } = require('./packBuilder');
const ai = require('./ai'); // ai-integration branch only; nothing above depends on it

const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const VALID_LENGTHS = [40, 80];

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

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/options') {
    return sendJSON(res, 200, { options: getOptions(chunks), validLengths: VALID_LENGTHS });
  }

  if (req.method === 'POST' && req.url === '/api/pack') {
    const { grade, subject, strand, subStrand, lengthMinutes } = await readBody(req);
    const length = VALID_LENGTHS.includes(lengthMinutes) ? lengthMinutes : 40;

    const chunk = findChunk(chunks, { grade, subject, strand, subStrand });
    if (!chunk) {
      // The sijui gate: no fabricated pack, ever, for a combination we don't have loaded.
      return sendJSON(res, 200, {
        sijui: true,
        message: `Sijui — no loaded curriculum material for ${subject || '?'} / ${strand || '?'} / ${subStrand || '?'} at ${grade || '?'}. Pick a combination from the dropdowns, which only list what is actually loaded.`
      });
    }

    return sendJSON(res, 200, { sijui: false, pack: buildPack(chunk, length) });
  }

  // --- ai-integration branch only: additive, optional, never in the /api/pack path ---
  // Both routes below can be deleted without affecting anything above them. With no
  // model installed, /api/ai-status reports unavailable and the frontend hides the
  // feature entirely, so the guaranteed offline demo path is unchanged.

  if (req.method === 'GET' && req.url === '/api/ai-status') {
    return sendJSON(res, 200, await ai.isAvailable());
  }

  if (req.method === 'POST' && req.url === '/api/ask') {
    const { grade, subject, strand, subStrand, question } = await readBody(req);

    // Same exact-match gate as /api/pack. A question about a sub-strand we do not have
    // is refused before a model is ever asked, not after.
    const chunk = findChunk(chunks, { grade, subject, strand, subStrand });
    if (!chunk) return sendJSON(res, 200, { sijui: true, message: ai.REFUSAL, reason: 'no such sub-strand' });

    return sendJSON(res, 200, await ai.askGrounded(chunk, question));
  }

  return serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Elimu, Mwalimu wa Grade 10 running at http://127.0.0.1:${PORT} (offline, localhost-only)`);
});
