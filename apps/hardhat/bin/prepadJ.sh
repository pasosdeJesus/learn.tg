#!/bin/sh
#
# prepadJ.sh — OpenBSD Hardhat compatibility setup (pnpm version)
#
# Compiles @nomicfoundation/solidity-analyzer native addon for OpenBSD.
# Without this, `hardhat compile` fails because the platform has no
# prebuilt binary.
#
# Prerequisites (run once as root):
#   doas corepack enable
#
# Usage:
#   cd apps/hardhat
#   sh bin/prepadJ.sh
#
set -e

echo "=== prepadJ: OpenBSD Hardhat compatibility (pnpm) ==="

# Find solidity-analyzer source in pnpm store
SOLA_DIR=$(find node_modules/.pnpm -maxdepth 1 -name "@nomicfoundation+solidity-analyzer@*" -type d | head -1)
if [ -z "$SOLA_DIR" ]; then
  echo "ERROR: solidity-analyzer not found. Run: pnpm install"
  exit 1
fi
SOLA_SRC="$SOLA_DIR/node_modules/@nomicfoundation/solidity-analyzer"
echo "solidity-analyzer: $SOLA_SRC"

# Check if already built
if [ -f "$SOLA_SRC/solidity-analyzer.openbsd-x64.node" ]; then
  echo "Native addon already exists — skipping build"
  exit 0
fi

# Patch index.js: freebsd → openbsd platform detection
sed -e 's/freebsd/openbsd/g' "$SOLA_SRC/index.js" > /tmp/sa-index.js
cp /tmp/sa-index.js "$SOLA_SRC/index.js"
echo "Patched index.js (freebsd → openbsd)"

# Build in temp directory to avoid corepack conflict with parent pnpm
TMPDIR=$(mktemp -d /tmp/sa-build.XXXXXX)
echo "Building in temp directory: $TMPDIR"
cp -r "$SOLA_SRC"/* "$TMPDIR"/
cp "$SOLA_SRC"/.yarnrc.yml "$TMPDIR"/ 2>/dev/null || true
cp "$SOLA_SRC"/.yarnrc "$TMPDIR"/ 2>/dev/null || true
cp "$SOLA_SRC"/Cargo.toml "$TMPDIR"/ 2>/dev/null || true
cp -r "$SOLA_SRC"/src "$TMPDIR"/ 2>/dev/null || true
cp -r "$SOLA_SRC"/build.rs "$TMPDIR"/ 2>/dev/null || true

cd "$TMPDIR"
echo "Installing dependencies (yarn)..."
yarn
echo "Building native addon..."
yarn build

# Copy built artifact back
NODE_FILE=$(ls *.node 2>/dev/null | head -1)
if [ -z "$NODE_FILE" ]; then
  NODE_FILE=$(find . -name "*.node" -type f | head -1)
fi
if [ -z "$NODE_FILE" ]; then
  echo "ERROR: No .node file produced. Check build output."
  exit 1
fi
NODE_FILE_ABS="$TMPDIR/$NODE_FILE"

cd - > /dev/null
cp "$NODE_FILE_ABS" "$SOLA_SRC/"
echo "Copied $NODE_FILE to $SOLA_SRC"

rm -rf "$TMPDIR"

echo "=== prepadJ: Verifying with pnpm build ==="
pnpm build
echo "=== prepadJ: Done ==="
