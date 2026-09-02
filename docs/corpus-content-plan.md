# `corpus-content` — build plan

Owner: Ronald-Wesh. Branch: `corpus-content`. Read `CONTRIBUTING.md` first — the two
unbendable rules and the sub-strand schema live there and are not restated here.

## Where we are

| | |
|---|---|
| Subjects loaded | 2 (Computer Science, Core Mathematics) |
| Strand files | 2 |
| Sub-strands | 4 |
| Combinations that generate a pack | 4 |
| Combinations that return `sijui` | everything else in Grade 10 |

The demo currently covers about a week of Jane's teaching. `docs/project-overview.md`
stakes the whole pitch on Jane carrying Computer Science *and* Core Mathematics — so the
target is that a teacher can pick any strand from either of her two subjects and get a
pack, never a refusal.

## Scope decision (locked)

**Depth, not breadth.** Complete the two subjects Jane already teaches — Computer Science
and Mathematics. No new subjects until both are whole.

**Hybrid grounding.** `learningOutcomes` are copied **verbatim** from the sub-strand's
"Specific Learning Outcomes" list in the official KICD design. Everything else —
`boardNotes`, `activity`, the five `assessmentQuestions`, `explainer` — is teacher-authored
illustrative content, because the design says *what* a learner must be able to do, not
what to write on a board or how to mark it. That split is the honest one and it is
stronger than either extreme: what KICD requires is real and checkable; how to teach it is
ours and labelled as ours.

Source text lives in `corpus/_source/` so a reviewer can check any quoted outcome offline.

### How the split is expressed without touching code

`server/corpus.js` passes exactly these fields through: `id`, `grade`, `subject`,
`pathway`, `strand`, `subStrand`, `citation`, `verified`, `sourceNote`, `learningOutcomes`,
`boardNotes`, `activity`, `assessmentQuestions`, `explainer`. A new field like
`outcomesSource` would be silently dropped, so **do not add one** — the provenance goes in
`citation` and `verified`, both of which already reach the pack.

`public/app.js` renders `meta.verified` as the badge text, falling through to the raw
string for any value other than `"illustrative"`. So `verified` is written as a short
human sentence, not a machine token:

```json
"verified": "learning outcomes verbatim from the KICD design; teaching content illustrative",
"citation": "KICD Grade 10 Mathematics Curriculum Design — Strand 1.0 Numbers and Algebra — Sub Strand 1.1 Real Numbers. Learning outcomes quoted verbatim; board notes, activity, questions and explainer are illustrative."
```

Renders correctly today with zero code change. One caveat for `ui-polish`: `app.js` sets
`verifiedBadge.className = 'badge illustrative'` unconditionally, so the badge keeps the
illustrative styling regardless of value. That errs conservative, so it is not a
correctness problem — but it does mean the badge colour is currently decorative, not
informative, and it should be driven off `verified` once more than one value exists.

## Definition of done — one sub-strand

Every line below must be true before committing. Nothing is "mostly done".

