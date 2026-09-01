# @learn-tg/mr519 — Architecture

## Overview

The mr519 engine implements the **dynamic forms** subsystem: survey/registry
forms whose definition (fields, options, types) lives in the database and can
be created at runtime by an admin, filled by authenticated users, and rendered
by a generic client component. The name follows the MSIP/cor1440 family
(`mr519_gen_formulario`, `mr519_gen_campo`, `mr519_gen_opcioncs`,
`mr519_gen_respuestafor`, `mr519_gen_valorcampo`,
`mr519_gen_encuestausuario`).

## Design decisions

### D1 — Source consumption (no dist build)

Unlike `rewards` and `gdcluster` (compiled to `dist/` and consumed via
`exports`), mr519 is consumed **directly as TypeScript source**
(`@learn-tg/mr519/src/server/register`). Rationale:

- The package has no contracts, no ABIs, no on-chain logic — nothing that
  benefits from precompilation.
- It is only consumed by learn.tg (no second consumer), so build-time savings
  of `tsc` are irrelevant.
- Keeps the engine tree free of `dist/` churn.

### D2 — Dependency injection

`registerMr519(deps)` receives `db()`, `authenticateUser`, and
`authenticateAdmin` from the host. Route handlers are created per-dependency
via curried factories (`makeGetForms`, `makeGetFormById`, `makePostResponse`,
`makePostAdminForm`), which keeps them unit-testable without mocking modules.

### D3 — Lazy registration through the engine registry

The core's `lib/engines.ts` uses `createRegistry('learn-tg:engine')` from
`@pasosdejesus/m/engine`. mr519 **self-registers on lazy load**:
`getEngineHandler` → `ensureEnginesLoaded` imports the register module once,
which registers engines `mr519` and `mr519-admin`. No top-level import in the
core means no startup cost when no form is ever requested.

## Data model (DB tables, owned by the host schema)

| Table | Role |
|-------|------|
| `mr519_gen_formulario` | Form header (id, nombre, nombreinterno) |
| `mr519_gen_campo` | Field definitions (tipo, label, fila/columna ordering) |
| `mr519_gen_opcioncs` | Options for select/radio fields |
| `mr519_gen_respuestafor` | A submission (per user + form) |
| `mr519_gen_valorcampo` | Values per field (multi-select tipos 8/9 → `valorjson`) |
| `mr519_gen_encuestausuario` | Survey↔user linkage |

## Request flow

```
GET  /forms            → list forms (id, nombre, nombreinterno)
GET  /forms/[id]       → form + fields + options (ordered by fila/columna)
POST /forms/[id]/responses → authenticateUser (wallet + token)
                         → insert respuestafor + valorcampo + encuestausuario
POST /forms (mr519-admin)  → authenticateAdmin (verifier wallet)
                         → create formulario + campos + opcioncs
```

The admin creation endpoint takes the wallet/token as query/body params and
validates them through `authenticateAdmin` (verifier wallet check, per the
Admin API Authentication rules in the root ARCHITECTURE.md).

## Client rendering

`DynamicForm` renders any form definition client-side: field type `tipo`
(0 entero … 10 SS tabla básica), required-field validation, and
`onSubmit(values)`. It never fetches — the host page fetches
`/api/forms/[id]` and passes the definition as props.

## Relationship with other engines

| Engine | Relation |
|--------|----------|
| `@learn-tg/rewards` | none (no on-chain interaction) |
| `@learn-tg/gdcluster` | `engine.json` of gdcluster declares `requires: mr519`; no runtime coupling |

## Testing

No own suite; covered by host API tests (`apps/nextjs`, `make test-api`).
