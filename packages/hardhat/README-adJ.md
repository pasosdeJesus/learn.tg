# Special instructions on OpenBSD/adJ 7.7

Since hardhat doesn't work right away on OpenBSD/adJ 7.7, although we have
reported and tried to contribute:

pnpm doesn't work, only yarn

yarn install
mkdir tmpart
cd node_modules/@nomicfoundation/solidity-analyzer/
yarn 
cd ../../..
cp node_modules/@nomicfoundation/solidity-analyzer/solidity-analyzer.openbsd-x64.node tmpart/
sed -e "s/freebsd/openbsd/g" node_modules/@nomicfoundation/solidity-analyzer/index.js > tmpart/index-s.js
cp tmpart/index-s.js node_modules/@nomicfoundation/solidity-analyzer/index.js
cp .env.template .env
Edit .env and add mnemonic of wallet to use, private key to use and celoscan API
Key.

yarn build

cd node_modules/@nomicfoundation/edr
yarn



