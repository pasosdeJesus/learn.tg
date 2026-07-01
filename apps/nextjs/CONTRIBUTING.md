# Contributing to learn.tg — Next.js

> *"Whatever you do, work at it with all your heart, as working for the Lord, not for human masters"* (Colossians 3:23, CSB)

This document defines the documentation and testing policies for the Next.js application. For project-wide conventions (structure, languages, code style), see the root [CONTRIBUTING.md](../CONTRIBUTING.md). For available commands (`make test`, `make type`), see [README.md](README.md).

---

## Documentation Policy

### Principles

1. **Good names > Comments.** Self-documenting code with descriptive names is the best documentation.
2. **Tests > JSDoc.** A well-written test documents expected behavior and verifies itself. JSDoc ages poorly and we don't use it.
3. **Document the "why", not the "what".** The "what" is in the code. The "why" (design decisions, platform constraints, protocols) is what deserves explanation.
4. **Architecture and tool documentation.** What actually adds value: flow diagrams, cross-system protocols, API guides, custom tool manuals.

### What We Document

| Type | Location | Purpose | Example |
|------|----------|---------|---------|
| Directory index | `lib/README.md`, `db/README.md`, `app/api/README.md` | Brief map of what's in the directory, references to `doc/` for complex topics | |
| Feature/protocol | `doc/<feature>.md` | Self-contained document that can be understood without reading the codebase. Potentially reusable in other projects. | `doc/crossword-reward-flow.md` |
| Module comments | Top of `.ts` files with complex logic | Protocol details, design rationale, external references. | `lib/crypto.ts` |

### Decision Criterion: `doc/` vs. Inline Comment

| Criterion | Where | Example |
|-----------|-------|---------|
| Cross-system protocol or cross-project reusable design | `doc/<feature>.md` | Crossword reward flow (check-crossword ↔ scores ↔ contract), SIWE auth flow |
| Internal module decision — *why* this implementation, not another | Comment at top of `.ts` file | Nonce retry in `crypto.ts`, MiniPay detection in `Header.tsx` |
| What the code does, how it behaves | **Test** | `crypto.test.ts` documents every retry and error case |

### What We Don't Document

- **JSDoc on functions** — tests and descriptive names are sufficient.
- **Obvious line comments** — `// increment counter` next to `counter++` adds nothing.
- **Documentation that duplicates tests** — if a test covers a case, no need to explain it in prose.

### Format

- All code (variable names, comments, commit messages) and documentation in English. Spanish is only acceptable for domain-specific content (e.g., course titles, Bible verses).
- `doc/` documents are feature-specific, self-contained, and potentially migrable to `@pasosdejesus/m`.

---

## Testing Policy

### Principles

1. **Tests > JSDoc.** A test is living documentation that never goes out of date.
2. **Coverage focused by layer.** Not everything deserves the same effort.

### Coverage Targets

| Layer | Target | Priority |
|-------|--------|----------|
| Critical logic (`lib/`, `api/`) | 80-90% | High |
| Hooks (`lib/hooks/`) | 60-70% | Medium |
| UI components (`components/`) | 30-50% | Low |

### What to Test First

1. **Money-touching code** — crossword rewards, Learning Points, balance, signatures.
2. **Integration flows** — full reward pipeline (submit crossword → validate → update scores → contract call).
3. **Edge cases** — nonce out of order, retries, insufficient balance, invalid signatures, network timeouts.
4. **Error handling** — wallet errors, backend errors, user-friendly messages.

### E2E Tests (Puppeteer)

Browser-level end-to-end tests live in `test/puppeteer/`. They validate full user
flows against production (`https://learn.tg`) — SIWE authentication, session
persistence across navigation, and "Partial login" guard behavior.

- **Dependencies:** `puppeteer-core` (solo core funciona en OpenBSD). 
  Instalar con `cd test/puppeteer && npm install`.
- **SIWE/viene resuelto** vía `NODE_PATH=../../node_modules`.
- **Ejecución:** 
  ```bash
  cd apps/nextjs/test/puppeteer
  NODE_PATH=../../node_modules CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg node session-persistence.mjs
  ```
