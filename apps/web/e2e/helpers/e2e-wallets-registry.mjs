// Registro local de billeteras creadas por los specs
// (https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// Los specs que antes generaban una billetera por corrida la dejan aquí, con su
// rol y la fecha. Así las corridas siguientes reutilizan cuentas ya creadas (por
// ejemplo, promover a pastor una billetera antigua que ya es miembro cristiano)
// en vez de llenar el sitio de desarrollo de cuentas nuevas.
//
// El archivo vive en `apps/.e2e-wallets.local.json`, **fuera de git** (ver
// `.gitignore`). Solo testnet: nunca claves de mainnet.

import * as fs from 'fs'
import * as path from 'path'

const REGISTRY_PATH = path.join(process.cwd(), '..', '.e2e-wallets.local.json')

function readRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return []
  try {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function writeRegistry(rows) {
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(rows, null, 2)}\n`)
}

/**
 * Guarda la billetera (idempotente por dirección) y devuelve su fila.
 * @param {{ privateKey: string, address: string, role?: string, note?: string }} wallet
 */
export function rememberWallet({ privateKey, address, role = 'member', note = '' }) {
  const rows = readRegistry()
  const key = address.toLowerCase()
  const existing = rows.find((row) => String(row.address).toLowerCase() === key)
  if (existing) {
    if (role && existing.role !== role) existing.role = role
    if (note) existing.note = note
    existing.updatedAt = new Date().toISOString()
  } else {
    rows.push({
      privateKey,
      address,
      role,
      note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  writeRegistry(rows)
  return rows.find((row) => String(row.address).toLowerCase() === key)
}

export function listWallets() {
  return readRegistry()
}

/**
 * Billeteras `member` más antiguas (religión 2 por defecto, que es lo que exige
 * el curso GD). Sirven para promoverlas a pastor de una iglesia nueva.
 */
export function oldestMembers({ count = 3, religionId = 2 } = {}) {
  return readRegistry()
    .filter((row) => row.role === 'member' && (!row.religionId || row.religionId === religionId))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(0, count)
}

/** Billetera libre para una prueba de pastor: la más antigua del registro. */
export function oldestFreeWallet() {
  return oldestMembers({ count: 1 })[0] || null
}

/**
 * Billeteras de un rol, de la más reciente a la más antigua, para reutilizarlas
 * antes de crear una nueva (`markWalletUsed` deja el rastro de la última corrida).
 */
export function recentByRole(role, { count = 3 } = {}) {
  return readRegistry()
    .filter((row) => row.role === role)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .slice(0, count)
}

/** Deja rastro del último uso (y de datos observados, como `score`) en el JSON. */
export function markWalletUsed(address, patch = {}) {
  const rows = readRegistry()
  const key = String(address).toLowerCase()
  const row = rows.find((entry) => String(entry.address).toLowerCase() === key)
  if (!row) return null
  Object.assign(row, patch, { lastUsedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  writeRegistry(rows)
  return row
}
