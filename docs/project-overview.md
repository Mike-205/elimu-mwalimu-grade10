# Elimu, Mwalimu wa Grade 10 — Project Overview

## The problem, in one scene

Jane teaches at a school in Murang'a. She's trained in Mathematics and Physics. Grade 10 — Kenya's new Senior School level — has just rolled out, and she's been assigned to also teach **Computer Science**, a brand-new subject she has never taught before. She has the official KICD curriculum design document. She does not have a textbook for it yet, and there is no internet in her classroom. Her lesson starts in 20 minutes.

She's not making this up, and she's not alone. A 2026 survey found only 6.3% of schools were fully staffed for Grade 10, with digital resources the single largest reported gap, and there are documented shortages of trained teachers for new Grade 10 subjects — especially technical ones. This is a real, current, national transition problem, not a hypothetical one.

Jane needs answers to five very specific questions, in order, right now:

1. What exactly am I supposed to teach today?
2. What should I write on the board?
3. What activity can I give the students?
4. How do I check whether they understood it?
5. What do I do if I don't understand the topic myself?

But she doesn't need five separate tools, or a menu she has to click through and assemble herself with twenty minutes on the clock. She needs **one thing**: pick the strand and how long the lesson is, and get back one complete, ready-to-teach plan that already answers all five — printed or saved as a single page she can carry into the classroom, with no laptop required once it's in her hand.

## What this is — and, importantly, what it is not

Kenya already has a lot of official infrastructure for this: **KICD** publishes the curriculum designs themselves, and the **Kenya Education Cloud** already hosts CBC-aligned e-books, radio lessons, TV lessons and teacher resources. This project does not try to replace either of those, and does not try to build "an AI that knows the CBC" as a general knowledge base.

Instead, it builds the **one missing layer between the curriculum document and what a teacher actually does in the next 20 minutes** — turning "here is the strand" into "here is what to teach, what to write, what activity to run, and how to check understanding," for a teacher who has the document but not the training.

It is deliberately narrow:

- **No learner ever uses it.** No child logs in, no learner name or learner work is ever entered, stored, or seen by the system. It exists entirely inside the teacher's own preparation, before any learner is involved.
- **One answer, not the answer.** There is no menu, no chat box, no five separate buttons to click and stitch together yourself. One button — "Generate my lesson pack" — produces one complete plan. If it turns out you need a different topic, you pick it and generate again; you're never handed a pile of options to assemble under time pressure.
- **It never invents an answer.** If the exact strand a teacher picked isn't covered by the curriculum material that's actually loaded, the tool refuses outright — "sijui" (I don't know) — rather than producing a plausible-looking pack for a topic it doesn't actually have. This is enforced structurally: there's no generative step in the pipeline at all, so there's no code path capable of writing a sentence that didn't already exist in the loaded curriculum data.
- **It works with no internet in the room, and the output is a pack she can carry.** The whole thing runs on the teacher's own device with no network calls, and generating a pack ends in a single printable page — something she can print or save and take into the classroom without needing the laptop open during the lesson itself.
- **Every pack says where it came from.** Each pack is tied back to the specific part of the curriculum design it was drawn from, so a teacher — or an inspector, or KICD itself — can check it against the source document.

## Why Jane specifically, and why two subjects

Kenyan secondary teachers routinely carry more than one subject and more than one class — Jane teaching Computer Science *and* Mathematics is the norm, not an edge case invented for this pitch. The tool reflects that directly: a teacher picks which grade, subject and strand she's dealing with right now, and switches between "confident, this is my subject" and "one lesson ahead of my students" inside the same tool, in the same day.

## Where the content came from — stated plainly

The official KICD Grade 10 curriculum designs for both of Jane's subjects sit in this repository as extracted text, under `corpus/_source/`. Getting them took two attempts, and the first one failed: KICD's own site serves its downloads through a JavaScript-driven system that couldn't be scraped, and the one copy located elsewhere at the time was a scanned image with no text layer at all. An earlier version of this document stopped there and said the designs were unobtainable. That turned out to be wrong. Text-layer copies of both the Computer Science and the Mathematics design were subsequently found, and `pdftotext` alone extracts them — 68 and 65 pages, no OCR, no extra tooling.

So the honest position is now a split, and it is the same split in all 31 sub-strands:

- **What a learner must be able to do is quoted.** Every `learningOutcomes` entry is verbatim from that sub-strand's "Specific Learning Outcomes" list in the official design. All 175 of them are checked against the source text by `corpus/_source/verify-outcomes.js`, which fails if any has drifted from the wording KICD published.
- **How to teach it is ours, and labelled as ours.** The board notes, the no-materials activity, the five marked questions and the plain-language explainer are written for this project. The design specifies outcomes, not what a teacher writes on a blackboard or how many marks a question is worth — so that is where the source genuinely ends, and the pack says so on its face.

Two places where the designs contradict themselves are worth stating rather than quietly resolving. The Mathematics design's contents page lists a sub-strand, "Angle Properties of a Circle", that appears nowhere in the body of the document, which instead carries a full "Vectors I" section the contents page omits. We followed the body and do not offer Angle Properties at all, because there are no published outcomes to quote for it. And one lesson allocation is illegible in the extraction; rather than infer a number, that entry omits it and says why. Both decisions, and the reasoning, are recorded in `docs/corpus-content-plan.md`.

## A course correction worth being honest about

The first version of this build got the offline, no-learner-data, and "refuse rather than guess" rules right, but got the actual product shape wrong: it shipped five separate question-buttons and a free-text box for Jane to click through and assemble herself — exactly the "menu of options" the brief says a real teacher doesn't have time for at 7:40am. Re-reading the brief caught this, and the product was rebuilt around a single "Generate my lesson pack" action instead. The underlying curriculum data and the refusal-over-guessing principle carried over unchanged; the interaction model didn't.

## Why this matters beyond one hackathon demo

If a tool like this actually worked, and actually stayed honest about what it doesn't know, the thing it would be solving is not "Jane needs an AI." It's "Kenya is asking thousands of teachers to teach subjects they weren't trained for, on a rollout timeline that outran textbook delivery, and the gap between the curriculum document and the classroom is currently being closed by nothing at all." That gap is where this sits.
