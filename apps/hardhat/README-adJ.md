# Special instructions to use hardhat 2 on OpenBSD/adJ 7.7

Neither hardhat 2 nor 3 work on OpenBSD/adJ 7.7, however with an
extra step we have been able to use hardhat 2 with yarn (not with npm
neither pnpm) as explained below.

```sh
yarn install
mkdir tmpart
sed -e "s/freebsd/openbsd/g" node_modules/@nomicfoundation/solidity-analyzer/index.js > tmpart/index-s.js
cp tmpart/index-s.js node_modules/@nomicfoundation/solidity-analyzer/index.js
cd node_modules/@nomicfoundation/solidity-analyzer/
yarn 
yarn build
cd ../../..
yarn
cp tmpart/index-s.js node_modules/@nomicfoundation/solidity-analyzer/index.js
yarn build
```

cd node_modules/@nomicfoundation/edr
yarn


