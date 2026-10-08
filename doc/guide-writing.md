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

- Write **6 or more questions** per guide (recommended: 6-8) to provide
  variety when a user retakes the guide. The platform randomly selects a
  subset each time.
- The user sees **at most 5 questions** per attempt (from PRINCIPLES.md:
  3-5, not a heavy burden).
- Each question ends with a blank `___` followed by the expected answer in
  parentheses: `(answer)`. Answers are case-insensitive and accent-insensitive
  — the system normalizes both before comparison.
- The answer in parentheses is what the crossword system uses to validate.
- **The parenthesis is also the offline contract** (R-#256): when a learner solves a
  downloaded crossword and submits it after reconnecting, the server derives the
  expected answers from this markdown, matching each clue (the question text) with its
  answer. Keep one question per numbered item (a question may wrap to the next line),
  keep `___` in the body and the answer in the **last** parentheses of the item, and do
  not put a `)` inside the answer: a guide that breaks the format makes its crossword
  unverifiable offline.
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
  `guia2.md`).
- English content in `resources/en/`, Spanish in `resources/es/`.
- Keep both language versions synchronized.
- Some courses live in a private repository mounted as a git submodule
  (`resources/en/gdcluster` for the Global Disciples EN course, `resources/es/redgd`
  for the ES one); clone with `--recurse-submodules` to get their guides.
- Cross-reference the other guides of the course with a relative link
  (`[Guide 3](../guide3)`); pages outside the course with an absolute path
  (`/en/migration-in-app-wallet`).
- Guide URLs (`/{lang}/{prefijoRuta}/{sufijoRuta}`) are hardcoded in a few places
  (`GasInsufficientPanel`, `donation-target`, the cluster and referral pages, the E2E
  specs): renumbering a guide means updating those references too.

## Database

- Each guide is a row in `cor1440_gen_actividadpf` linked to a course via
  `proyectofinanciero_id`.
- `nombrecorto` controls ordering (text sort). **Always plain numbers** (`guide1`,
  `guide2`, `guia3`…): to insert a guide in the middle, **renumber the ones that
  follow** (`guide2b` was the old letter-suffix convention and is no longer used).
- `sufijoRuta` must match the filename without extension.
- To add a guide between existing ones, use a migration (`bin/m db:mig:make`).
  See [How to Create a Course](how-to-create-a-course.md) for the full course
  setup workflow (script, DB, vault, credentials).
