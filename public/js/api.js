// The only module that knows the shape of the HTTP API. Contracts are fixed by
// server/index.js and must not drift:
//   GET  /api/options -> { options: [{ grade, subject, pathway, strands: [{ strand, subStrands: [] }] }], validLengths: [40, 80] }
//   POST /api/pack    -> { sijui: true, message } | { sijui: false, pack }

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function requestJSON(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} responded with ${res.status}`);
  return res.json();
}

export function fetchOptions() {
  return requestJSON('/api/options');
}

export function fetchPack(selection) {
  return requestJSON('/api/pack', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(selection)
  });
}
