// Presentation layer for the result region: loading, error, sijui and pack views.
// Every string rendered here comes from the pack payload built by server/packBuilder.js
// (which template-fills from corpus fields) or from fixed labels — nothing is derived,
// summarised or inferred. Section order and wording match the original markup.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function icon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.appendChild(use);
  return svg;
}

function section(heading, ...content) {
  const wrap = el('section', 'pack__section');
  wrap.appendChild(el('h3', 'pack__heading', heading));
  content.forEach((node) => wrap.appendChild(node));
  return wrap;
}

function bulletList(items) {
  const list = el('ul', 'pack__list');
  items.forEach((item) => list.appendChild(el('li', null, item)));
  return list;
}

// --- states ------------------------------------------------------------------

export function renderLoading(container) {
  const card = el('div', 'status status--loading');
  card.appendChild(el('p', 'status__title', 'Preparing your lesson pack…'));
  card.appendChild(
    el('p', 'status__body', 'Assembling the timeline, board notes, activity and questions.')
  );

  const skeleton = el('div', 'skeleton');
  [88, 100, 72, 94, 60].forEach((width) => {
    const bar = el('span', 'skeleton__bar');
    bar.style.width = `${width}%`;
    skeleton.appendChild(bar);
  });
  card.appendChild(skeleton);

  container.replaceChildren(card);
}

export function renderError(container, detail) {
  const card = el('div', 'notice notice--error');
  card.appendChild(icon('alert', 'notice__icon'));

  const body = el('div', 'notice__body');
  body.appendChild(el('p', 'notice__title', 'That did not go through'));
  body.appendChild(
    el(
      'p',
      'notice__text',
      'Nothing was generated, so nothing here is guesswork. Check that the app is still running on this device, then press Generate my lesson pack again.'
    )
  );
  if (detail) body.appendChild(el('p', 'notice__detail', detail));

  card.appendChild(body);
  container.replaceChildren(card);
}

export function renderSijui(container, message) {
  const card = el('div', 'notice notice--sijui');
  card.appendChild(icon('alert', 'notice__icon'));

  const body = el('div', 'notice__body');
  const title = el('p', 'notice__title');
  const word = el('span', null, 'Sijui');
  word.lang = 'sw';
  title.append(word, ' — no pack for this combination');
  body.appendChild(title);
  body.appendChild(el('p', 'notice__text', message));

  card.appendChild(body);
  container.replaceChildren(card);
}

export function renderPack(container, pack) {
  const { meta } = pack;
  const article = el('article', 'pack');
  article.id = 'pack';

  // --- head
  const head = el('header', 'pack__head');

  const badge = el(
    'p',
    meta.verified === 'illustrative' ? 'badge badge--illustrative' : 'badge badge--official'
  );
  badge.appendChild(icon(meta.verified === 'illustrative' ? 'alert' : 'check', 'badge__icon'));
  badge.appendChild(
    el(
      'span',
      null,
      meta.verified === 'illustrative'
        ? 'Illustrative content — verify against official KICD PDF'
        : meta.verified || ''
    )
  );
  head.appendChild(badge);

  const title = el('h2', 'pack__title', pack.title);
  title.id = 'packTitle';
  title.tabIndex = -1;
  head.appendChild(title);

  const chips = el('ul', 'pack__chips');
  [meta.grade, meta.subject, meta.strand, `${meta.lengthMinutes} minutes`]
    .filter(Boolean)
    .forEach((value) => chips.appendChild(el('li', 'chip', value)));
  head.appendChild(chips);

  head.appendChild(el('p', 'pack__citation', `Source: ${meta.citation}`));

  const actions = el('div', 'pack__actions no-print');
  const printButton = el('button', 'btn btn--secondary');
  printButton.type = 'button';
  printButton.id = 'printPack';
  printButton.appendChild(icon('printer', 'btn__icon'));
  printButton.appendChild(el('span', null, 'Print / save this pack'));
  actions.appendChild(printButton);
  head.appendChild(actions);

  article.appendChild(head);

  // --- timeline: the proportional bar is computed from the minutes the server sent,
  // so it shows real data rather than decoration.
  const totalMinutes = pack.timeline.reduce((sum, phase) => sum + phase.minutes, 0) || 1;
  const timeline = el('ol', 'timeline');
  pack.timeline.forEach((phase) => {
    const row = el('li', 'timeline__row');
    const text = el('div', 'timeline__text');
    text.appendChild(el('span', 'timeline__label', phase.label));
    text.appendChild(el('span', 'timeline__mins', `${phase.minutes} min`));
    row.appendChild(text);

    const track = el('span', 'timeline__track');
    const fill = el('span', 'timeline__fill');
    fill.style.width = `${(phase.minutes / totalMinutes) * 100}%`;
    track.appendChild(fill);
    row.appendChild(track);

    timeline.appendChild(row);
  });
  article.appendChild(section('Lesson timeline', timeline));

  article.appendChild(section('What to teach', bulletList(pack.whatToTeach)));
  article.appendChild(section('Board notes', bulletList(pack.boardNotes)));

  const activity = el('p', 'pack__prose', pack.activity.description);
  const materials = el('p', 'pack__materials');
  materials.appendChild(el('span', 'pack__materials-label', 'Materials needed'));
  materials.appendChild(el('span', null, pack.activity.materialsNeeded));
  article.appendChild(section('Activity (no materials needed)', activity, materials));

  const questions = el('ol', 'qlist');
  pack.assessmentQuestions.forEach((entry) => {
    const item = el('li', 'qlist__item');
    item.appendChild(el('p', 'qlist__question', entry.question));
    const scheme = el('p', 'qlist__scheme');
    scheme.appendChild(el('span', 'qlist__scheme-label', 'Marking scheme'));
    scheme.appendChild(el('span', null, entry.markingScheme));
    item.appendChild(scheme);
    questions.appendChild(item);
  });
  article.appendChild(
    section('5 questions to check understanding, with marking scheme', questions)
  );

  article.appendChild(
    section(
      "If you're not confident on this topic yourself",
      el('p', 'pack__prose', pack.ifYoureNotConfident)
    )
  );

  const sourceNote = el('details', 'source-note');
  sourceNote.appendChild(el('summary', 'source-note__summary', 'Source note'));
  sourceNote.appendChild(el('p', 'source-note__body', meta.sourceNote));
  article.appendChild(sourceNote);

  container.replaceChildren(article);
  return article;
}

// Shown when the teacher changes a dropdown after generating: the pack on screen is
// still valid, it just no longer describes the current selection. Saying so beats
// silently leaving a mislabelled plan on screen.
export function markStale(container, note) {
  const article = container.querySelector('.pack');
  if (!article || article.classList.contains('pack--stale')) return;

  article.classList.add('pack--stale');
  const banner = el('p', 'stale-note no-print');
  banner.appendChild(icon('alert', 'stale-note__icon'));
  banner.appendChild(el('span', null, note));
  article.prepend(banner);
}
