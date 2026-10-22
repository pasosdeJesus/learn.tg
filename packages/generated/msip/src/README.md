# Modelo base `msip`: `usuario` y catálogos geográficos

> **El nombre:** `msip` es el **motor** (paquete `@pasosdejesus/msip`) que publica el **modelo base**: el
> subconjunto del esquema de la aplicación [msip-2.2](https://gitlab.com/pasosdeJesus/msip) que `m`
> expone (su `db/structure.sql` y la capa de datos). `msip` es el nombre del motor Rails de origen;
> «modelo base» es lo que **hace**. Los comandos son `eng:msip:*` y el paquete es `@pasosdejesus/msip`
> (`m` **no** lo reexporta: lo resuelve al ejecutar, instalado o vendorizado).

**Consumo.** La vía es **vendorizada** (`bin/m eng:sync <ruta-al-checkout>/packages/msip --vendor`, que
deja una copia trazable en `packages/generated/msip` con `PROVENANCE.json`; hay que compilarla con
`tsc -b`). El motor lleva **versión** para **trazar procedencia** (`PROVENANCE.json`, drift de
`eng:check`), **no** para el registro de npm: queda `private` y no se publica ([REQ/40](https://gitlab.com/pasosdeJesus/m/-/work_items/40) D1). `m` lo
resuelve donde el consumidor lo tenga (`src/util/msip.ts`) y learn.tg usa esa vía; ver `doc/engines.md`
§12.1 en `m`.

Part A of learn.tg
[REQ/260](https://github.com/pasosdeJesus/learn.tg/issues/260), tracked in `m` as
[REQ/46](https://gitlab.com/pasosdeJesus/m/-/work_items/46). It publishes, for the whole pdJ ecosystem, the **real msip schema**
(`db/structure.sql`, **40 tables**: `usuario` —the learner/person, Devise + sip/msip + consumer columns—
and the `msip_*` catalogs, led by the geographic ones `msip_pais`, `msip_departamento`, `msip_municipio`,
`msip_centropoblado`). The motor **exports its whole schema**; each consumer declares the **subset** it
uses in its `m-engine.json` (`engines.msip.tables`).

The wallet ↔ person link (`billetera_usuario`) is **not** part of the model: it belongs to the
**`wallet` engine** (`@pasosdejesus/wallet`, REQ/50 D4/D9), which owns `billetera_usuario` /
`billetera_invitada` and its queries.

Consumers **keep** the model and **extend** it: extra columns, tables, indexes and triggers are expected,
not a deviation.

Tutoriales paso a paso:
- mínimo (catálogos): [`doc/msip-tutorial.md`](../../../doc/msip-tutorial.md) y
  [`doc/msip-demo.mjs`](../../../doc/msip-demo.mjs);
- completo (proyecto nuevo con `m:create` + contabilidad multiusuario):
  [`doc/msip-tutorial-contabilidad.md`](../../../doc/msip-tutorial-contabilidad.md).

## Usage

```ts
import {
  BASE_MODEL_VERSION, searchTowns, checkBaseModel,
  isSessionSubject, readProfile, updateProfile, setVisibility,
} from '@pasosdejesus/msip'

const db = { query: (text, params) => pool.query(text, params) }
const towns = await searchTowns(db, { countryId: 51, q: 'Bog' })
const report = await checkBaseModel(db)   // ok=false only on drift/absent
```

Wallet sign-in (`upsertUserByWallet`, `linkWallet`, `billetera_usuario`) now lives in the **`wallet`
engine** (`@pasosdejesus/wallet`).

`m` never creates a connection and never depends on a query builder at runtime:
the DB handle is injected as `SqlExecutor` (`pg`'s `query(text, values)` already
matches; over Kysely write a small adapter that maps the `$n` placeholders to
`sql.val(...)` and calls `db.executeQuery`).

With the CLI:

```sh
bin/m eng:msip:dump --from-structure db/structure.sql   # regenerate the baseline
bin/m eng:msip:dump --from-db --kept                   # from a live database
bin/m eng:verify --from-structure db/structure.sql # derivation guard
bin/m eng:check                                            # conformance of the live DB
```

## Versioning

`BASE_MODEL_VERSION` is independent from `m`'s version: changing a base column
is breaking for consumers even when `m`'s API does not change. A consumer
records the version it is on (`m_base_model` row) and runs the conformance check
in its test suite.

## Guidelines

1. **The base is additive and shared.** A consumer may add columns, tables,
   indexes and triggers. It may not remove, rename or reinterpret a base column;
   if the base itself must change, `m` publishes a new msip version and the
   consumers adopt it.
2. **Extensions must not break the base or another consumer.** New columns are
   nullable or carry a default, and they never change the meaning of a base
   column.
3. **The primary key of `usuario` is immutable** (foreign keys point at it): no
   renumbering, no re-creation, no `TRUNCATE`. The same holds for the catalogs
   identifiers.
4. **Wallets are lowercase**, stored and compared with
   `LOWER(billetera) = LOWER(?)`.
5. **The public name is `nusuario`**, never `nombre`; base queries do not expose
   `nombre` outside the owner-facing profile.
6. **Visibility flags are honored by every public surface.** The base exposes a
   generic visibility configuration (column names); every query that feeds a
   public listing must honor it, and the consumer declares those columns in its
   own migrations and documentation.
7. **Triggers are allowed and are the consumer's responsibility**: they must not
   change the result of a base query, and the consumer documents them.
8. **No PII in logs.**
9. **Extensions live in the consumer's own migrations**, never by editing the
   baseline, and are documented where that consumer documents its schema.
10. **A consumer declares the msip version it is on** and re-runs the
    conformance check when adopting a new one.

## Baseline, derivation and the check

- `baseline.generated.ts` is **generated** from a reference database
  (`eng:msip:dump`) and holds `BASELINE_SQL` (the DDL a fresh database starts
  from) and `BASELINE_INVENTORY` (columns, types, nullability, constraints).
- **The reference is msip-2.2's schema** (`packages/msip/db/structure.sql`, filtered to msip's own
  tables), the upstream schema of `usuario` and the `msip_*` catalogs. The manifest records its path and
  sha256, so a regeneration is reproducible.
- The baseline excludes foreign keys that point outside the base tables
  (`msip_tema`, `msip_tcentropoblado`, `religion`, …); they are
  listed in the manifest as `externalConstraints` and a consumer that has those
  tables adds them in its own migration.
- The model is **exactly** the reference: nothing to subtract and nothing to add. A project that already
  uses msip conforms without changes. `m` ships **no** built-in additions; a consumer declares whatever the
  model should have and msip does not (yet) at run time with `--additions <json>`.
- `--extensions <json>` is the opposite mechanism, for a **superset** reference: it lists columns the
  reference has but the model does not.
- The derivation guard (`eng:verify`) fails when the reference has a
  column that is neither in the base nor declared, and when a declared addition
  does not reach the baseline; it warns about additions the reference already
  has (redundant).
- The conformance check grades: `drift` (base table/column missing, changed
  type or nullability, base constraint missing) and `absent` (base table not
  created) fail; `extra` (consumer additions) is reported and never fails.
- The baseline applies to an **empty** database without consumer extensions,
  which is how a second consumer is validated ([REQ/260](https://github.com/pasosdeJesus/learn.tg/issues/260) acceptance
  criterion replaced by a fixture test here).

## Forward migrations ([REQ/46](https://gitlab.com/pasosdeJesus/m/-/work_items/46) D11)

The model ships its schema changes as **source**: one module per step in `forward/`,
exporting `{ from, to, slug, description, upSql, downSql }`, collected in order as
`BASE_MODEL_MIGRATIONS`. The SQL is a string in the module (type-checked and versioned with the
package).

```ts
import { BASE_MODEL_MIGRATIONS, splitSqlStatements } from '@pasosdejesus/msip'
```

```sh
bin/m eng:msip:setup                                # writes db/migrations/<ts>_base_model_<from>_<to>_<slug>.ts
bin/m eng:msip:setup --out db/migrations --check    # CI: exits non-zero when behind
bin/m db:migrate                                      # the consumer applies it
```

- `eng:msip:setup` writes only the steps the consumer is **missing** (a step counts as taken when
  its file exists), so re-running is safe; the first step is the 1.0.0 baseline (a fresh project
  needs no hand-written migration).
- `--check` writes nothing and exits non-zero when a step is missing: that is what a consumer's CI
  runs.
- Per **D12**, additive changes ship in a minor and restrictive ones in a major; every step ships
  an explicit `downSql` (a step that cannot be reverted safely must fail loudly).
- `eng:verify` runs the D12 guard (`checkMigrationPolicy`): it fails when a step has a
  restrictive change without a major bump, or when a step misses `downSql`.

## Wallet link → the `wallet` engine ([REQ/38](https://gitlab.com/pasosdeJesus/m/-/work_items/38), moved by [REQ/50](https://gitlab.com/pasosdeJesus/m/-/work_items/50) D4/D9)

`billetera_usuario` is **not** part of the base reference (msip-2.2 does not have it) and neither is
its sign-in logic: **both moved** to the **`wallet` engine** (`@pasosdejesus/wallet`), which groups the
DDL of reference and the queries and composes `msip` only for `usuario`. The identity is the **user**:
one `usuario` has **N** wallets.

```ts
import {
  WALLET_LINK_SEQUENCE_DDL, WALLET_LINK_DDL,          // + WALLET_INVITE_* for invitations
  getUserByWallet, listWallets, linkWallet, unlinkWallet, ensureWalletLink, upsertUserByWallet,
  inviteWallet, listInvitations, cancelInvitation, findPendingInvitation, acceptInvitation,
} from '@pasosdejesus/wallet'
```

- `UNIQUE (billetera)` (a wallet belongs to one user) and `UNIQUE (usuario_id, billetera)`; the
  `usuario_id` index is **not** unique. Addresses are normalized to lowercase.
- `linkWallet` never creates a user; `unlinkWallet` refuses to remove the user's last wallet;
  `upsertUserByWallet` onboards an unknown wallet (one account per wallet) but is idempotent.
- Invitations (`billetera_invitada`) use **partial** unique indexes (`WHERE used_at IS NULL AND
  cancelled_at IS NULL`), so re-inviting after a cancel or an expiry is allowed; expiry is enforced
  in the application (which also marks `cancelled_at`), since `now()` is not `IMMUTABLE` for an index
  predicate.

## Reference data

The geographic catalogs are reference data: their rows come from msip's
`db/datos-basicas.sql` (measured 2026-09-24: 251 countries, 78 departments,
1,758 municipalities, 44,493 populated centres). The motor ships a **small subset**
(`db/seed.sql.gz`: catalogs + país/departamento/municipio) that
`eng:msip:seed` loads; the **full dataset** is passed with `--file <sql>`
(`eng:msip:seed --file msip-2.2/db/datos-basicas.sql`). Selecting a partial subset
that respects foreign keys is an open problem ([REQ/39](https://gitlab.com/pasosdeJesus/m/-/work_items/39) §10/§11).
