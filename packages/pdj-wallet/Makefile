# @learn-tg/pdj-wallet — build y pruebas unitarias (R-#236)
#
# Las pruebas se ejecutan con el vitest de la app (este paquete trae su propio
# vitest.config.ts, que aliasa `viem` a apps/nextjs/node_modules), así que para
# correrlas no hace falta instalar nada aquí:
#
#   make test          # en este directorio
#   make -C apps/nextjs test-pdj-wallet     # desde la app
#   make -C apps/nextjs test-packages       # los dos paquetes
#
# `pnpm install` aquí solo es necesario para importar `dist/` desde Node (los
# specs E2E de R-#239), porque Node ESM resuelve `viem` desde esta carpeta.
# Ver doc/pdj-wallet-testing.md y doc/e2e-testing.md.

VITEST = ../../apps/nextjs/node_modules/.bin/vitest
TSC = ../../apps/nextjs/node_modules/.bin/tsc

.PHONY: install build test

install:
	pnpm install

build:
	$(TSC) -b

test:
	$(VITEST) run --config vitest.config.ts
