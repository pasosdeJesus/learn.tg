
all:
	rm -rf .next
	pnpm i
	NODE_OPTIONS="--max-old-space-size=8192" pnpm build

type-source:
	pnpm tsc --noEmit

type-check-tests:
	pnpm tsc --noEmit -p tsconfig.test.json

type:
	pnpm typecheck

format:
	pnpm format

# ── Tests rápidos sin coverage ──────────────────────────────────────────

test: test-lib test-hooks test-api test-components test-pages test-db

test-lib:
	pnpm vitest run lib/__tests__

test-hooks:
	pnpm vitest run lib/hooks/__tests__

test-api:
	pnpm vitest run app/api

test-components:
	pnpm vitest run components/__tests__ components/ui/__tests__ providers/__tests__

test-pages:
	pnpm vitest run app/__tests__ \
		'app/[lang]/__tests__' \
		'app/[lang]/profile/__tests__' \
		'app/[lang]/[pathPrefix]/__tests__' \
		'app/[lang]/[pathPrefix]/[pathSuffix]/__tests__' \
		'app/[lang]/[pathPrefix]/[pathSuffix]/test/__tests__'

test-db:
	pnpm vitest run db/__tests__

# ── Coverage (lento, incluye todos los tests) ────────────────────────────

coverage:
	pnpm coverage

# ── Dev / Prod ──────────────────────────────────────────────────────────

dev:
	./bin/dev

prod:
	NODE_OPTIONS="--max-old-space-size=8192" pnpm build
	./bin/start > prod.log 2>&1 &

# ── E2E Tests ───────────────────────────────────────────────────────────

# Smoke tests (HTTP, fast, no Chrome needed)
test-smoke:
	./bin/m test:e2e --smoke

# Full E2E tests (Puppeteer + Chrome, requires CHROME_PATH)
test-e2e:
	./bin/m test:e2e

# Run a specific E2E spec
test-e2e-%:
	./bin/m test:e2e $*
