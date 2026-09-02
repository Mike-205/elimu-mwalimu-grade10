const fs = require('fs');
const path = require('path');

const CORPUS_ROOT = path.join(__dirname, '..', 'corpus');

function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else if (entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

function loadCorpus() {
  const chunks = [];
  for (const file of walk(CORPUS_ROOT)) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const sub of doc.subStrands) {
      const searchText = [
        doc.grade, doc.subject, doc.strand, sub.subStrand,
        ...(sub.learningOutcomes || []),
        ...(sub.boardNotes || []),
        sub.suggestedActivity || '',
        sub.explainer || ''
      ].join(' ').toLowerCase();

      chunks.push({
        id: sub.id,
        grade: doc.grade,
        subject: doc.subject,
        pathway: doc.pathway,
        strand: doc.strand,
        subStrand: sub.subStrand,
        citation: sub.citation,
        verified: sub.verified,
        sourceNote: doc.sourceNote,
        learningOutcomes: sub.learningOutcomes || [],
        boardNotes: sub.boardNotes || [],
        suggestedActivity: sub.suggestedActivity || '',
        assessmentRubric: sub.assessmentRubric || {},
        explainer: sub.explainer || '',
        searchText
      });
    }
  }
  return chunks;
}

function getOptions(chunks) {
  const map = new Map();
  for (const c of chunks) {
    const key = `${c.grade}|||${c.subject}`;
    if (!map.has(key)) map.set(key, { grade: c.grade, subject: c.subject, pathway: c.pathway, strands: new Map() });
    const entry = map.get(key);
    if (!entry.strands.has(c.strand)) entry.strands.set(c.strand, new Set());
    entry.strands.get(c.strand).add(c.subStrand);
  }
  return Array.from(map.values()).map(e => ({
    grade: e.grade,
    subject: e.subject,
    pathway: e.pathway,
    strands: Array.from(e.strands.entries()).map(([strand, subStrands]) => ({
      strand,
      subStrands: Array.from(subStrands)
    }))
  }));
}

module.exports = { loadCorpus, getOptions };
