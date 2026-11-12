// Compiler and networks for the isolated contracts project of the gdcluster engine
// (`ClusterFunds`), compiled with `bin/m contract:*` (https://gitlab.com/pasosdeJesus/m/-/work_items/52).
//
// Same pin and settings as `apps/contracts`: `evmVersion: 'paris'` keeps the bytecode of
// the deployed contracts unchanged.
const config = {
  solidity: '0.8.24',
  optimizer: { enabled: true, runs: 200 },
  viaIR: true,
  evmVersion: 'paris',
  networks: {
    celo: { url: 'https://forno.celo.org', chainId: 42220 },
    celoSepolia: { url: 'https://forno.celo-sepolia.celo-testnet.org/', chainId: 11142220 },
    base: { url: 'https://mainnet.base.org', chainId: 8453 },
    'base-sepolia': { url: 'https://sepolia.base.org', chainId: 84532 },
  },
}

export default config
