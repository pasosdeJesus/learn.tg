// Credenciales de las billeteras de E2E y selector por parámetro.
//
// Cada spec de `e2e/specs` y `e2e/smoke` traía su propia copia de
// `loadEnvCredentials()`. Aquí vive una sola y admite elegir la billetera por
// parámetro, para reutilizar los recorridos que ya existen (crear pastor,
// resolver crucigramas, formar clúster) con varias billeteras:
//
//   E2E_WALLET=TEST_PASTOR2 make test-e2e-spec SPEC=church-persistence
//   E2E_WALLET=0x…          make test-e2e-spec SPEC=church-persistence
//   node e2e/specs/x.spec.mjs --wallet 0x…
//
// Sin selector usa `PRIVATE_KEY` (la billetera de prueba de `apps/.env`), que es
// la que hacían los specs antes. Las claves nombradas (`TEST_PASTOR1..3`) viven
// en `apps/.env`, que no se versiona.

import * as fs from 'fs'
import * as path from 'path'
import { privateKeyToAccount } from 'viem/accounts'

const ENV_PATHS = [
  path.join(process.cwd(), '..', '.env'),
  path.join(process.cwd(), 'apps', '.env'),
  path.join(process.cwd(), '.env'),
]

/** Variables que el selector admite por nombre. */
export const WALLET_VARIABLES = [
  'PRIVATE_KEY',
  'PRIVATE_KEY_REFERRAL_WALLET',
  'CHURCHES_WALLET_PRIVATE_KEY',
  'TEST_PASTOR1_PRIVATE_KEY',
  'TEST_PASTOR2_PRIVATE_KEY',
  'TEST_PASTOR3_PRIVATE_KEY',
  'TEST_MEMBER1_PRIVATE_KEY',
  'TEST_MEMBER2_PRIVATE_KEY',
  'TEST_MEMBER3_PRIVATE_KEY',
]

function envText() {
  return ENV_PATHS.filter((p) => fs.existsSync(p))
    .map((p) => fs.readFileSync(p, 'utf8'))
    .join('\n')
}

function readVariable(text, name) {
  const match =
    text.match(new RegExp(`^${name}="([^"]+)"`, 'm')) ||
    text.match(new RegExp(`^${name}=(\\S+)`, 'm'))
  return match?.[1] || process.env[name] || ''
}

/** Selector: `--wallet <valor>`, o la variable de entorno `E2E_WALLET`. */
export function walletSelector(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--wallet')
  if (index >= 0 && argv[index + 1]) return argv[index + 1]
  const inline = argv.find((arg) => arg.startsWith('--wallet='))
  if (inline) return inline.slice('--wallet='.length)
  return process.env.E2E_WALLET || ''
}

/**
 * Credenciales de una billetera.
 *
 * `variable` puede ser el nombre de una variable (`TEST_PASTOR2_PRIVATE_KEY`),
 * el nombre corto (`TEST_PASTOR2`) o una dirección `0x…` que se busca entre las
 * variables conocidas. La dirección se deriva de la clave, así que no hace falta
 * guardarla aparte.
 */
export function loadWalletCredentials({ variable = 'PRIVATE_KEY' } = {}) {
  const text = envText()
  const candidates = []

  for (const name of WALLET_VARIABLES) {
    const pk = readVariable(text, name)
    if (!pk) continue
    try {
      const address = privateKeyToAccount(pk).address
      candidates.push({ variable: name, pk, address, addr: address })
    } catch {
      continue
    }
  }

  if (!variable) return null
  const wanted = variable.startsWith('0x') ? variable.toLowerCase() : ''
  const name = wanted
    ? ''
    : WALLET_VARIABLES.includes(variable)
      ? variable
      : `${variable}_PRIVATE_KEY`

  const chosen = candidates.find((entry) =>
    wanted ? entry.address.toLowerCase() === wanted : entry.variable === name,
  )
  return chosen || null
}

/**
 * Billetera verificadora (la que puede llamar a `/api/admin/*`). Es `PRIVATE_KEY`
 * salvo que `E2E_VERIFIER_WALLET` diga otra variable.
 */
export function loadVerifierWallet() {
  const variable = process.env.E2E_VERIFIER_WALLET || 'PRIVATE_KEY'
  return loadWalletCredentials({ variable })
}

/** Credenciales de la billetera elegida por `E2E_WALLET` / `--wallet`. */
export function loadSelectedWallet(argv) {
  const selector = walletSelector(argv)
  const selected = selector ? loadWalletCredentials({ variable: selector }) : null
  if (selected) return selected
  const fallback = loadWalletCredentials({ variable: 'PRIVATE_KEY' })
  if (!fallback) return null
  return fallback
}
