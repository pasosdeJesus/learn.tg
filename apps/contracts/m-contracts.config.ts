// Compiler, networks and explorers for the contract tooling of `m`
// (`bin/m contract:compile|deploy|verify`, https://gitlab.com/pasosdeJesus/m/-/work_items/52).
//
// The object must stay literal: the commands read it with regular expressions, so no
// imports, no functions and the compiler keys after `solidity:`.
//
// `evmVersion: 'paris'` is not decorative: Hardhat compiled these contracts for paris
// (its default for this pin), so any other target changes the bytecode of the already
// verified deployments.
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
  explorer: {
    celo: { apiUrl: 'https://celo.blockscout.com/api', apiKeyEnv: 'BLOCKSCOUT_API_KEY' },
    celoSepolia: { apiUrl: 'https://celo-sepolia.blockscout.com/api', apiKeyEnv: 'BLOCKSCOUT_API_KEY' },
    base: { apiUrl: 'https://api.basescan.org/api', apiKeyEnv: 'BASESCAN_API_KEY' },
    'base-sepolia': { apiUrl: 'https://api-sepolia.basescan.org/api', apiKeyEnv: 'BASESCAN_API_KEY' },
  },
}

export default config