- **OpenBSD:** Requiere `--ozone-platform=headless` para Chrome 141+.
  Limpiar `/tmp/puppeteer*` entre ejecuciones si Chrome se cuelga.

| Test | Qué valida |
|------|-----------|
| Test 1 | `/en` sin auth → NO muestra "Partial login" |
| Test 2 | SIWE → navegación `/en` → curso → guía → `/en` → sin "Partial login" |
| Test 3 | `/en/profile` sin SIWE → SÍ muestra "Partial login" (guard estricto) |

Exit code > 0 si algún test falla (compatible con CI).

### Tools

- **Vitest** with `--coverage` (v8 provider).
- **`@pasosdejesus/m/test-utils`** for reusable mocks (database, viem, rainbowkit, radix, fs). See `node_modules/@pasosdejesus/m/src/test-utils/README.md`.
- **`test-utils/`** for learn.tg-specific mocks: `learn-tg-mocks.ts`, `crossword-mocks.ts`. See [`test-utils/README.md`](test-utils/README.md).
- **`vi.mock`** for module mocking.
- **`// @vitest-environment jsdom`** pragma for React hook tests.

### Mock Usage

```typescript
// Import mocks BEFORE importing modules under test
import '@pasosdejesus/m/test-utils/radix-mocks'
import { setupApiMocks } from '@/test-utils/learn-tg-mocks'
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

beforeAll(() => {
  setupApiMocks()
  apiDbMocks.setupMocks()
})
```

**Import order:** 1) Import mock utilities → 2) Setup mocks in `beforeAll` → 3) Import modules under test → 4) Configure mock responses in `beforeEach`

**Mock lifecycle:** `setup*Mocks()` in `beforeAll` · `reset*Mocks()` in `beforeEach` · `vi.clearAllMocks()` in `afterEach`

### Coverage Status (Current)

| Layer | Statements | Notes |
|-------|-----------|-------|
| Core lib/ (crypto, scores, guide-utils, etc.) | 88-100% | Excellent. Edge cases: nonces, retries, errors |
| API Routes (check-crossword, update-scores, scholarship, etc.) | 12 routes tested | Missing: `transparency`, `user-transactions/[id]` |
| Hooks (useFetchData, useApiData, useGuideData, useSort, etc.) | 75-100% | Newer hooks (useScholarshipData, useGuideNavigation) now tested |
| UI Components (shadcn) | 96-100% | Structural tests: render, props, className, refs |
| Custom components (Header, Footer, DonateModal, etc.) | 90-100% | Complex modals and wallet flows covered |
| **Overall project** | **~55% statements** | Weighted down by untested scripts/ (0%) and migrations/ (0%) |

### Untested Code (Low Priority)

| File | Lines | Reason |
|------|-------|--------|
| `scripts/` | ~2,500 | CLI maintenance scripts — impractical to test |
| `db/migrations/` | ~1,100 | One-shot schema migrations |
| `lib/leaderboard-queries.ts` | ~190 | Complex SQL — needs DB integration test |
| `lib/ability.ts` | ~24 | Static CASL rules — low risk |
| `lib/user-transactions.ts` | ~43 | Simple query passthrough |

### Running Tests

```bash
# From apps/nextjs/

# ── Fast (no coverage, parallel-safe sub-targets) ──
make test           # Run all tests (6 sub-targets in sequence)
make test-lib       # Only lib/__tests__
make test-hooks     # Only lib/hooks/__tests__
make test-api       # Only app/api
make test-components # Only components/__tests__ + components/ui/__tests__ + providers/__tests__
make test-pages     # Only app/__tests__ + app/[lang]/**/__tests__
make test-db        # Only db/__tests__

# ── Type checking ──
make type           # TypeScript check (source + test files)

# ── Coverage (slow, runs all tests at once) ──
make coverage       # pnpm coverage with v8 provider

# ── Interactive ──
pnpm test:ui        # Interactive Vitest UI
```

**Why sub-targets?** On OpenBSD, running all tests at once via `pnpm coverage`
can hit esbuild memory limits. The sub-targets run isolated Vitest processes
that stay within safe memory bounds. They also complete faster since they
don't generate coverage reports.
