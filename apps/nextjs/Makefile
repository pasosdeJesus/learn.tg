
# ── Build ──────────────────────────────────────────────────────────────
# La máquina real es compartida (prod learn.tg + dev learn.tg:9001, 16G RAM +
# 16G swap). NO compilar mientras el sitio de desarrollo sirve requests o se
# está ejecutando la suite E2E: 8 workers × 2048 MB todavía compiten con el
# dev server y el resto de apps → OOM (REQ/35 §12.8). Detener `next dev` y los
# specs E2E antes de `make all`/`make prod`.
build-guard:
	@if pgrep -f '[n]ext d''ev' >/dev/null 2>&1; then \
	  echo "ERROR: el sitio de desarrollo está activo (dev server corriendo)." ; \
	  echo "Detén el dev server antes de compilar (misma máquina, 16G RAM)." ; \
	  exit 1 ; \
	fi

all: build-guard
	rm -rf .next
	pnpm i
	$(MAKE) swc-wasm
	# Máquina real: 16G RAM + swap, otras apps. 15 workers × heap grande = OOM.
	# 8 workers × 2048 MB (webpack.parallelism en next.config.ts, REQ/35 gate).
	NODE_OPTIONS="--max-old-space-size=2048" WEBPACK_PARALLELISM=8 pnpm exec next build --webpack

type-source:
	pnpm tsc --noEmit

type-check-tests:
	pnpm tsc --noEmit -p tsconfig.test.json

type: css-check
	pnpm typecheck

css-check:
	@find app components lib -name '*.css' -o -name '*.scss' 2>/dev/null | \
	xargs node -e "const fs=require('fs'),pc=require('postcss');let ok=0,err=0;for(const f of process.argv.slice(1)){try{pc.parse(fs.readFileSync(f,'utf8'));ok++}catch(e){console.error(f+': '+e.message.split('\n')[0]);err++}};console.log('CSS: '+(ok+err)+' files, '+err+' errors');process.exit(err?1:0)"

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

prod: build-guard swc-wasm
	NODE_OPTIONS="--max-old-space-size=2048" WEBPACK_PARALLELISM=8 pnpm exec next build --webpack
	./bin/start > prod.log 2>&1 &

# Next.js 16 SWC wasm fallback: OpenBSD has no native bindings and the
# on-demand download leaves node_modules/next/wasm empty (REQ/205).
.PHONY: swc-wasm
swc-wasm:
	mkdir -p node_modules/next/wasm/@next/swc-wasm-nodejs
	cp node_modules/@next/swc-wasm-nodejs/wasm.js node_modules/@next/swc-wasm-nodejs/wasm_bg.wasm node_modules/next/wasm/@next/swc-wasm-nodejs/

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
