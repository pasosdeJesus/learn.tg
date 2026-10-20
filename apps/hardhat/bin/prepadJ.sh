#!/bin/sh
#
# prepadJ.sh — OpenBSD/adJ Hardhat compatibility (pnpm version)
#
# Compiles the @nomicfoundation/solidity-analyzer native addon for OpenBSD.
# Without it, `hardhat compile` fails because the platform has no prebuilt
# binary (Unsupported OS: openbsd).
#
# Prerequisites:
#   corepack (ships with Node) and Rust/cargo (the addon is built from source).
# `doas corepack enable` is optional: it only exposes `yarn` directly; this
# script calls `corepack yarn`, so it works without the global shim.
#
# Usage:
#   cd apps/hardhat
#   sh bin/prepadJ.sh
#
set -e

APP=$(cd "$(dirname "$0")/.." && pwd)
ROOT=$(cd "$APP/../.." && pwd)

echo "=== prepadJ: OpenBSD Hardhat compatibility (pnpm) ==="

# The virtual store lives at the workspace root; older layouts kept it in the app.
SOLA_DIR=""
for STORE in "$ROOT/node_modules/.pnpm" "$APP/node_modules/.pnpm" "$APP/../node_modules/.pnpm"; do
  [ -d "$STORE" ] || continue
  FOUND=$(find "$STORE" -maxdepth 1 -name "@nomicfoundation+solidity-analyzer@*" -type d | head -1)
  if [ -n "$FOUND" ]; then
    SOLA_DIR="$FOUND"
    break
  fi
done
if [ -z "$SOLA_DIR" ]; then
  echo "ERROR: solidity-analyzer not found. Run: pnpm install"
  exit 1
fi
SOLA_SRC="$SOLA_DIR/node_modules/@nomicfoundation/solidity-analyzer"
echo "solidity-analyzer: $SOLA_SRC"

if [ -f "$SOLA_SRC/solidity-analyzer.openbsd-x64.node" ]; then
  echo "Native addon already exists — skipping build"
  exit 0
fi

sed -e 's/freebsd/openbsd/g' "$SOLA_SRC/index.js" > /tmp/sa-index.js
# Break the hard link first: writing over it would patch the shared pnpm store.
rm -f "$SOLA_SRC/index.js"
cp /tmp/sa-index.js "$SOLA_SRC/index.js"
rm -f /tmp/sa-index.js
echo "Patched index.js (freebsd → openbsd)"

TMPDIR=$(mktemp -d /tmp/sa-build.XXXXXX)
echo "Building in temp directory: $TMPDIR"
cp -r "$SOLA_SRC"/* "$TMPDIR"/
cp "$SOLA_SRC"/.yarnrc.yml "$TMPDIR"/ 2>/dev/null || true
cp "$SOLA_SRC"/.yarnrc "$TMPDIR"/ 2>/dev/null || true
cp "$SOLA_SRC"/Cargo.toml "$TMPDIR"/ 2>/dev/null || true
cp -r "$SOLA_SRC"/src "$TMPDIR"/ 2>/dev/null || true
cp -r "$SOLA_SRC"/build.rs "$TMPDIR"/ 2>/dev/null || true

cd "$TMPDIR"
echo "Installing dependencies (corepack yarn)..."
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack yarn
echo "Building native addon..."
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack yarn build

NODE_FILE=$(ls *.node 2>/dev/null | head -1)
if [ -z "$NODE_FILE" ]; then
  NODE_FILE=$(find . -name "*.node" -type f | head -1)
fi
if [ -z "$NODE_FILE" ]; then
  echo "ERROR: No .node file produced. Check build output."
  exit 1
fi
NODE_FILE_ABS="$TMPDIR/$NODE_FILE"

cd "$APP"
cp "$NODE_FILE_ABS" "$SOLA_SRC/"
echo "Copied $NODE_FILE to $SOLA_SRC"

rm -rf "$TMPDIR"

echo "=== prepadJ: Verifying with pnpm build ==="
# `hardhat compile` loads the config, which rejects a short account key. When the
# project has no `.env` yet, use a throwaway 32-byte key so the check does not
# depend on the operator's secrets.
if [ -z "${PRIVATE_KEY:-}" ] && [ ! -f "$ROOT/apps/.env" ] && [ ! -f "$APP/.env" ]; then
  echo "No .env yet: verifying with a throwaway PRIVATE_KEY"
  PRIVATE_KEY="0x1111111111111111111111111111111111111111111111111111111111111111"
  export PRIVATE_KEY
fi
# `pnpm build` would also run `tsc`, which today fails on the test files' missing
# mocha typings (pre-existing debt). The addon is verified by compiling instead.
pnpm compile
echo "=== prepadJ: Done ==="
