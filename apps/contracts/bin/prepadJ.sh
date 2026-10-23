#!/bin/sh
#
# prepadJ.sh — OpenBSD/adJ Hardhat compatibility (pnpm version)
#
# Compiles the @nomicfoundation/solidity-analyzer native addon for OpenBSD and
# patches every installed copy so Hardhat accepts the platform. `pnpm install`
# recreates node_modules (the patch lives there), so `pnpm build` runs this
# script on OpenBSD before compiling.
#
# Prerequisites:
#   corepack (ships with Node) and Rust/cargo (the addon is built from source).
#   `doas corepack enable` is optional: this script calls `corepack yarn`, so it
#   works without the global shim.
#
# Usage:
#   cd apps/contracts
#   sh bin/prepadJ.sh        # or: pnpm prepadJ
#
set -e

APP=$(cd "$(dirname "$0")/.." && pwd)
ROOT=$(cd "$APP/../.." && pwd)

if [ "$(uname -s)" != "OpenBSD" ]; then
  echo "=== prepadJ: $(uname -s) needs no OpenBSD addon — skipping ==="
  exit 0
fi

echo "=== prepadJ: OpenBSD Hardhat compatibility (pnpm) ==="

TARGETS=$(mktemp /tmp/sa-targets.XXXXXX)
NEED_PATCH=$(mktemp /tmp/sa-patch.XXXXXX)
NEED_BUILD=$(mktemp /tmp/sa-build-list.XXXXXX)
BUILD_DIR=""
cleanup() {
  rm -f "$TARGETS" "$NEED_PATCH" "$NEED_BUILD"
  if [ -n "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
  fi
}
trap cleanup EXIT INT TERM

# Hardhat resolves the analyzer through its own node_modules link, which can
# point at the workspace root virtual store even when the app kept an older one.
# Patch/build every copy found: the root store first, then the app.
for STORE in "$ROOT/node_modules/.pnpm" "$APP/node_modules/.pnpm"; do
  [ -d "$STORE" ] || continue
  for DIR in "$STORE"/@nomicfoundation+solidity-analyzer@*; do
    [ -d "$DIR" ] || continue
    SRC="$DIR/node_modules/@nomicfoundation/solidity-analyzer"
    [ -f "$SRC/index.js" ] || continue
    grep -qxF "$SRC" "$TARGETS" 2>/dev/null || echo "$SRC" >> "$TARGETS"
  done
done

if [ ! -s "$TARGETS" ]; then
  echo "ERROR: solidity-analyzer not found. Run: pnpm install"
  exit 1
fi

while IFS= read -r SRC; do
  echo "solidity-analyzer: $SRC"
  grep -q 'case "openbsd"' "$SRC/index.js" || echo "$SRC" >> "$NEED_PATCH"
  [ -f "$SRC/solidity-analyzer.openbsd-x64.node" ] || echo "$SRC" >> "$NEED_BUILD"
done < "$TARGETS"

if [ ! -s "$NEED_PATCH" ] && [ ! -s "$NEED_BUILD" ]; then
  echo "Native addon and platform patch already present — skipping build"
  exit 0
fi

while IFS= read -r SRC; do
  sed -e 's/freebsd/openbsd/g' "$SRC/index.js" > "$SRC/index.js.prepadJ"
  # Break the hard link first: writing over it would patch the shared pnpm store.
  rm -f "$SRC/index.js"
  mv "$SRC/index.js.prepadJ" "$SRC/index.js"
  echo "Patched index.js (freebsd -> openbsd): $SRC"
done < "$NEED_PATCH"

if [ -s "$NEED_BUILD" ]; then
  if ! command -v corepack >/dev/null 2>&1; then
    echo "ERROR: corepack not found (it ships with Node)."
    exit 1
  fi
  if ! command -v cargo >/dev/null 2>&1; then
    echo "ERROR: Rust/cargo not found; the OpenBSD addon is built from source."
    exit 1
  fi
  BASE=$(head -1 "$NEED_BUILD")
  BUILD_DIR=$(mktemp -d /tmp/sa-build.XXXXXX)
  echo "Building in temp directory: $BUILD_DIR"
  cp -r "$BASE"/* "$BUILD_DIR"/ 2>/dev/null || true
  cp "$BASE"/.yarnrc.yml "$BUILD_DIR"/ 2>/dev/null || true
  cp "$BASE"/.yarnrc "$BUILD_DIR"/ 2>/dev/null || true

  cd "$BUILD_DIR"
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
  NODE_FILE_ABS="$BUILD_DIR/$NODE_FILE"

  while IFS= read -r SRC; do
    cp "$NODE_FILE_ABS" "$SRC/"
    echo "Copied $(basename "$NODE_FILE") to $SRC"
  done < "$NEED_BUILD"
fi

echo "=== prepadJ: Done ==="
