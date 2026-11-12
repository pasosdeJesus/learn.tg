.PHONY: build all type test clean

build:
	(cd ../.. && pnpm install)
	pnpm build

all: build

type:
	pnpm tsc

test:
	pnpm test

clean:
	pnpm clean
