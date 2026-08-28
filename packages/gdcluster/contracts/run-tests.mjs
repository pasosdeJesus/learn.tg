// Runner de contract:test para los contratos del motor gdcluster (https://gitlab.com/pasosdeJesus/m/-/work_items/35 Fase 6).
//
// learn.tg no es workspace pnpm: el motor no tiene node_modules propio. El
// runner de contract:test resuelve chai/tsx/hardhat desde
// <hardhatDir>/node_modules — se crea un symlink al node_modules de
// apps/hardhat (que tiene hardhat, ethers, chai, tsx, @openzeppelin).
//
// Uso:
//   node run-tests.mjs                 # todos los tests de contracts/test/
//   node run-tests.mjs test/ClusterFunds.test.ts   # solo uno
import { existsSync, symlinkSync } from 'fs'
import { spawnSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const nmLink = join(__dirname, 'node_modules')
const nmTarget = join(__dirname, '../../../apps/hardhat/node_modules')
if (!existsSync(nmLink)) {
  symlinkSync(nmTarget, nmLink, 'dir')
  console.log('[gdcluster-contracts] symlink node_modules -> apps/hardhat/node_modules')
}

process.chdir(__dirname)

// MockUSDT viene del motor usdt (@pasosdejesus/usdt, https://gitlab.com/pasosdeJesus/m/-/work_items/35 §15.6): copia el
// .sol del paquete a contracts/_usdt_mock.sol antes de compilar (hardhat no
// resuelve el link externo).
spawnSync('node', [join(__dirname, '../../../apps/hardhat/scripts/sync-usdt.mjs')], {
  cwd: __dirname,
  stdio: 'inherit',
})

const { runContractTest } = await import('../../../../m/packages/contract-test/dist/runner.js')
const pattern = process.argv[2]
await runContractTest(pattern)
