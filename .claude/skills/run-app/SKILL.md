---
name: run-app
description: Run the Elimu lesson-pack app and screenshot it. Use when asked to run, start, launch, or screenshot the app, to see a frontend change rendered, or to confirm something works in the real UI rather than only through the API. Covers the server start/stop lines, a headless-Chrome driver that generates a pack and captures the initial, pack and print views, and the app-specific gotchas that make DOM assertions lie.
---

# Running and screenshotting the app

No install step, no `package.json`, no dependencies. Node built-ins only.

## Start, wait, stop

```bash
# stop anything already on the port first, or the next run hits EADDRINUSE
lsof -ti:4173 -sTCP:LISTEN | xargs -r kill

node server/index.js > /tmp/srv.log 2>&1 &

# poll, do not sleep
timeout 30 bash -c 'until node -e "require(\"http\").get({host:\"127.0.0.1\",port:4173,path:\"/\"},r=>process.exit(0)).on(\"error\",()=>process.exit(1))" 2>/dev/null; do sleep 0.5; done'
```

Add `AI_ENABLED=1` to test the optional local-model panel: `AI_ENABLED=1 node server/index.js`.
Without it the panel must not render at all — see the gotcha below.

Stop with the same `lsof … | xargs -r kill`. Do not `pkill -f node` — it can match the
agent's own process.

## Drive it

```bash
node .claude/skills/run-app/drive.js
```

Defaults to Grade 10 / Computer Science / Foundation of Computer Science / Central
Processing Unit (CPU) / 40 minutes. Override any of them:

```bash
node .claude/skills/run-app/drive.js \
  --subject Mathematics --strand "Numbers and Algebra" --sub "Real Numbers" --length 80 \
  --out /tmp/shots
```

Writes three PNGs to `--out` (default `/tmp/shots`) and prints the rendered state:

| File | What it proves |
|---|---|
| `01-initial.png` | One form, one button. The single-action shape the brief requires |
| `02-pack.png` | A full pack: timeline, outcomes, board notes, activity, 5 marked questions, explainer |
| `03-print.png` | What the teacher carries. Picker, banner and AI panel must all be gone |

Exits non-zero if a requested option was not selectable or the page logged an error.

**Then look at the screenshots.** The driver reports computed styles, but a rendered
page is the only thing that catches layout that is present, styled, and wrong.

## Why a hand-rolled CDP driver

There is no `chromium-cli` and no Playwright on this machine, and the project has no
`package.json` to install one into. `/usr/bin/google-chrome` plus Node 22's global
`WebSocket` speaks Chrome DevTools Protocol directly with no dependency — which also
keeps the repo's "no dependencies" property intact. If Playwright ever gets added for
another reason, this can be deleted in favour of it.

## Gotchas that actually bit

**`.hidden` is not a generic utility class.** `public/style.css` only defines it per
component — `.result.hidden`, `.pack.hidden`, `.sijui-box.hidden`. Adding
`class="hidden"` to a new element does nothing: the element renders, and every
class-name assertion still passes. This shipped the AI panel visible in builds where the
feature was switched off. Any new element that needs hiding needs its own rule.

**Assert visibility, never class names — and not computed style either.**
`el.classList.contains('hidden')` only tells you the string is in the attribute. But
`getComputedStyle(el).display` is also a trap: an element inside a `display:none` parent
still reports its own `display`, so it reads as visible when nobody can see it. That
produced a wrong `picker: true` in the print check here. Use
`el.getClientRects().length > 0`, which is empty whenever any ancestor hides it. The
driver uses that throughout.

**Capture the print view with `AI_ENABLED=1`.** Verifying that the panel is absent from
print while the panel is also switched off proves nothing. The driver emulates print
media and reports what is still visible; run it with the flag on at least once.

**Dropdowns cascade.** `subject`, `strand` and `subStrand` are repopulated from
`/api/options` by each preceding `change` event, so they must be set in order. The driver
reports `NOT-AN-OPTION(...)` rather than silently screenshotting the wrong pack.

**Delete the Chrome profile between runs.** A stale `--user-data-dir` makes Chrome reuse
the previous window and quietly ignore `--window-size`. The driver removes it on start.

## Checking without a browser

For corpus or API work a browser is overkill. These need no Chrome:

```bash
node server/ai.test.js                                       # AI refusal layer, no model needed
node corpus/_source/verify-outcomes.js corpus/_source/*.txt  # every quoted outcome traces to the KICD design
```
