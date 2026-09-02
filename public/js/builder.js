// Cascade logic for grade -> subject -> strand -> sub-strand, read straight off the
// option tree from /api/options. No DOM rendering and no fetching lives here, so the
// dependency rules stay readable in one place.
//
// The invariant this preserves (from the original public/app.js): every downstream
// select is rebuilt from the tree, so a combination the corpus does not hold cannot
// be assembled by clicking. The sijui gate on the server is the backstop, not this.

export function gradesIn(options) {
  return [...new Set(options.map((o) => o.grade))];
}

export function subjectsIn(options, grade) {
  return [...new Set(options.filter((o) => o.grade === grade).map((o) => o.subject))];
}

function entryIn(options, grade, subject) {
  return options.find((o) => o.grade === grade && o.subject === subject);
}

export function strandsIn(options, grade, subject) {
  const entry = entryIn(options, grade, subject);
  return entry ? entry.strands.map((s) => s.strand) : [];
}

export function subStrandsIn(options, grade, subject, strand) {
  const entry = entryIn(options, grade, subject);
  const match = entry && entry.strands.find((s) => s.strand === strand);
  return match ? match.subStrands : [];
}

// Rebuilds a select from `items`, which may be plain strings or { value, label } pairs.
// Built with DOM nodes rather than innerHTML so a quote or angle bracket in a corpus
// string cannot break the markup. Keeps the current selection when it survives the
// rebuild, so changing Grade does not silently reset a still-valid Sub-strand.
export function fillSelect(select, items) {
  const previous = select.value;
  const pairs = items.map((item) =>
    typeof item === 'string' ? { value: item, label: item } : item
  );

  select.replaceChildren(
    ...pairs.map(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    })
  );

  const survivor = pairs.find((p) => p.value === previous);
  select.value = survivor ? survivor.value : (pairs[0] ? pairs[0].value : '');
  select.disabled = pairs.length === 0;
}
