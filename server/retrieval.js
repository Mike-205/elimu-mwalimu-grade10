// Deliberately no embeddings, no external services: keyword overlap only.
// This is the sijui gate — if nothing scores above CONFIDENCE_THRESHOLD,
// the caller must say "I don't know" instead of generating anything.

const CONFIDENCE_THRESHOLD = 0.12;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'and', 'for', 'on', 'what',
  'do', 'i', 'my', 'this', 'that', 'how', 'what\'s', 'me', 'should', 'can',
  'about', 'with', 'it', 'be', 'as', 'at', 'by'
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t));
}

function scoreChunk(queryTokens, chunk) {
  if (queryTokens.length === 0) return 0;
  const chunkTokens = new Set(tokenize(chunk.searchText));
  let hits = 0;
  for (const t of queryTokens) if (chunkTokens.has(t)) hits++;
  return hits / queryTokens.length;
}

// filters: { grade, subject, strand, subStrand } — narrows candidates before scoring
function retrieve(chunks, queryText, filters = {}) {
  const queryTokens = tokenize(queryText);
  let candidates = chunks;
  if (filters.grade) candidates = candidates.filter(c => c.grade === filters.grade);
  if (filters.subject) candidates = candidates.filter(c => c.subject === filters.subject);
  if (filters.strand) candidates = candidates.filter(c => c.strand === filters.strand);
  if (filters.subStrand) candidates = candidates.filter(c => c.subStrand === filters.subStrand);

  const scored = candidates
    .map(c => ({ chunk: c, score: scoreChunk(queryTokens, c) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < CONFIDENCE_THRESHOLD) {
    return { found: false, chunk: null, score: best ? best.score : 0 };
  }
  return { found: true, chunk: best.chunk, score: best.score };
}

module.exports = { retrieve, tokenize, CONFIDENCE_THRESHOLD };
