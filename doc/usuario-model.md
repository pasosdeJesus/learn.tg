# The usuario model and the base model (R-#260 Part B)

learn.tg's `usuario` and the geographic catalogs come from **msip 2.2** (through the
Rails backoffice and the `sip`/Devise lineage). Since R-#260 that common part lives in
[`@pasosdejesus/m/base-model`](https://gitlab.com/pasosdeJesus/m/-/work_items/46)
(Part A, published in `@pasosdejesus/m`); learn.tg **adopts** it and **extends** it.

**Base model version in use: `1.0.0`** (`lib/base-model.ts`, `BASE_MODEL_VERSION_IN_USE`).

## 1. What is base and what is learn.tg's

The base model publishes five tables (`BASE_MODEL_TABLES`):

| Table | What it is |
|---|---|
| `usuario` | the learner / person (the MSIP + Devise columns: `password`, `encrypted_password`, `sign_in_*`, `reset_password_*`, `remember_created_at`, `failed_attempts`, `unlock_token`, `locked_at`, `oficina_id`, `tema_id`, `foto_*`, `fechacreacion`, `fechadeshabilitacion`, `rol`, `idioma`, `descripcion`, …) |
| `msip_pais`, `msip_departamento`, `msip_municipio`, `msip_centropoblado` | the geographic reference catalogs |

Everything else is learn.tg's extension. The authoritative list is the one `m`
publishes in `LEARN_TG_EXTENSIONS` (`packages/m/src/base-model/references/learn-tg.ts`);
`make db-check` reports extensions as `extra` and **never** fails because of them
(2026-10-10: 59 consumer additions across the five tables).

The extensions fall in these groups:

- **Identity and contact**: `passport_name`, `passport_nationality`, `whatsapp`, `telegram`,
  `church_relationship`, `denomination`, `country_id`, `city_id`, `place_of_worship`,
  `place_of_worship_location`, `church_id`, `pastor_name`, `pastor_whatsapp`, `working_hours`.
- **Verification (R-#269)**: `verified_whatsapp`, `verified_telegram`, `verified_email`,
  `verified_city_id`, `verified_place_of_worship`, `verified_place_of_worship_location`,
  `verified_church_relationship`, `id_photo_front`, `id_photo_back`, `id_photo_verified`,
  `proposed_date_of_interview`, `conducted_date_of_interview`.
- **Scores and privacy (R-#259)**: `profilescore`, `learningscore_deprecated`,
  `excluir_leaderboard`, `mostrar_cursos_publico`, `mostrar_cursos_sensibles_publico`,
  `position_israel_gaza`, `lastgooddollarverification`.
- **Church registration**: `registration`, `registration_photo`.
- **Wallet link** (`billetera_usuario`, not base: msip 2.2 does not have it):
  `answer_fib`, `nonce`, `nonce_expires_at` (plus `billetera`/`usuario_id`).

## 2. The three drifts that were aligned (2026-10-10)

`bin/m db:check` reported three **restrictive** drifts: the base (and
`msip-2.2/test/dummy/db/structure.sql`) declares

| Object | Base / msip 2.2 | learn.tg before |
|---|---|---|
| `usuario.unlock_token` | `character varying(64)` | `character varying(255)` |
| `msip_municipio.departamento_id` | `NOT NULL` | nullable |
| `msip_centropoblado.municipio_id` | `NOT NULL` | nullable |

They were aligned by
[`db/migrations/20261010022121_alinear_modelo_base_msip.ts`](../apps/nextjs/db/migrations/20261010022121_alinear_modelo_base_msip.ts),
which is reversible and fails loudly rather than losing data (`SET NOT NULL` refuses
with a NULL row; shrinking the type refuses with a value that does not fit).

## 3. How the conformance is checked

```sh
cd apps/nextjs
make db-check          # bin/m db:check against the live database; non-zero on drift
make test-db           # unit half: declares the base version and the base tables
bin/m base-model:baseline      # the published baseline DDL
bin/m base-model:verify --from-structure db/structure.sql
```

- `make db-check` needs a database (`PGHOST`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`) and grades
  `drift` (base missing/changed, fails) against `extra` (extension, reported).
- `db/__tests__/base-model.test.ts` fails when `m` publishes a new
  `BASE_MODEL_VERSION`; then run `make db-check`, apply what is missing and update
  `BASE_MODEL_VERSION_IN_USE`.
- The base's guidelines (numbered, so they can be cited) are `GUIDELINES` in
  `@pasosdejesus/m/base-model`.

## 4. References

- R-#260 (Part B is learn.tg's adoption): https://github.com/pasosdeJesus/learn.tg/issues/260
- `m` work item 46 (the base model): https://gitlab.com/pasosdeJesus/m/-/work_items/46
- `@pasosdejesus/m/base-model` README and `doc/base-model-tutorial.md` (in `m`).
- `db/structure.sql` (learn.tg's live structure) and `db/db.d.ts` (generated types).
