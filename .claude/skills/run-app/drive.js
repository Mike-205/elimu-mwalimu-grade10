// Headless-Chrome driver for the Elimu app. Launches Chrome, generates one pack,
// screenshots the initial view / the pack / the print view, and dumps the rendered
// state as JSON.
//
// No dependencies. Node 22's global WebSocket is all Chrome DevTools Protocol needs,
// which is why this exists instead of playwright or chromium-cli — neither is installed
// and the project has no package.json to put them in.
//
//   node .claude/skills/run-app/drive.js
//   node .claude/skills/run-app/drive.js --subject Mathematics --strand "Numbers and Algebra" \
//        --sub "Real Numbers" --length 80 --out /tmp/shots
//
// Assumes the server is already listening; see SKILL.md for the start/wait/stop lines.

const http = require('http');
const fs = require('fs');
const { execFile } = require('child_process');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const APP = arg('app', 'http://127.0.0.1:4173');
const OUT = arg('out', '/tmp/shots');
const CDP_PORT = Number(arg('cdp', 9222));
const PROFILE = arg('profile', '/tmp/chrome-elimu-profile');

const PICK = {
  grade: arg('grade', 'Grade 10'),
  subject: arg('subject', 'Computer Science'),
  strand: arg('strand', 'Foundation of Computer Science'),
  subStrand: arg('sub', 'Central Processing Unit (CPU)'),
  length: arg('length', '40')
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getJSON = (path) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: CDP_PORT, path }, (r) => {
    let d = '';
    r.on('data', (c) => (d += c));
    r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // A stale profile makes Chrome reuse the previous window and ignore --window-size.
  fs.rmSync(PROFILE, { recursive: true, force: true });

  const chrome = execFile('/usr/bin/google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${CDP_PORT}`, '--window-size=1280,1600',
    `--user-data-dir=${PROFILE}`, 'about:blank'
  ]);
  chrome.on('error', (e) => { console.error('chrome failed to launch:', e.message); process.exit(1); });

  // Poll for the debugger. Chrome's startup time varies enough that a fixed sleep is
  // either wasteful or flaky.
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await getJSON('/json/list'); if (targets.length) break; } catch {}
    await sleep(250);
  }
  const page = targets && targets.find((t) => t.type === 'page');
  if (!page) { console.error('no CDP page target after 15s'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails?.text || ''));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      logs.push('console.error: ' + m.params.args.map((a) => a.value).join(' '));
  };
  const send = (method, params = {}) => new Promise((res) => {
    const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
  });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };

  const shot = async (name) => {
    const m = await send('Page.getLayoutMetrics');
    const c = m.result.cssContentSize || m.result.contentSize;
    const { result } = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: c.width, height: Math.min(c.height, 8000), scale: 1 }
    });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(result.data, 'base64'));
    console.log(`  ${OUT}/${name}.png`);
  };

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: APP });
  await sleep(1200);
  console.log('title:', await evaluate('document.title'));
  await shot('01-initial');

  // The selects are populated from /api/options, so set values and fire `change` in
  // cascade order — each one repopulates the next.
  const picked = await evaluate(`(() => {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return id + '=MISSING';
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return id + '=' + (el.value === val ? val : 'NOT-AN-OPTION(' + val + ')');
    };
    return [
      set('grade', ${JSON.stringify(PICK.grade)}),
      set('subject', ${JSON.stringify(PICK.subject)}),
      set('strand', ${JSON.stringify(PICK.strand)}),
      set('subStrand', ${JSON.stringify(PICK.subStrand)}),
      set('length', ${JSON.stringify(PICK.length)})
    ].join(' | ');
  })()`);
  console.log('selected:', picked);
  if (picked.includes('NOT-AN-OPTION') || picked.includes('MISSING')) {
    console.error('selection failed — the pack below is not the one requested');
    process.exitCode = 1;
  }

  await evaluate("document.getElementById('generate').click()");
  await sleep(1500);

  // Report ACTUAL VISIBILITY, not class names. A class that no rule matches looks
  // correct in the DOM and still renders — that is how the AI panel shipped visible
  // while every class-name assertion passed.
  //
  // getClientRects() rather than getComputedStyle: an element inside a display:none
  // parent still reports its own display, so computed style alone says "visible" for
  // things nobody can see. getClientRects() is empty whenever any ancestor hides it.
  const state = await evaluate(`(() => {
    const shown = (id) => {
      const el = document.getElementById(id);
      return el ? el.getClientRects().length > 0 : null;
    };
    const count = (id) => document.getElementById(id)?.children.length ?? null;
    return JSON.stringify({
      packShown: shown('packBox'),
      sijuiShown: shown('sijuiBox'),
      aiPanelShown: shown('aiPanel'),
      title: document.getElementById('packTitle')?.textContent,
      outcomes: count('packOutcomes'),
      boardNotes: count('packBoard'),
      questions: count('packQuestions'),
      timeline: [...(document.getElementById('packTimeline')?.children ?? [])].map(li => li.textContent.trim()),
      badge: document.getElementById('verifiedBadge')?.textContent
    }, null, 1);
  })()`);
  console.log('state:', state);
  await shot('02-pack');

  // What the teacher actually carries. Anything visible here must be corpus-sourced.
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(400);
  const inPrint = await evaluate(`(() => {
    const shown = (el) => (el ? el.getClientRects().length > 0 : null);
    return JSON.stringify({
      pack: shown(document.getElementById('packBox')),
      aiPanel: shown(document.getElementById('aiPanel')),
      picker: shown(document.getElementById('pickerForm')),
      disclosure: shown(document.querySelector('.disclosure')),
      masthead: shown(document.querySelector('.masthead')),
      printButton: shown(document.getElementById('printPack'))
    });
  })()`);
  console.log('visible in print:', inPrint);
  await shot('03-print');
  await send('Emulation.setEmulatedMedia', { media: '' });

  console.log('page errors:', logs.length ? logs : 'none');
  if (logs.length) process.exitCode = 1;

  ws.close();
  chrome.kill();
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
