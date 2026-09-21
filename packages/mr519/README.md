# @learn-tg/mr519 — Dynamic Forms Engine

> "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)

The **mr519 engine** provides the dynamic (survey/registry) form system used by
the pdJ ecosystem: form definitions stored in the database, served as JSON, and
rendered client-side by `DynamicForm`. It is the smallest of the three engines
(https://gitlab.com/pasosdeJesus/m/-/work_items/35 Fase 1) and is **consumed directly as source** — no `dist/` build, no
`exports` map. See [ARCHITECTURE.md](ARCHITECTURE.md) for the design.

## What it provides

| Engine | Route | Description |
|--------|-------|-------------|
| `mr519` | `GET /forms` | List forms from `mr519_gen_formulario` (id, nombre, nombreinterno, created_at) |
| `mr519` | `GET /forms/[id]` | Form + fields (`mr519_gen_campo`) + options (`mr519_gen_opcioncs`), ordered by fila/columna |
| `mr519` | `POST /forms/[id]/responses` | Authenticated submission: inserts `mr519_gen_respuestafor`, `mr519_gen_valorcampo` (multi-select tipos 8/9 → `valorjson`), `mr519_gen_encuestausuario` |
| `mr519-admin` | `POST /forms` | Admin (wallet/token) creates a form + fields + options |

## Usage

The host registers the engine lazily on first access through the engine
registry (`apps/nextjs/lib/engines.ts`, `ensureEnginesLoaded` →
`getEngineHandler`). The engine self-registers by importing the source directly:

```typescript
import { registerMr519 } from '@learn-tg/mr519/src/server/register'

registerMr519({
  db,
  authenticateUser,
  authenticateAdmin, // Mr519Deps — injected by the host (D2)
})
```

The parameterised routes are reachable through the same registry:
`getEngineHandler` matches the templates an engine registers (`GET /forms/[id]`,
`POST /forms/[id]/responses`), so `GET /api/engine/mr519/forms/3` reaches
`makeGetFormById`. Before 2026-09-21 only exact keys matched and those routes
answered 404 (tests: `apps/nextjs/app/api/engine/__tests__/mr519-forms.test.ts`).

## Exports

No package `exports` map — the package is consumed as **TypeScript source**
via `@learn-tg/mr519/src/server/register`. This is intentional: the engine is
tiny, has no contract/ABI layer, and is only consumed by this app.

## Source layout (`src/`)

| Path | Content |
|------|---------|
| `server/deps.ts` | `Mr519Deps` interface (`db()`, `authenticateUser`, `authenticateAdmin`) |
| `server/register.ts` | `registerMr519(deps)` — registers engines `mr519` and `mr519-admin` via the core's `registerEngine` (lazy imports) |
| `server/forms/route.ts` | `makeGetForms` (list) |
| `server/forms/by-id/route.ts` | `makeGetFormById` (form + fields + options) |
| `server/forms/by-id-responses/route.ts` | `makePostResponse` (authenticated submission) |
| `server/admin/forms/route.ts` | `makePostAdminForm` (admin creates form) |
| `components/DynamicForm.tsx` | Client-side renderer of a form definition by field `tipo` (0 entero … 10 SS tabla básica), required-field validation, `onSubmit(values)` |

## Testing

The package has no vitest suite of its own (deliberate: D2 makes the route
factories injectable — see ARCHITECTURE.md). What exists today is the registry test
in the host app, `apps/nextjs/app/api/engine/__tests__/route.test.ts` (4 cases:
`mr519` and `mr519-admin` registered, unknown engine/path → null), plus the
end-to-end surface through `/api/engine/mr519/*`. **Adding a form-definition test
(list, by-id with fields/options, submission inserting `respuestafor` +
`valorcampo`) is the outstanding gap** before the first course uses it.

## Why it exists (roadmap)

The engine is kept **on purpose**, not as dormant code: courses that require a
purchase (or a verification step) need to **characterise the person who pays** —
today the Global Disciples course (pastor/cluster data) and next the Small Business
Development course (https://github.com/pasosdeJesus/learn.tg/issues/257). Instead of
a bespoke form per course, the definition lives in the database and `DynamicForm`
renders it, so a new characterisation form is data, not code.

Current state (verified 2026-09-21): the infrastructure is ready and registered, but
**no page uses `DynamicForm` yet**; the pending items are tracked in
https://github.com/pasosdeJesus/learn.tg/issues/204 (course gate before rendering,
`nombreinterno` validation, `ancho`/`columna`/`fila` grid layout, `PUT` to update a
form).
