# Extracted KICD curriculum design text

Machine-readable text extracted from the official KICD Grade 10 curriculum design PDFs.
Committed so that any `citation` in the corpus can be checked without internet — this is
an offline-first project and "verify against the source" should not require a download.

| File | Source PDF | Pages | Extracted |
|---|---|---|---|
| `computer-science-grade10-kicd.txt` | Computer Science Grade 10 Curriculum Design | 68 | 71,539 chars |
| `mathematics-grade10-kicd.txt` | Mathematics Grade 10 Curriculum Design | 65 | 78,038 chars |

Reproduce:

```bash
curl -sL -o /tmp/cs-g10.pdf   "https://freeexams.co.ke/wp-content/uploads/2024/11/Computer-Science-Grade-10-Curriculum-Designs.pdf"
curl -sL -o /tmp/math-g10.pdf "https://freeexams.co.ke/wp-content/uploads/2024/11/Mathematics-Grade-10-Curriculum-Designs.pdf"
pdftotext /tmp/cs-g10.pdf   corpus/_source/computer-science-grade10-kicd.txt
pdftotext /tmp/math-g10.pdf corpus/_source/mathematics-grade10-kicd.txt
```

No OCR involved — both PDFs carry a real text layer, contrary to what earlier notes in
`README.md` and `docs/project-overview.md` say. Those two documents describe an earlier
attempt that found only a scanned copy of the Mathematics design; a text-layer copy of
both designs was located afterwards. Update them.

`server/corpus.js` only loads `.json`, so nothing in this directory is served to a
teacher. It is provenance for humans reviewing the corpus.

## Caveat worth stating plainly

These are third-party mirrors of the KICD designs, not downloads from kicd.ac.ke — that
site's listings are JavaScript-rendered and still could not be scraped. The documents
carry the KICD masthead and the standard design structure (Essence Statement, Summary of
Strands and Sub Strands, per-sub-strand Specific Learning Outcomes / Suggested Learning
Experiences / Key Inquiry Questions), which is why they are trusted here. Anyone able to
pull the files from KICD directly should diff them against these and replace them.

## Layout gotcha when quoting

`pdftotext` flattens the designs' multi-column tables, so a sub-strand's Specific
Learning Outcomes get interleaved line-by-line with the Suggested Learning Experiences
column beside it. Read a whole sub-strand block before quoting from it — do not trust
consecutive lines to belong to the same column.
