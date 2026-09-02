let optionsData = [];

const gradeSel = document.getElementById('grade');
const subjectSel = document.getElementById('subject');
const strandSel = document.getElementById('strand');
const subStrandSel = document.getElementById('subStrand');
const resultSection = document.getElementById('result');
const resultLabel = document.getElementById('resultLabel');
const resultValue = document.getElementById('resultValue');
const resultCitation = document.getElementById('resultCitation');
const verifiedBadge = document.getElementById('verifiedBadge');
const sourceNoteEl = document.getElementById('sourceNote');

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

function renderResult(data) {
  resultSection.classList.remove('hidden');
  if (data.sijui) {
    verifiedBadge.className = 'badge sijui';
    verifiedBadge.textContent = 'sijui — I don\'t know';
    resultLabel.textContent = '';
    resultValue.textContent = data.message;
    resultCitation.textContent = '';
    sourceNoteEl.textContent = '';
    return;
  }

  verifiedBadge.className = 'badge illustrative';
  verifiedBadge.textContent = data.verified === 'illustrative'
    ? 'illustrative content — verify against official KICD PDF'
    : (data.verified || '');

  resultLabel.textContent = data.label;

  if (Array.isArray(data.value)) {
    resultValue.innerHTML = `<ul class="plain">${data.value.map(v => `<li>${v}</li>`).join('')}</ul>`;
  } else if (typeof data.value === 'object' && data.value !== null) {
    resultValue.innerHTML = Object.entries(data.value)
      .map(([k, v]) => `<p><strong>${k}:</strong> ${Array.isArray(v) ? v.join('; ') : v}</p>`)
      .join('');
  } else {
    resultValue.innerHTML = `<p>${data.value}</p>`;
  }

  resultCitation.textContent = data.citation ? `Source: ${data.citation}` : '';
  sourceNoteEl.textContent = data.sourceNote || '';
}

async function lookup(mode) {
  const res = await fetch('/api/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grade: gradeSel.value,
      subject: subjectSel.value,
      strand: strandSel.value,
      subStrand: subStrandSel.value,
      mode
    })
  });
  renderResult(await res.json());
}

document.querySelectorAll('.questions button').forEach(btn => {
  btn.addEventListener('click', () => lookup(btn.dataset.mode));
});

document.getElementById('askFree').addEventListener('click', async () => {
  const question = document.getElementById('freeQuestion').value;
  if (!question.trim()) return;
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grade: gradeSel.value, subject: subjectSel.value, question })
  });
  renderResult(await res.json());
});

(async function init() {
  const res = await fetch('/api/options');
  const data = await res.json();
  optionsData = data.options;
  refreshSubjects();
})();