- [ ] `id` is unique across the whole corpus (`grep -rho '"id": "[^"]*"' corpus/ | sort | uniq -d` returns nothing)
- [ ] `strand` and `subStrand` match the strand map below **character for character**, including the design's own odd capitalisation (`Computer storage`, `Program development`)
- [ ] `learningOutcomes` are the sub-strand's Specific Learning Outcomes, **verbatim** — a) b) c) letters stripped, wording untouched
- [ ] the whole sub-strand block was read in `corpus/_source/` before quoting, not just consecutive lines (see the column-interleaving gotcha in that directory's README)
- [ ] `citation` names the design, strand number and sub-strand number, and states which fields are verbatim vs illustrative
- [ ] `verified` is the human sentence above, matching the other files exactly
- [ ] 4–7 `boardNotes` — literally what goes on the blackboard, formulas and syntax included, not prose about the topic
- [ ] `boardNotes` actually serve the quoted outcomes; if an outcome has no board support, the notes are incomplete
- [ ] **exactly one** `activity`, achievable with paper/board/exercise books and nothing else
- [ ] `activity.materialsNeeded` begins `"None — "` and says what is used instead (voice, board, exercise book)
- [ ] **exactly five** `assessmentQuestions`, each with a `markingScheme` naming marks and what earns them
- [ ] marking schemes award partial credit where a method mark is plausible — a teacher must be able to mark with it, not just check answers
- [ ] `explainer` is written for a teacher who has never taught the topic, plain language, no jargon left undefined
- [ ] the pack renders end to end in the browser with every section populated

Size reference: budget ~2,000 characters per sub-strand. Do not pad.

## Strand map — verbatim from the official KICD designs

**M0 finding: both official PDFs turned out to have extractable text layers.** Earlier
notes in `README.md` and `docs/project-overview.md` say the KICD designs could not be
retrieved as machine-readable text. That is no longer true for these two subjects:

| Subject | Source PDF | Pages | Extracted |
|---|---|---|---|
| Computer Science | `freeexams.co.ke/wp-content/uploads/2024/11/Computer-Science-Grade-10-Curriculum-Designs.pdf` | 68 | 71,539 chars via `pdftotext` |
| Mathematics | `freeexams.co.ke/wp-content/uploads/2024/11/Mathematics-Grade-10-Curriculum-Designs.pdf` | 65 | 78,038 chars via `pdftotext` |

Both carry the KICD masthead and the standard design layout (Essence Statement, Summary
of Strands and Sub Strands, then per-sub-strand Specific Learning Outcomes / Suggested
Learning Experiences / Key Inquiry Questions). No OCR needed — `pdftotext` alone,
already installed at `/usr/bin/pdftotext`.

Reproduce:

```bash
curl -sL -o /tmp/cs-g10.pdf   "https://freeexams.co.ke/wp-content/uploads/2024/11/Computer-Science-Grade-10-Curriculum-Designs.pdf"
curl -sL -o /tmp/math-g10.pdf "https://freeexams.co.ke/wp-content/uploads/2024/11/Mathematics-Grade-10-Curriculum-Designs.pdf"
pdftotext /tmp/cs-g10.pdf   /tmp/cs-g10.txt
pdftotext /tmp/math-g10.pdf /tmp/math-g10.txt
sed -n '218,266p' /tmp/cs-g10.txt    # strand summary
sed -n '270,300p' /tmp/math-g10.txt  # strand summary
```

Sub-strand names below are copied from each PDF's "Summary of Strands and Sub Strands"
page, including its own capitalisation inconsistencies. **Use these strings exactly.**

### Computer Science — 3 strands, 17 sub-strands, 180 lessons

| # | Strand | Sub-strand | Lessons |
|---|---|---|---|
| 1.1 | Foundation of Computer Science | Evolution of Computers | 6 |
| 1.2 | Foundation of Computer Science | Computer Architecture | 4 |
| 1.3 | Foundation of Computer Science | Input/Output (I/O) Devices | 12 |
| 1.4 | Foundation of Computer Science | Computer storage | 6 |
| 1.5 | Foundation of Computer Science | Central Processing Unit (CPU) | 6 |
| 1.6 | Foundation of Computer Science | Operating System (OS) | 12 |
| 1.7 | Foundation of Computer Science | Computer setup | 10 |
| 2.1 | Computer Networking | Data communication | 6 |
| 2.2 | Computer Networking | Data Transmission Media | 8 |
| 2.3 | Computer Networking | Computer Network Elements | 10 |
| 2.4 | Computer Networking | Network Topologies | 8 |
| 3.1 | Software Development | Computer Programming Concepts | 14 |
| 3.2 | Software Development | Program development | 15 |
| 3.3 | Software Development | Identifiers and Operators | 18 |
| 3.4 | Software Development | Control Structures | 17 |
| 3.5 | Software Development | Containers | 14 |
| 3.6 | Software Development | Functions | 14 |

Note the strand is **"Foundation of Computer Science"**, singular — the corpus currently
says "Foundations".

### Mathematics — 3 strands, 14 sub-strands, 180 lessons

| # | Strand | Sub-strand |
|---|---|---|
| 1.1 | Numbers and Algebra | Real Numbers |
| 1.2 | Numbers and Algebra | Indices and Logarithms |
| 1.3 | Numbers and Algebra | Quadratic Expressions and Equations 1 |
| 2.1 | Measurements and Geometry | Similarity and Enlargement |
| 2.2 | Measurements and Geometry | Reflection and Congruence |
| 2.3 | Measurements and Geometry | Rotation |
| 2.4 | Measurements and Geometry | Trigonometry 1 |
| 2.5 | Measurements and Geometry | Area of Polygons |
| 2.6 | Measurements and Geometry | Area of a Part of a Circle |
| 2.7 | Measurements and Geometry | Surface Area and Volume of Solids |
| 2.8 | Measurements and Geometry | Vectors I |
| 2.9 | Measurements and Geometry | Linear Motion |
| 3.1 | Statistics and Probability | Statistics I |
| 3.2 | Statistics and Probability | Probability 1 |

The subject is titled **"Mathematics"** in the design, not "Core Mathematics".

#### The index page and the body disagree — the body wins

The design's "Summary of Strands and Sub Strands" page lists **2.4 Angle Properties of a
Circle** and does not mention vectors. The body of the design has no Angle Properties
section at all, and instead carries a full **Sub Strand 8: Vectors I** with its own
learning outcomes, learning experiences and assessment rubric. Both lists are nine
sub-strands long, so this is a substitution, not an omission.

```bash
grep -ci "angle properties" corpus/_source/mathematics-grade10-kicd.txt   # 1 — the index page only
grep -ci "vectors"          corpus/_source/mathematics-grade10-kicd.txt   # 46 — a full section
```

The table above follows the body and renumbers 2.4 to 2.9 accordingly. Rationale: only
the body carries learning outcomes, and an outcome is the one field this corpus quotes
verbatim — a sub-strand that exists only as a line on a contents page has nothing to
quote. Teaching Angle Properties of a Circle from this design is not possible; teaching
Vectors I is.

**The rule this sets, for the rest of the branch:** the index page wins on *spelling and
capitalisation* (it is the tidier of the two), the body wins on *what exists*. Where they
differ, say so in the file's `sourceNote` rather than silently picking one.

**Target: 31 sub-strands total.**

### What this breaks in the existing corpus

All four existing sub-strands are off-curriculum and cannot be kept as they are.

| Existing | Problem | Resolution |
|---|---|---|
| `math-seq-arithmetic` | *Sequences and Series* appears **zero times** in the Grade 10 Mathematics design (`grep -ci "sequence\|series"` → 0). Not a strand, not a sub-strand. | Retire. The strand file goes away. |
| `math-seq-geometric` | same | Retire. |
| `cs-data-representation` | *Data Representation* appears **zero times** in the Computer Science design. | Retire; nearest real sub-strands are 1.2 Computer Architecture and 1.4 Computer storage. |
| `cs-hardware-components` | "Computer Hardware and Components" is not a sub-strand name. | Rewrite as 1.3 Input/Output (I/O) Devices, keeping the reusable content. |

Retiring beats renaming here: the entries were written against invented topics, so the
board notes and questions do not match any real sub-strand's learning outcomes. Rewrite
them from the PDF rather than relabelling them.

## Milestones

Each milestone is one strand, one file, one commit. Each has a check you can run.

### M0 — Strand map confirmed ✅ done

Both official KICD PDFs located with extractable text; strand and sub-strand names above
are verbatim from them. Sequences and Series confirmed off-curriculum. Target count
revised from ~30 to **31**.

### M1 — Retire the off-curriculum entries ✅ done

Delete `corpus/grade-10/core-mathematics/sequences-and-series.json`. Rename the directory
`core-mathematics/` → `mathematics/` and the subject string to `"Mathematics"`. Reduce
`foundations-of-computer-science.json` to `foundation-of-computer-science.json` with the
strand string `"Foundation of Computer Science"`, keeping only content that maps onto a
real sub-strand.

**Done when:** the corpus loads with no invented strand names, and `/api/options` lists
only sub-strands that appear in the PDFs. Sub-strand count will *drop* — that is correct.

### M2 — Foundation of Computer Science (7 sub-strands) ✅ done

1.1 Evolution of Computers · 1.2 Computer Architecture · 1.3 Input/Output (I/O) Devices ·
1.4 Computer storage · 1.5 Central Processing Unit (CPU) · 1.6 Operating System (OS) ·
1.7 Computer setup

**Done when:** 7 sub-strands generate full packs at both 40 and 80 minutes.

### M3 — Computer Networking (4 sub-strands) ✅ done

2.1 Data communication · 2.2 Data Transmission Media · 2.3 Computer Network Elements ·
2.4 Network Topologies

**Done when:** the strand appears in the dropdown with zero `server/` changes. If the
server needed editing, stop and raise it — `CONTRIBUTING.md` says the schema is missing
something.

### M4 — Software Development (6 sub-strands) ✅ done

3.1 Computer Programming Concepts · 3.2 Program development · 3.3 Identifiers and
Operators · 3.4 Control Structures · 3.5 Containers · 3.6 Functions

The design teaches coding in a real language rather than flowcharts-first, so
`boardNotes` here should carry actual syntax, not boxes-and-arrows. Computer Science is
now whole: 3 strands, 17 sub-strands.

**Done when:** every Computer Science combination generates a pack — no refusals inside
the subject.

### M5 — Numbers and Algebra (3 sub-strands) ✅ done

1.1 Real Numbers · 1.2 Indices and Logarithms · 1.3 Quadratic Expressions and Equations 1

### M6 — Measurements and Geometry (9 sub-strands)

2.1 Similarity and Enlargement · 2.2 Reflection and Congruence · 2.3 Rotation ·
2.4 Trigonometry 1 · 2.5 Area of Polygons · 2.6 Area of a Part of a Circle ·
2.7 Surface Area and Volume of Solids · 2.8 Vectors I · 2.9 Linear Motion

Largest milestone by count. Split across commits if it helps; the "done when" is the same.

### M7 — Statistics and Probability (2 sub-strands)

3.1 Statistics I · 3.2 Probability 1

**Done when:** Mathematics is whole — 14 sub-strands, no refusals inside the subject.

### M8 — Corpus audit and PR

One pass over everything: duplicate `id`s, question counts, activity materials, marking
schemes that actually award marks, `sourceNote` honesty on every file, sub-strand strings
matching the PDF character for character.

**Done when:** the audit script below exits clean, every combination generates a
populated pack by hand, the `sijui` path still refuses a bogus strand, and the PR into
`main` touches **zero files outside `corpus/` and `docs/`**.

## How to verify — run this every milestone

Structural check. Catches the errors that are boring to catch by eye:

```bash
node -e '
const {loadCorpus, getOptions} = require("./server/corpus.js");
const c = loadCorpus();
const ids = c.map(x => x.id);
const dupes = ids.filter((v,i) => ids.indexOf(v) !== i);
let bad = 0;
for (const x of c) {
  const err = [];
  if (x.assessmentQuestions.length !== 5) err.push(`${x.assessmentQuestions.length} questions`);
  if (x.assessmentQuestions.some(q => !q.markingScheme)) err.push("missing markingScheme");
  if (!x.activity.description) err.push("no activity");
  if (!/^None/.test(x.activity.materialsNeeded)) err.push("activity needs materials");
  if (x.learningOutcomes.length < 3) err.push("under 3 outcomes");
  if (x.boardNotes.length < 4) err.push("under 4 board notes");
  if (!x.explainer) err.push("no explainer");
  if (!/verbatim/.test(x.verified)) err.push(`verified not the agreed sentence: ${x.verified}`);
  if (!/verbatim/.test(x.citation)) err.push("citation does not state what is verbatim");
  if (err.length) { bad++; console.log(`FAIL ${x.id}: ${err.join(", ")}`); }
}
if (dupes.length) console.log("DUPLICATE ids:", [...new Set(dupes)].join(", "));
console.log(`\n${c.length} sub-strands, ${bad} failing, ${dupes.length} duplicate ids`);
'
```

Provenance check — proves every `learningOutcomes` entry really is in the source PDF and
was not paraphrased or invented. Because `pdftotext` interleaves the design's table
columns, a plain substring match gives false failures; this checks that the outcome's
words appear in the source **in order**, tolerating foreign words from the neighbouring
column between them, and reports how many it had to skip:

```bash
node corpus/_source/verify-outcomes.js corpus/_source/*.txt
```

Pass every source file in one run. An outcome counts as traced if it is found in any of
them, so checking the whole corpus against a single subject's design reports every other
subject as untraced.

Exits non-zero on any untraced outcome. A high "foreign words removed" count is normal
and just means that sub-strand's table cell was badly interleaved — an *untraced* outcome
is the real failure, and means the wording drifted from the design.

Then the manual pass `CONTRIBUTING.md` requires — start `node server/index.js`, open
`http://127.0.0.1:4173`, and for each new sub-strand confirm the pack populates every
section, the illustrative badge and citation show, and print view hides the picker.

Refusal path, only if `server/` was somehow touched:

```bash
curl -s -X POST http://127.0.0.1:4173/api/pack \
  -H 'Content-Type: application/json' \
  -d '{"grade":"Grade 10","subject":"Astrology","strand":"Nope","subStrand":"Nope","lessonLength":40}'
# expect: {"sijui":true, ...}
```

## Not in scope on this branch

- Any change under `server/` or `public/` — those belong to `main` and `ui-polish`
- Anything that adds a second thing for the teacher to click
- Generated, summarized or model-written text of any kind
- New subjects beyond Computer Science and Mathematics
- Claiming any field other than `learningOutcomes` is verbatim KICD text
- Adding a corpus field that `server/corpus.js` does not already pass through

Known bug outside this branch, for reference only: the illustrative badge is hardcoded
in `public/app.js` rather than read from the chunk's `verified` field. That is
`ui-polish`'s to fix, and it will matter the day a `verified` value stops being
`"illustrative"`.
