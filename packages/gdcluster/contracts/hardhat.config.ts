// Hardhat config del motor gdcluster (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §12.6 / Fase 6 — contratos
// aislados). Configuración mínima: solo compilación + redes; sin plugins de
// verify/ignition (evita deps innecesarias; verify se hace con los scripts de
// apps/hardhat). learn.tg no es workspace pnpm: hardhat/ethers/chai se
// resuelven desde el node_modules de apps/hardhat vía symlink (run-tests.mjs).
import { config as dotEnvConfig } from 'dotenv'
import path from 'path'
import { HardhatUserConfig } from 'hardhat/config'
// Expone hre.ethers (lo usan scripts/test de deploy). Resuelto desde el
// node_modules de apps/hardhat (symlink).
import '@nomicfoundation/hardhat-ethers'

// El .env del proyecto vive en apps/.env (jerarquía de m: ../../ → ../ → .);
// misma convención que apps/hardhat (que usa ../.env desde apps/hardhat).
dotEnvConfig({ path: path.resolve(__dirname, '../../../apps/.env') })

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    celo: {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org',
    },
    celoSepolia: {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org/',
    },
    base: {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org',
    },
    'base-sepolia': {
      accounts: [process.env.PRIVATE_KEY ?? '0x0'],
      url: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org',
    },
  },
}

export default config
