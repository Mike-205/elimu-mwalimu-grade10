# Who this helps — Elimu, Mwalimu wa Grade 10

## The role

**A Kenyan Senior School (Grade 10) subject teacher assigned to teach a strand outside their training**, in a school with unreliable or no internet access and no textbooks yet delivered for the new Grade 10 curriculum.

## The concrete person

**Jane** — trained and qualified in Mathematics and Physics, teaching at a school in Murang'a. Grade 10's rollout (2026) assigns her **Computer Science**, a brand-new STEM pathway elective, alongside her own **Mathematics** classes. She has the KICD curriculum design document but:

- no internet in the classroom to look anything up mid-lesson,
- no textbook yet for the new strand,
- a lesson starting in 20 minutes,
- and five real questions she needs answered *right now*: what exactly to teach, what to put on the board, what activity to run, how to check they understood, and what to do when she herself doesn't know the topic.

She doesn't have time to click through five separate answers and assemble them herself — she needs tomorrow's lesson, not a platform. That's why the tool gives her one pack, not a menu: pick the strand and the lesson length, get one complete, printable 40- or 80-minute plan.

This is real, not hypothetical: a 2026 survey found only 6.3% of schools fully staffed for Grade 10, with digital resources the largest reported learning-resource gap, and documented shortages of trained teachers for new Grade 10 subjects — particularly technical ones like Computer Science.

## Why Jane, specifically, and not a learner or a school administrator

- **Not a learner:** no learner ever touches this system — that's a design constraint, not an oversight (see the risk sheet). The product exists entirely inside the teacher's own preparation, before any learner is involved.
- **Not the Ministry or KICD:** this doesn't replace curriculum design or textbooks — it assumes KICD's published curriculum design is the correct source of truth and only translates it into what a teacher does in the next 20 minutes. See the corpus source notes for exactly which content is verified curriculum fact versus illustrative gap-fill pending the official PDF.
- **Not a marketplace or general tutor:** it produces one lesson pack for the exact strand and length Jane picks, grounded only in the loaded curriculum material, and says "sijui" rather than fabricating a pack when a topic falls outside what's loaded.

## Why she teaches two things, not one

Kenyan secondary teachers routinely carry more than one subject and more than one class. Jane's own bio — trained in Math/Physics, assigned Computer Science — is the norm, not the edge case. The corpus and UI are built around `{grade, subject, strand, lesson length}` as a selectable combination for exactly this reason: Jane needs to switch between "confidently teaching Mathematics" and "one lesson ahead of her students in Computer Science" inside the same tool, in the same day — and get one ready-to-carry pack either way.
