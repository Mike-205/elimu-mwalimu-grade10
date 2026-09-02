// Optional local-model panel. Everything here is inert unless the server reports
// AI_ENABLED=1 and a model is reachable — see server/ai.js and the amendment note in
// CONTRIBUTING.md for why it is switched off by default.
//
// Two things this module must never do, both load-bearing for the project's promises:
//   1. Put model output inside the pack. The panel is a sibling of <article id="pack">,
//      never a child, and carries `no-print`, so the page the teacher carries stays
//      entirely corpus-sourced.
//   2. Show anything that could read as an answer when the server refused. A refusal
//      renders as a status line and the answer element stays empty and removed.

const WARNING = 'Not KICD text';

let statusPromise = null;

/** Asked once per page load. Resolves false on any failure — fail closed. */
function aiStatus() {
  if (!statusPromise) {
    statusPromise = fetch('/api/ai-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => Boolean(d && d.available))
      .catch(() => false);
  }
  return statusPromise;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/**
 * Appends the panel to `container`, after whatever the pack renderer put there.
 * Resolves to the panel element, or null when the feature is off — callers can ignore
 * the result entirely.
 */
export async function mountAiPanel(container, selection) {
  container.querySelectorAll('.ai-panel').forEach((node) => node.remove());
  if (!(await aiStatus())) return null;

  const panel = el('aside', 'ai-panel no-print');
  panel.id = 'aiPanel';

  const head = el('div', 'ai-panel__head');
  head.appendChild(el('h2', 'ai-panel__title', 'Ask about this sub-strand'));
  head.appendChild(el('span', 'ai-panel__flag', WARNING));
  panel.appendChild(head);

  panel.appendChild(
    el(
      'p',
      'ai-panel__note',
      "Answered by a local AI model using only this sub-strand's loaded material. It " +
        'refuses rather than guessing, but check anything it says before you teach it. ' +
        'This section is never printed.'
    )
  );

  const row = el('div', 'ai-panel__row');
  const input = el('input', 'ai-panel__input');
  input.type = 'text';
  input.maxLength = 300;
  input.id = 'aiQuestion';
  input.placeholder = 'e.g. what does the control unit actually do?';
  input.setAttribute('aria-label', 'Ask a question about this sub-strand');

  const button = el('button', 'ai-panel__ask', 'Ask');
  button.type = 'button';
  button.id = 'aiAsk';

  row.append(input, button);
  panel.appendChild(row);

  const status = el('p', 'ai-panel__status');
  status.id = 'aiStatus';
  status.hidden = true;
  status.setAttribute('role', 'status');
  panel.appendChild(status);

  const answer = el('blockquote', 'ai-panel__answer');
  answer.id = 'aiAnswer';
  answer.hidden = true;
  panel.appendChild(answer);

  const say = (message) => {
    status.textContent = message;
    status.hidden = false;
  };

  async function ask() {
    const question = input.value.trim();
    if (!question) return;

    answer.hidden = true;
    answer.textContent = '';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    // A 3B model on CPU runs at roughly 6 tokens/sec, so this is a real wait. Say so
    // rather than leaving a dead button.
    say('Thinking locally — this can take up to a minute on a slow machine…');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selection, question })
      });
      const data = await res.json();

      if (data.sijui) {
        say(data.message);
      } else {
        say(data.warning);
        answer.textContent = data.answer;
        answer.hidden = false;
      }
    } catch {
      // Never fall back to anything a teacher could read as an answer.
      say('Sijui — the local model could not be reached.');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  button.addEventListener('click', ask);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      ask();
    }
  });

  container.appendChild(panel);
  return panel;
}
