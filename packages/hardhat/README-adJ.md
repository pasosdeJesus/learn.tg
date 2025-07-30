# Special instructions on OpenBSD/adJ 7.7

Since hardhat doesn't work right away on OpenBSD/adJ 7.7, although we have
reported and tried to contribute:

pnpm doesn't work, only yarn

yarn install

cd node_modules/@nomicfoundation/solidity-analyzer/
yarn i
yarn build
cd ../../..
yarn install
Edit node_modules/@nomicfoundation/solidity-analyzer/index.js to search the case
'freebsd' and replicate it but changing 'freebsd' for 'openbsd'.
cp .env.template .env
Edit .env and add mnemonic of wallet to use, private key to use and celoscan API
Key.



