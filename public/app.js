let optionsData = [];
let validLengths = [40, 80];

const gradeSel = document.getElementById('grade');
const subjectSel = document.getElementById('subject');
const strandSel = document.getElementById('strand');
const subStrandSel = document.getElementById('subStrand');
const lengthSel = document.getElementById('length');

const resultSection = document.getElementById('result');
const sijuiBox = document.getElementById('sijuiBox');
const packBox = document.getElementById('packBox');
const verifiedBadge = document.getElementById('verifiedBadge');
const generateBtn = document.getElementById('generate');

function currentEntry() {
  return optionsData.find(o => o.grade === gradeSel.value && o.subject === subjectSel.value);
}

function currentStrand() {
  const entry = currentEntry();
  return entry && entry.strands.find(s => s.strand === strandSel.value);
}

function fillSelect(sel, values) {
  sel.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join('');
}

function refreshSubjects() {
  const grades = [...new Set(optionsData.map(o => o.grade))];
  fillSelect(gradeSel, grades);
  refreshStrandsForSubject();
}

function refreshStrandsForSubject() {
  const subjects = [...new Set(optionsData.filter(o => o.grade === gradeSel.value).map(o => o.subject))];
  fillSelect(subjectSel, subjects);
  refreshStrands();
}

function refreshStrands() {
  const entry = currentEntry();
  fillSelect(strandSel, entry ? entry.strands.map(s => s.strand) : []);
  refreshSubStrands();
}

function refreshSubStrands() {
  const strand = currentStrand();
  fillSelect(subStrandSel, strand ? strand.subStrands : []);
}

gradeSel.addEventListener('change', refreshStrandsForSubject);
subjectSel.addEventListener('change', refreshStrands);
strandSel.addEventListener('change', refreshSubStrands);

function fillList(el, items) {
  el.innerHTML = items.map(i => `<li>${i}</li>`).join('');
}

function renderPack(pack) {
  resultSection.classList.remove('hidden');
  sijuiBox.classList.add('hidden');
  packBox.classList.remove('hidden');

  verifiedBadge.textContent = pack.meta.verified === 'illustrative'
    ? 'illustrative content, verify against official KICD PDF'
    : (pack.meta.verified || '');

  document.getElementById('packTitle').textContent = pack.title;
  document.getElementById('packCitation').textContent = `Source: ${pack.meta.citation}`;

  document.getElementById('packTimeline').innerHTML = pack.timeline
    .map(p => `<li><span>${p.label}</span><span class="t-minutes">${p.minutes} min</span></li>`)
    .join('');

  fillList(document.getElementById('packOutcomes'), pack.whatToTeach);
  fillList(document.getElementById('packBoard'), pack.boardNotes);

  document.getElementById('packActivity').textContent = pack.activity.description;
  document.getElementById('packMaterials').textContent = `Materials needed: ${pack.activity.materialsNeeded}`;

  document.getElementById('packQuestions').innerHTML = pack.assessmentQuestions
    .map(q => `<li>${q.question}<span class="marking-scheme">Marking scheme: ${q.markingScheme}</span></li>`)
    .join('');

  document.getElementById('packExplainer').textContent = pack.ifYoureNotConfident;
  document.getElementById('sourceNote').textContent = pack.meta.sourceNote;

  showAiPanelFor(pack); // ai-integration branch only; no-op when no local model
}

function renderSijui(message) {
  resultSection.classList.remove('hidden');
  packBox.classList.add('hidden');
  sijuiBox.classList.remove('hidden');
  sijuiBox.textContent = message;
  aiPanel.classList.add('hidden'); // nothing to ask about when nothing was loaded
}

document.getElementById('pickerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating…';
  try {
    const res = await fetch('/api/pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grade: gradeSel.value,
        subject: subjectSel.value,
        strand: strandSel.value,
        subStrand: subStrandSel.value,
        lengthMinutes: Number(lengthSel.value)
      })
    });
    const data = await res.json();
    if (data.sijui) renderSijui(data.message);
    else renderPack(data.pack);
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate my lesson pack';
  }
});

document.getElementById('printPack').addEventListener('click', () => window.print());

// --- ai-integration branch only ---------------------------------------------------
// Everything below is inert when no local model is reachable: aiEnabled stays false,
// the panel is never unhidden, and nothing here runs during pack generation.

let aiEnabled = false;

const aiPanel = document.getElementById('aiPanel');
const aiQuestion = document.getElementById('aiQuestion');
const aiAsk = document.getElementById('aiAsk');
const aiStatus = document.getElementById('aiStatus');
const aiAnswer = document.getElementById('aiAnswer');

function showAiPanelFor(pack) {
  aiAnswer.classList.add('hidden');
  aiStatus.classList.add('hidden');
  aiQuestion.value = '';
  aiPanel.dataset.grade = pack.meta.grade;
  aiPanel.dataset.subject = pack.meta.subject;
  aiPanel.dataset.strand = pack.meta.strand;
  aiPanel.dataset.subStrand = pack.meta.subStrand;
  if (aiEnabled) aiPanel.classList.remove('hidden');
}

async function askAi() {
  const question = aiQuestion.value.trim();
  if (!question) return;

  aiAnswer.classList.add('hidden');
  aiStatus.classList.remove('hidden');
  // A local 3B model on CPU runs at roughly 6 tokens/sec, so this is a real wait and
  // the teacher is told so rather than left watching a dead button.
  aiStatus.textContent = 'Thinking locally — this can take up to a minute on a slow machine…';
  aiAsk.disabled = true;

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grade: aiPanel.dataset.grade,
        subject: aiPanel.dataset.subject,
        strand: aiPanel.dataset.strand,
        subStrand: aiPanel.dataset.subStrand,
        question
      })
    });
    const data = await res.json();

    if (data.sijui) {
      aiStatus.textContent = data.message;
    } else {
      aiStatus.textContent = data.warning;
      aiAnswer.textContent = data.answer;
      aiAnswer.classList.remove('hidden');
    }
  } catch (err) {
    // Never fall back to anything that could read as an answer.
    aiStatus.textContent = 'Sijui — the local model could not be reached.';
  } finally {
    aiAsk.disabled = false;
  }
}

aiAsk.addEventListener('click', askAi);
aiQuestion.addEventListener('keydown', (e) => { if (e.key === 'Enter') askAi(); });

(async function initAi() {
  try {
    const res = await fetch('/api/ai-status');
    aiEnabled = (await res.json()).available === true;
  } catch {
    aiEnabled = false;
  }
})();

(async function init() {
  const res = await fetch('/api/options');
  const data = await res.json();
  optionsData = data.options;
  validLengths = data.validLengths;
  lengthSel.innerHTML = validLengths.map(l => `<option value="${l}">${l} minutes</option>`).join('');
  refreshSubjects();
})();
