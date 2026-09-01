# @learn-tg/mr519 — Dynamic Forms Engine

> "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)

The **mr519 engine** provides the dynamic (survey/registry) form system used by
the pdJ ecosystem: form definitions stored in the database, served as JSON, and
rendered client-side by `DynamicForm`. It is the smallest of the three engines
(REQ/35 Fase 1) and is **consumed directly as source** — no `dist/` build, no
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

The engine has no test suite of its own (no vitest in devDependencies). Its
routes are exercised through the host app's API tests in `apps/nextjs`
(`make test-api`).
