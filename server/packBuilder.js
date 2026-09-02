// Assembles ONE lesson pack from a corpus chunk — deliberately deterministic
// template-filling, not generation. There is no model in this path: every
// field in the output traces directly back to a corpus field, so there is
// nothing here that could hallucinate. "One answer, not the answer."

const PHASES = [
  { key: 'introduction', label: 'Introduction / hook', share: 0.10 },
  { key: 'instruction', label: 'Direct instruction (what to teach + board notes)', share: 0.40 },
  { key: 'activity', label: 'Activity (no materials needed)', share: 0.35 },
  { key: 'assessment', label: 'Check for understanding', share: 0.15 }
];

function buildTimeline(lengthMinutes) {
  const raw = PHASES.map(p => ({ ...p, minutes: Math.round(lengthMinutes * p.share) }));
  const used = raw.reduce((sum, p) => sum + p.minutes, 0);
  raw[raw.length - 1].minutes += lengthMinutes - used; // absorb rounding into the last phase
  return raw;
}

function buildPack(chunk, lengthMinutes) {
  const timeline = buildTimeline(lengthMinutes);

  return {
    meta: {
      grade: chunk.grade,
      subject: chunk.subject,
      strand: chunk.strand,
      subStrand: chunk.subStrand,
      lengthMinutes,
      citation: chunk.citation,
      verified: chunk.verified,
      sourceNote: chunk.sourceNote
    },
    title: `${chunk.subStrand} — ${lengthMinutes}-minute lesson pack`,
    timeline: timeline.map(p => ({ label: p.label, minutes: p.minutes })),
    whatToTeach: chunk.learningOutcomes,
    boardNotes: chunk.boardNotes,
    activity: chunk.activity,
    assessmentQuestions: chunk.assessmentQuestions,
    ifYoureNotConfident: chunk.explainer
  };
}

module.exports = { buildPack };
