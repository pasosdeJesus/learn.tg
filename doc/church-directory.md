# Church directory and reputation (R-#164 Phase 1)

> *"By wisdom a house is built, and by understanding it is established"* (Proverbs 24:3)

Public church directory plus the platform's **internal** reputation for churches
and pastors. Full design: https://github.com/pasosdeJesus/learn.tg/issues/164.

## Privacy (read this first)

- A church whose country is **region type 2** (`msip_pais.tipo_region = 2`) is
  **never published** — not in the directory, not in the ranking and not its
  negative reputation. The directory query excludes it
  (`lib/church-directory.ts`, `COALESCE(p.tipo_region, 1) <> 2`).
- A negative case **never starts with a public label** (R-#164 §2.4): it follows
  private-first steps. Only after strong, unanswered evidence does the church
  appear in the **"not recommended"** section, neutral and without a position.

## Surfaces

| Surface | Route | Auth |
|---|---|---|
| Directory | `GET /api/directory/churches` + `/[lang]/directory/churches` | public |
| Church detail | `GET /api/directory/churches/[id]` + `/[lang]/directory/churches/[id]` | public |
| Claim a church | `POST /api/directory/churches/[id]/claim` | session |
| List/unlist | `PATCH /api/admin/churches/[id]/list` | verifier |
| Record evidence | `POST /api/admin/reputation/pastor/[id]/evidence` (multipart) | verifier |
| Resolve a case | `POST /api/admin/reputation/evidence/[evidenceId]/resolve` | verifier (other) |
| Evidence file | `GET /api/admin/reputation/evidence/[evidenceId]/file` | verifier |

The ☰ menu shows the **Church directory** link only for a signed-in user who is
**verified** (the verifier confirmed their place of worship/city) **and** lives in
a **region type 1** country — the API decides it (`GET /api/settings` →
`directoryVisible`). Guests, users without a country and region type 2 users do not
see the link.

The directory UI mirrors the leaderboard: the **country selector is the shared
`CountryFilter`** (`@learn-tg/gdcluster`, the same the leaderboard uses) and the
**denomination** is a multi-select (checkbox dropdown). `GET /api/directory/churches`
returns the `countries` and `denominations` facets over the whole population and
accepts repeated `denomination` parameters (`?denomination=A&denomination=B`).

## Activity score (`activity_score`)

Reuses the six R-#278 components aggregated **per church** in
`churchactivitycache` (raw sums, refreshed by triggers) and normalized **at read
time** over the whole directory population (`lib/church-activity.ts`), so a
church's score does not change with the visitor's filter. It is **not** stored
normalized.

## Reputation (internal)

Computed by `refresh_church_reputation()` (migration
`20261007120000_church_reputation.ts`): +10 verified church, +20 verified lead
pastor; an active `dishonesty`/`sexual_abuse` case against the lead pastor or a
co-pastor caps the church at **-50**; a leader subtracts 20 and a member 10.
What is **published** follows §2.4, not the internal score.

## Tests and checks

- `lib/__tests__/church-activity.test.ts` — normalization (min-max over
  `ln(1+x)`, weights, flat components).
- `cd apps/nextjs && node bin/audit-api-auth.mjs` — the directory routes are
  public, the reputation routes admin-only.
- Migrations: `bin/m db:migrate` (applied on the local DB 2026-10-07).
