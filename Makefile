.PHONY: all install env-check build test type check engines-dist

# `all` vive en la raíz del workspace: una sola instalación para todas las apps.
all: install env-check engines-dist build

install:
	pnpm i

# Avisos de variables de entorno renombradas (informativo, no falla).
env-check:
	@./apps/web/bin/m env:check || true

# Next 16 con Webpack: V8 crashea (Trace/BPT trap) con el límite de data por
# defecto en adJ/OpenBSD, así que el build sube a 7G. Los motores se compilan
# antes (`dist/` está gitignored y la app los importa por su exports map).
build: engines-dist
	@sh -c 'ulimit -d 7340032 && pnpm -r --if-present build'

test:
	@echo "Running tests in apps/web..."
	@(cd apps/web && $(MAKE) test)
	@echo "Running tests in apps/contracts..."
	@(cd apps/contracts && $(MAKE) test)

type:
	@echo "Type-checking in apps/web..."
	@(cd apps/web && $(MAKE) type)
	@echo "Type-checking in apps/contracts..."
	@(cd apps/contracts && $(MAKE) type)

# Motores (rewards, gdcluster y los vendorizados de `m`): se compilan antes del
# build de la app.
engines-dist:
	@(cd apps/web && $(MAKE) engines-dist)

# Estructura (REQ/56) y direcciones de despliegue (REQ/60).
check:
	@./apps/web/bin/m m:check
	@./apps/web/bin/m contract:checkdeploy

# Solo la estructura (sin revisar los JSON de deployments, que dependen de la
# máquina: los artefactos son gitignored y no están en todos los clones).
check-structure:
	@./apps/web/bin/m m:check
