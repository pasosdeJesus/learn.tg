# @learn-tg/pdj-wallet-next — build y pruebas unitarias (R-#237)
#
# Las pruebas usan el vitest de la app y su config (jsdom + Testing Library);
# el core se resuelve por alias a `../pdj-wallet/dist/index.js`, así que hay que
# compilarlo antes:
#
#   make -C ../pdj-wallet build
#   make test
#
# Desde la app: `make -C apps/nextjs test-pdj-wallet-next` (ese target compila
# el core por ti vía engines-dist).

VITEST = ../../apps/nextjs/node_modules/.bin/vitest
TSC = ../../apps/nextjs/node_modules/.bin/tsc

.PHONY: build test

build:
	$(TSC) -b

test:
	$(VITEST) run --config vitest.config.ts
