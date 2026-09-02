# Risk classification — Elimu, Mwalimu wa Grade 10

**Under: Kenya Artificial Intelligence Bill, 2026 (as reported by legal commentary as of 2026-03-18; we could not access the Bill's own text directly and have not verified section numbers — treat this as a reasoned self-assessment, not a legal opinion)**

## What the Bill actually tests

The Bill defines a **high-risk AI system** as one that "poses significant risks to health, safety, fundamental rights or societal welfare," and separately lists **critical sectors** — healthcare, education, finance, security, public administration — as sectors where high-risk systems are typically found (Cliffe Dekker Hofmeyr, 18 Mar 2026 alert). The sector list is illustrative of *where* high-risk systems tend to sit, not a rule that every system operating in a listed sector is automatically high-risk. The operative test is the harm test, applied to what the system actually does.

## What this system actually does

- **Who touches it:** only the teacher. No learner ever logs in, is identified, or interacts with the system directly.
- **What data it holds:** none, persistently. No learner names, learner work, or session history is stored; nothing survives a restart.
- **What it decides:** nothing about a person. It surfaces curriculum reference material (learning outcomes, board notes, a suggested activity, an assessment rubric) that the teacher reads and chooses whether to use. It does not grade, rank, admit, flag, or make any determination about a learner.
- **How it answers:** only from a loaded, cited curriculum chunk. If nothing in the loaded material matches the question with reasonable confidence, it refuses ("sijui") instead of generating an answer — enforced in code (`server/retrieval.js` confidence gate; `server/ollama.js` prompt instructs refusal over guessing), not just as a policy statement.
- **Where it runs:** offline, on the teacher's own device, no network calls at request time.

## Self-assessment: Limited Risk, with High-Risk-style safeguards adopted anyway

We assess this as sitting closer to **Limited Risk** than **High Risk**, because the harm test the Bill actually applies — significant risk to health, safety, fundamental rights, or societal welfare arising from what the *system* does — is weak here: the system makes no decision about any individual, holds no personal data, and cannot act on a learner without a human (the teacher) independently choosing to use what it surfaced. This differs materially from the kind of education-sector system the "high risk" sector listing is clearly aimed at — e.g. automated grading, admissions scoring, or learner-performance profiling — where the system's output directly determines an outcome for a specific person.

We are not claiming a confident final tier, because:
- We have not read the Bill's operative text directly (no section/schedule citation available to us), only secondary legal commentary.
- The Bill's own risk-tier criteria for the education sector may not yet distinguish "teacher-support / no learner-facing decision" tools from "learner-facing / decision-making" tools — that line may only get drawn in subsidiary regulations or Commissioner guidance.

Because of that uncertainty, the build already implements several protections the Bill requires specifically of **high-risk** systems, regardless of which tier it ultimately lands in:
- **Human oversight / human centricity:** every output is advisory to the teacher; nothing reaches a learner without the teacher acting.
- **Transparency and notification:** the app discloses "AI is involved in this session" and its limitations on every screen, before any answer is shown.
- **Traceability:** every non-refused answer carries a citation to the specific curriculum chunk it came from, plus an explicit `verified` flag distinguishing confirmed strand facts from illustrative gap-fill content (see corpus source notes).
- **Refuse-over-guess:** the retrieval confidence gate and the model prompt both refuse rather than fabricate when the loaded material doesn't support an answer.

## What would push this into High Risk

If a future version added: learner logins, storage of learner work or identifiers, automated grading or scoring of a specific learner, or any output that a school could use to make a decision about a specific learner without a human review step — it should be re-assessed as High Risk under this same framework, and would need the Bill's pre-deployment human rights impact assessment and Commissioner registration before that version ships.
