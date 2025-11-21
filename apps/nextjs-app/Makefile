
all:
	pnpm i
	pnpm build

syntax:
	pnpm typecheck

test:
	pnpm test

dev:
	./bin/dev

prod:
	pnpm build
	./bin/start > prod.log 2>&1 &

