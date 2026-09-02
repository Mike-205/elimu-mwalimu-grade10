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
}

function renderSijui(message) {
  resultSection.classList.remove('hidden');
  packBox.classList.add('hidden');
  sijuiBox.classList.remove('hidden');
  sijuiBox.textContent = message;
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

(async function init() {
  const res = await fetch('/api/options');
  const data = await res.json();
  optionsData = data.options;
  validLengths = data.validLengths;
  lengthSel.innerHTML = validLengths.map(l => `<option value="${l}">${l} minutes</option>`).join('');
  refreshSubjects();
})();
