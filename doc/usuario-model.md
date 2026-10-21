# The usuario model and the msip engine (R-#260 Part B / R-#285)

learn.tg's `usuario` and the geographic catalogs come from **msip 2.2** (through the
Rails backoffice and the `sip`/Devise lineage). Since R-#285 that common part is the
**`msip` engine** ([`@pasosdejesus/msip`](https://gitlab.com/pasosdeJesus/m/-/work_items/46)):
it left `@pasosdejesus/m` and is **no longer an `m` subpath**. learn.tg **adopts** it
and **extends** it.

**Base model version in use: `1.0.0`** (`lib/msip.ts`, `BASE_MODEL_VERSION_IN_USE`).

## 0. How learn.tg consumes the engine (R-#285)

The engine is **not published to npm** (it stays `private`, `m#40` D1), so learn.tg
consumes a **vendored copy**:

- **`packages/generated/msip`** — a traceable copy made with
  `bin/m eng:sync <ruta-al-checkout-de-m>/packages/msip --vendor` (run from
  `apps/web`, its default `--out`), carrying `PROVENANCE.json` (engine, version,
  origin, `sha256`). It is **derived**: adopt an engine change by regenerating it
  (`eng:sync --vendor`), never by editing it.
- **Compiled separately** (`tsc -b` → `dist/`, with the app's compiler, because the
  copy has no `node_modules` of its own):
  `cd packages/generated/msip && ../../../node_modules/.bin/tsc -b`.
- The app depends on it as **`generated-msip`** (`link:packages/generated/msip`);
  `lib/msip.ts` and `db/__tests__/msip.test.ts` import the model from there.
- It lives under the **app** (`apps/web/packages`) on purpose: `m` resolves the
  engine and measures drift from the **working directory**, while it discovers engines
  by walking **upward**. learn.tg's own engines live at the repository root
  (`packages/`), so the split (`make eng-check` from the app for `msip`; `make
  eng-verify` from the root for the app's engines) is why the app directory carries
  the vendored copy. `apps/web/tsconfig.json` and `vitest.config.ts` exclude
  `packages` so the copy is not compiled (`tsc`) or collected (`vitest`) as app code.
- **`apps/web/m-engine.json`** declares the base tables learn.tg reads
  (`engines.generated-msip.tables`); `bin/m eng:check` fails if the code uses an
  undeclared base table.
- **Drift** is measured against the `m` checkout:
  `bin/m eng:check --from /var/www/adJ-ia/m`.

## 1. What is base and what is learn.tg's

The engine owns **40 tables** (`usuario` + the `msip_*` catalogs, e.g.
`msip_pais`, `msip_departamento`, `msip_municipio`, `msip_centropoblado`,
`msip_tdocumento`). The five learn.tg actually reads are:

| Table | What it is |
|---|---|
| `usuario` | the learner / person (the MSIP + Devise columns: `password`/`encrypted_password`, `sign_in_*`, `reset_password_*`, `remember_created_at`, `failed_attempts`, `unlock_token`, `locked_at`, `oficina_id`, `tema_id`, `foto_*`, `fechacreacion`, `fechadeshabilitacion`, `rol`, `idioma`, `descripcion`, …) |
| `msip_pais`, `msip_departamento`, `msip_municipio`, `msip_centropoblado` | the geographic reference catalogs |

Everything else is learn.tg's extension. **learn.tg owns this inventory now**: the
engine stopped publishing a consumer-specific list (`LEARN_TG_EXTENSIONS` is gone,
`packages/m/src/consumers.test.ts` forbids it), so the list below *is* the authority.
`bin/m eng:check` reports the extensions as `extra` and **never** fails because of
them (2026-10-13: **58 consumer additions** over the baseline).

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

## 2. The drifts against the baseline

**Aligned on 2026-10-10** (R-#260 Part B): three *restrictive* drifts that the old
five-table baseline reported, fixed by
[`db/migrations/20261010022121_alinear_modelo_base_msip.ts`](../apps/web/db/migrations/20261010022121_alinear_modelo_base_msip.ts)
(reversible; fails loudly instead of losing data):

| Object | Base / msip 2.2 | learn.tg before |
|---|---|---|
| `usuario.unlock_token` | `character varying(64)` | `character varying(255)` |
| `msip_municipio.departamento_id` | `NOT NULL` | nullable |
| `msip_centropoblado.municipio_id` | `NOT NULL` | nullable |

**Surfaced by R-#285** (the baseline grew from 5 to **40 tables**, so `eng:check` also
sees the whole `msip_*` model) and **aligned on 2026-10-13** by
[`db/migrations/20261013184146_alinear_modelo_base_msip_drifts.ts`](../apps/web/db/migrations/20261013184146_alinear_modelo_base_msip_drifts.ts)
(reversible; the three tables had 0 rows, so nothing could be lost):

| Object | Engine baseline | learn.tg before |
|---|---|---|
| `msip_anexo.descripcion` | `NOT NULL` | nullable |
| `msip_grupo_usuario.grupo_id`, `usuario_id` | `integer` | `bigint` (both reference `integer` primary keys) |
| `msip_orgsocial_persona.orgsocial_id` | `NOT NULL` | nullable |

These are **msip auxiliary tables learn.tg does not use**; they are aligned anyway so
`bin/m eng:check` reports the base model as **[OK]** (40 tables, 58 consumer additions).

## 3. How the conformance is checked

```sh
cd apps/web
make eng-check          # bin/m eng:check (engine schemas, vendored drift, self-containment, live DB)
make test-db            # unit half: declares the base version and the base tables
bin/m eng:msip:baseline      # the published baseline DDL
bin/m eng:msip:verify --from-structure db/structure.sql   # baseline vs learn.tg's structure
bin/m eng:verify             # engine manifests vs sources/intention (all engines)
```

- `make eng-check` needs a database (`PGHOST`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`) and
  grades `drift` (base missing/changed, fails) against `extra` (extension, reported).
- `db/__tests__/msip.test.ts` fails when the engine publishes a new
  `BASE_MODEL_VERSION`; then run `make eng-check`, apply what is missing and update
  `BASE_MODEL_VERSION_IN_USE`.
- The base's guidelines (numbered, so they can be cited) are `GUIDELINES` in
  `generated-msip`.

## 4. Geographic data

The data of the geographic tables is **split**: part of it belongs to the **`msip`
engine** (`m`) and part to **learn.tg** (learn.tg's catalog and its own columns on
`msip_pais`). How each part is loaded and kept up to date is a separate decision, not
developed here.

### 4.1 Base tables learn.tg reads

Of the engine's 40 tables, learn.tg's code uses **five**, and `apps/web/m-engine.json`
declares exactly those (`engines.generated-msip.tables`; `eng:check` fails if the code
uses an undeclared base table and warns about a declared one that is unused):

- `usuario`, `msip_pais`, `msip_departamento`, `msip_municipio`, `msip_centropoblado`.

The other **35** `msip_*` tables are **not used** by learn.tg:
`msip_anexo`, `msip_bitacora`, `msip_centropoblado_histvigencia`,
`msip_departamento_histvigencia`, `msip_estadosol`, `msip_etiqueta`,
`msip_etiqueta_municipio`, `msip_etiqueta_persona`, `msip_etnia`, `msip_fuenteprensa`,
`msip_grupo`, `msip_grupo_usuario`, `msip_grupoper`, `msip_municipio_histvigencia`,
`msip_oficina`, `msip_orgsocial`, `msip_orgsocial_persona`,
`msip_orgsocial_sectororgsocial`, `msip_pais_histvigencia`, `msip_perfilorgsocial`,
`msip_persona`, `msip_persona_trelacion`, `msip_sectororgsocial`, `msip_solicitud`,
`msip_solicitud_usuarionotificar`, `msip_tcentropoblado`, `msip_tdocumento`, `msip_tema`,
`msip_tipoorg`, `msip_trelacion`, `msip_trivalente`, `msip_tsitio`, `msip_ubicacion`,
`msip_ubicacionpre`, `msip_vereda`.

## 5. References

- R-#260 (Part B is learn.tg's adoption): https://github.com/pasosdeJesus/learn.tg/issues/260
- R-#285 (adaptation to the engines): https://github.com/pasosdeJesus/learn.tg/issues/285
- `m` work item 46 (the base model): https://gitlab.com/pasosdeJesus/m/-/work_items/46
- `m` work item 39 (engine composition): https://gitlab.com/pasosdeJesus/m/-/work_items/39
- The engine README and `doc/msip-tutorial.md` (in `m`); guidelines: `m/doc/engines.md` §12.1.
- `db/structure.sql` (learn.tg's live structure) and `db/db.d.ts` (generated types).
