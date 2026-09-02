# Elimu, Mwalimu wa Grade 10

Offline-first lesson-prep assistant for a Kenyan Grade 10 teacher covering a strand outside her training — grounded only in loaded KICD-derived curriculum material, with a hard "sijui" (I don't know) gate instead of guessing.

See `docs/who-this-helps.md` and `docs/ai-bill-2026-risk-sheet.md` for the two required pin-up sheets.

## Run it

No install step, no npm dependencies — pure Node.js built-ins.

```
node server/index.js
```

Then open `http://127.0.0.1:4173` in a browser. Everything runs on localhost; no network calls are made at request time.

## Optional: local generation via Ollama

The app works fully without this — the five structured questions are always answered directly from the curriculum corpus, and free-text questions fall back to showing the closest grounded curriculum material with its citation.

If an Ollama server is running locally (default port 11434) with a pulled model, free-text questions will additionally be answered by that model — strictly constrained to the retrieved curriculum chunk, instructed to say `SIJUI` rather than guess. Set `ELIMU_MODEL` env var to override the default model name (`llama3.2:3b`).

No root access is required. If you don't have Ollama installed system-wide, a user-space install works:

```
mkdir -p ~/.local/ollama
curl -fsSL -o /tmp/ollama.tar.zst \
  "https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst"
tar --zstd -xf /tmp/ollama.tar.zst -C ~/.local/ollama

export OLLAMA_MODELS=~/.local/ollama/models
~/.local/ollama/bin/ollama serve &          # starts the local server on :11434

export PATH="$HOME/.local/ollama/bin:$PATH"
ollama pull llama3.2:3b                     # ~2GB, one-time, needs internet
```

Once pulled, the model runs fully offline — no network access needed at inference time. Everything above only needs to happen once, while internet is available; classroom use afterwards is entirely offline.

## How the "sijui" rule is enforced (not just promised)

1. **Retrieval confidence gate** (`server/retrieval.js`) — a question must score above threshold against loaded curriculum text before anything is generated. Below threshold → refusal, no LLM call at all.
2. **Prompt-level refusal** (`server/ollama.js`) — even when a chunk is retrieved, the model is told to answer only from that chunk and to output `SIJUI` if it can't.
3. **Fallback on refusal or unavailability** (`server/index.js`) — if the model isn't running, times out, or itself says `SIJUI`, the API returns the raw grounded curriculum material with its citation rather than nothing or a hallucination.

## Corpus honesty

Every corpus file (`corpus/**/*.json`) carries a `sourceNote` explaining exactly what's verified fact vs. illustrative gap-fill content, and why (KICD's official curriculum-design downloads are JS-rendered and couldn't be scraped in the build window; one alternate copy of the real Grade 10 Core Mathematics PDF was located but is a scanned image with no extractable text). The app surfaces this in the UI via the "illustrative content" badge on every non-refused answer. Replacing a corpus file with real extracted KICD text requires no code changes.
