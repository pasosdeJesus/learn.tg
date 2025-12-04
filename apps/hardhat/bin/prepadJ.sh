#!/bin/sh

yarn install
mkdir -p tmpart
sed -e "s/freebsd/openbsd/g" node_modules/@nomicfoundation/solidity-analyzer/index.js > tmpart/index-sa.js
cp tmpart/index-sa.js node_modules/@nomicfoundation/solidity-analyzer/index.js
cd node_modules/@nomicfoundation/solidity-analyzer/
yarn 
yarn build
cd ../../..
yarn
cp tmpart/index-sa.js node_modules/@nomicfoundation/solidity-analyzer/index.js
yarn build
