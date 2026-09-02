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

## What this is — and, importantly, what it is not

Kenya already has a lot of official infrastructure for this: **KICD** publishes the curriculum designs themselves, and the **Kenya Education Cloud** already hosts CBC-aligned e-books, radio lessons, TV lessons and teacher resources. This project does not try to replace either of those, and does not try to build "an AI that knows the CBC" as a general knowledge base.

Instead, it builds the **one missing layer between the curriculum document and what a teacher actually does in the next 20 minutes** — turning "here is the strand" into "here is what to teach, what to write, what activity to run, and how to check understanding," for a teacher who has the document but not the training.

It is deliberately narrow:

- **No learner ever uses it.** No child logs in, no learner name or learner work is ever entered, stored, or seen by the system. It exists entirely inside the teacher's own preparation, before any learner is involved.
- **It never invents an answer.** If a teacher's question isn't covered by the curriculum material that's actually loaded, the tool says so plainly — "sijui" (I don't know) — instead of guessing. This is treated as a feature, not a failure: a wrong confident answer in a classroom is worse than an honest "I don't have that."
- **It works with no internet in the room.** It runs entirely on the teacher's own device. Nothing is fetched from the internet at the moment a teacher asks it a question.
- **Every answer says where it came from.** Each response is tied back to the specific part of the curriculum design it was drawn from, so a teacher — or an inspector, or KICD itself — can check it against the source document.

## Why Jane specifically, and why two subjects

Kenyan secondary teachers routinely carry more than one subject and more than one class — Jane teaching Computer Science *and* Core Mathematics is the norm, not an edge case invented for this pitch. The tool reflects that directly: a teacher picks which grade, subject and strand she's dealing with right now, and switches between "confident, this is my subject" and "one lesson ahead of my students" inside the same tool, in the same day.

## Where the content came from — stated plainly

We tried to get the official KICD Grade 10 curriculum design PDFs directly. KICD's own website lists them behind a JavaScript-driven download system that couldn't be scraped in the time available. We did locate one genuine copy of the official Grade 10 Core Mathematics curriculum design elsewhere online, but it turned out to be a scanned image document with no extractable text — there was literally no text to pull out of it without OCR software, which wasn't available in the build environment.

So, honestly: the strand and topic *names* used in this build are real and verifiably reported (e.g. Computer Science's strands — Foundations of Computer Science, Software Development, Computer Networking — and the programming languages it teaches). The detailed content underneath each topic (the board notes, the suggested activities, the assessment rubrics) is illustrative material written in the style of a real KICD curriculum design, clearly labelled as such inside the tool itself, not presented as verbatim official text. Swapping in the real document's text later requires no change to how the tool works — only to what's loaded into it.

## Why this matters beyond one hackathon demo

If a tool like this actually worked, and actually stayed honest about what it doesn't know, the thing it would be solving is not "Jane needs an AI." It's "Kenya is asking thousands of teachers to teach subjects they weren't trained for, on a rollout timeline that outran textbook delivery, and the gap between the curriculum document and the classroom is currently being closed by nothing at all." That gap is where this sits.
