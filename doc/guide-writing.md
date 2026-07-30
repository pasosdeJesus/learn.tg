# Guide Writing Conventions

Rules for writing course guides (content in `resources/{lang}/{course}/`).

## The Five Pillars (from PRINCIPLES.md)

1. **Focus** — One clear learning objective per guide. No digressions.
2. **Brevity** — 400-600 words, completable in 5-7 minutes. 3-5 comprehension
   questions.
3. **Action** — Knowledge that leads to a tangible action or applicable skill.
4. **Joyful Engagement** — Interactive, game-like. Learning as delightful
   discovery.
5. **Accessible Tone** — Informal, relational, humorous. No sterile formality.

## Comprehension Questions

- Write **more than 5 questions** in the guide content to provide variety when
  a user retakes the guide. The platform randomly selects a subset each time.
- The user sees **at most 5 questions** per attempt (from PRINCIPLES.md:
  3-5, not a heavy burden).
- Each question ends with a blank `___` followed by the expected answer in
  parentheses: `(answer)`.
- The answer in parentheses is what the crossword system uses to validate.
- Never put instructions or extra text inside the parentheses — they are
  reserved for the answer only. Put instructions in the question body.
- Use words, not digits: `(onehundred)` not `(100)`. Join compound words:
  `(twentyfour)` not `(twenty-four)` or `(twenty four)`. In Spanish this is
  natural (`veinticuatro`, `cien`).
- Avoid technical jargon in questions. Instead of "With V4, partial payments
  are supported", say "The contract that pays scholarships allows receiving
  only one reward if funds are low — this is a ___ payment."

## Format

- Markdown files in `resources/{lang}/{prefijoRuta}/`.
- Filename matches `sufijoRuta` in the database (e.g., `guide1.md`,
  `guia2b.md`).
- English content in `resources/en/`, Spanish in `resources/es/`.
- Keep both language versions synchronized.
- Use absolute URLs for cross-references: `[Guide 2b](../guide2b)`.

## Database

- Each guide is a row in `cor1440_gen_actividadpf` linked to a course via
  `proyectofinanciero_id`.
- `nombrecorto` controls ordering (text sort). Use numbers for main guides
  (`1`, `2`, `3`, `4`) and intermediate values for insertions (`25` between
  2 and 3).
- `sufijoRuta` must match the filename without extension.
- To add a guide between existing ones, use a migration (`bin/m db:mig:make`).
