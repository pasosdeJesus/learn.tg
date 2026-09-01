
# ── Build ──────────────────────────────────────────────────────────────
# La máquina real es compartida (prod learn.tg + dev learn.tg:9001, 16G RAM +
# 16G swap). NO compilar mientras el sitio de desarrollo sirve requests o se
# está ejecutando la suite E2E: 8 workers × 2048 MB todavía compiten con el
# dev server y el resto de apps → OOM (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §12.8). Detener `next dev` y los
# specs E2E antes de `make all`/`make prod`.
build-guard:
	@if pgrep -f '[n]ext d''ev' >/dev/null 2>&1; then \
	  echo "ERROR: el sitio de desarrollo está activo (dev server corriendo)." ; \
	  echo "Detén el dev server antes de compilar (misma máquina, 16G RAM)." ; \
	  exit 1 ; \
	fi

# Motores (https://gitlab.com/pasosdeJesus/m/-/work_items/35 Fase 4): consumidos vía dist/ (exports map); dist/ no está en
# git. Compilar antes del build — un checkout fresco no resuelve
# @learn-tg/{rewards,gdcluster} sin esto. Orden: rewards antes que gdcluster.
engines-dist:
	@for e in rewards gdcluster; do \
	  if [ -d "../../packages/$$e" ]; then \
	    echo "[engines-dist] compilando packages/$$e"; \
	    (cd "../../packages/$$e" && ../../apps/nextjs/node_modules/.bin/tsc -b) || exit 1; \
	  fi; \
	done

# Sync de ABIs (https://gitlab.com/pasosdeJesus/m/-/work_items/35 Fase 4): los motores guardan COPIA en src/abis/. Al
# regenerar abis en hardhat, copiar y recompilar.
engines-sync-abis:
	@for e in rewards gdcluster; do \
	  if [ -d "../../packages/$$e/src/abis" ]; then \
	    echo "[engines-sync-abis] abis -> packages/$$e/src/abis"; \
	    cp -f abis/*.json "../../packages/$$e/src/abis/" 2>/dev/null || true; \
	    (cd "../../packages/$$e" && ../../apps/nextjs/node_modules/.bin/tsc -b) || exit 1; \
	  fi; \
	done

# Assets del motor gdcluster (https://gitlab.com/pasosdeJesus/m/-/work_items/35): gdcluster.svg vive en el motor
# (assets/) y se copia a public/ (convención create-course.sh:
# public/img/credential/$ICON_PATH servido por URL).
engines-assets:
	@if [ -d "../../packages/gdcluster/assets" ]; then \
	  mkdir -p public/img/credential/source; \
	  cp -f ../../packages/gdcluster/assets/*.svg public/img/credential/source/ 2>/dev/null || true; \
	fi

all: build-guard engines-dist engines-assets
	rm -rf .next
	pnpm i
	$(MAKE) swc-wasm
	# Máquina real: 16G RAM + swap, otras apps. 15 workers × heap grande = OOM.
	# 8 workers × 2048 MB (webpack.parallelism en next.config.ts, https://gitlab.com/pasosdeJesus/m/-/work_items/35 gate).
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

# La suite COMPLETA en una sola corrida necesita más memoria (esbuild WASM en
# OpenBSD/adJ: los 6 sub-objetivos juntos superan el ulimit -d por defecto y
# crashean el worker de V8). Sube el límite de datos y ejecuta los
# sub-objetivos recursivamente bajo él. Los sub-objetivos individuales no lo
# necesitan.
test:
	@ulimit -d 8000000 2>/dev/null || true; \
	$(MAKE) test-lib test-hooks test-api test-components test-pages test-db

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

prod: build-guard engines-dist engines-assets swc-wasm
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
# 12s de aire entre specs: el dev site (16G compartido) limita por wallet/IP
# (429) y bajo carga los specs de timing flaquean (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §12.8).
test-e2e:
	E2E_SPEC_DELAY_MS=12000 ./bin/m test:e2e

# Run a specific E2E spec
test-e2e-%:
	./bin/m test:e2e $*
