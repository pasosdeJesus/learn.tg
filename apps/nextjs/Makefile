
all:
	pnpm i
	pnpm build

type-source:
	pnpm tsc --noEmit

type-check-tests:
	pnpm tsc --noEmit -p tsconfig.test.json

type:
	pnpm typecheck

format:
	pnpm format

test:
	pnpm test

dev:
	./bin/dev

prod:
	pnpm build
	./bin/start > prod.log 2>&1 &

