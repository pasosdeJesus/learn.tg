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

### Tools

- **Vitest** with `--coverage` (v8 provider).
- **`@pasosdejesus/m/test-utils`** for reusable mocks (database, viem, rainbowkit, radix, fs). See [`@pasosdejesus/m/test-utils`](../node_modules/@pasosdejesus/m/dist/test-utils/README.md).
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

### Coverage Status (Verified)

| Layer | Status |
|-------|--------|
| API Routes | ✅ 100% — auth, content, rewards, metrics, users |
| Libraries (`lib/`) | ✅ 100% — crypto, scores, guide-utils, metrics-server, deeplink |
| UI Components | ✅ 100% — Layout, headers, modals, buttons, pages |
| Pages | ✅ 100% — landing, course, guide, profile, metrics |

### Running Tests

```bash
# From apps/nextjs/
make test           # Run all tests
make type           # TypeScript check (source only)
pnpm coverage       # With coverage report
pnpm test:ui        # Interactive Vitest UI
```
