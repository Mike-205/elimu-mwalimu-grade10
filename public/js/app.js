// Wiring only: reads the option tree once, keeps the five selects in sync through
// builder.js, and hands results to pack-view.js. One form, one action — see the
// "one answer, not the answer" rule in CONTRIBUTING.md.

import { fetchOptions, fetchPack } from './api.js';
import { gradesIn, subjectsIn, strandsIn, subStrandsIn, fillSelect } from './builder.js';
import { renderLoading, renderError, renderSijui, renderPack, markStale } from './pack-view.js';

const form = document.getElementById('builder');
const generateButton = document.getElementById('generate');
const generateLabel = generateButton.querySelector('.btn__label');
const notice = document.getElementById('builderNotice');
const result = document.getElementById('result');

const selects = {
  grade: document.getElementById('grade'),
  subject: document.getElementById('subject'),
  strand: document.getElementById('strand'),
  subStrand: document.getElementById('subStrand'),
  length: document.getElementById('length')
};

const IDLE_LABEL = generateLabel.textContent;
const BUSY_LABEL = 'Preparing your pack…';

let options = [];
let busy = false;
let renderedFor = null;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- selection ---------------------------------------------------------------

function currentSelection() {
  return {
    grade: selects.grade.value,
    subject: selects.subject.value,
    strand: selects.strand.value,
    subStrand: selects.subStrand.value,
    lengthMinutes: Number(selects.length.value)
  };
}

function describe({ subStrand, lengthMinutes }) {
  return `${subStrand} · ${lengthMinutes} minutes`;
}

// --- cascade -----------------------------------------------------------------

function syncSubStrands() {
  fillSelect(
    selects.subStrand,
    subStrandsIn(options, selects.grade.value, selects.subject.value, selects.strand.value)
  );
}

function syncStrands() {
  fillSelect(selects.strand, strandsIn(options, selects.grade.value, selects.subject.value));
  syncSubStrands();
}

function syncSubjects() {
  fillSelect(selects.subject, subjectsIn(options, selects.grade.value));
  syncStrands();
}

function syncGrades() {
  fillSelect(selects.grade, gradesIn(options));
  syncSubjects();
}

// --- states ------------------------------------------------------------------

function setBusy(value) {
  busy = value;
  generateButton.disabled = value;
  generateButton.setAttribute('aria-busy', String(value));
  result.setAttribute('aria-busy', String(value));
  generateLabel.textContent = value ? BUSY_LABEL : IDLE_LABEL;
}

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
}

function hideNotice() {
  notice.hidden = true;
  notice.textContent = '';
}

function noteStaleSelection() {
  if (!renderedFor) return;
  const current = describe(currentSelection());
  if (current === renderedFor) return;
  markStale(result, `Selection changed. This pack is for ${renderedFor} — generate again to update it.`);
}

// --- actions -----------------------------------------------------------------

async function generate() {
  if (busy) return;

  const selection = currentSelection();
  setBusy(true);
  hideNotice();
  renderLoading(result);

  try {
    const data = await fetchPack(selection);

    if (data.sijui) {
      renderedFor = null;
      renderSijui(result, data.message);
      return;
    }

    renderedFor = describe(selection);
    const article = renderPack(result, data.pack);
    const heading = article.querySelector('#packTitle');
    heading.focus({ preventScroll: true });
    article.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  } catch (error) {
    renderedFor = null;
    renderError(result, error && error.message ? error.message : null);
  } finally {
    setBusy(false);
  }
}

// --- events ------------------------------------------------------------------

form.addEventListener('submit', (event) => {
  event.preventDefault();
  generate();
});

selects.grade.addEventListener('change', syncSubjects);
selects.subject.addEventListener('change', syncStrands);
selects.strand.addEventListener('change', syncSubStrands);

Object.values(selects).forEach((select) => {
  select.addEventListener('change', noteStaleSelection);
});

// The print button is rendered with the pack, so listen on the container.
result.addEventListener('click', (event) => {
  if (event.target.closest('#printPack')) window.print();
});

// A closed <details> prints as just its summary, which would drop the source note from
// the carryable pack. Open everything before the print snapshot is taken.
window.addEventListener('beforeprint', () => {
  result.querySelectorAll('details').forEach((node) => {
    node.open = true;
  });
});

// --- init --------------------------------------------------------------------

(async function init() {
  try {
    const data = await fetchOptions();
    options = data.options || [];
    fillSelect(
      selects.length,
      (data.validLengths || [40, 80]).map((minutes) => ({
        value: String(minutes),
        label: `${minutes} minutes`
      }))
    );
    syncGrades();

    if (options.length === 0) {
      generateButton.disabled = true;
      showNotice('No curriculum material is loaded on this device, so there is nothing to build a pack from yet.');
    }
  } catch (error) {
    generateButton.disabled = true;
    Object.values(selects).forEach((select) => {
      select.disabled = true;
    });
    showNotice(
      'Could not load the curriculum list from this device. Check that the app is still running, then reload the page.'
    );
  }
})();
