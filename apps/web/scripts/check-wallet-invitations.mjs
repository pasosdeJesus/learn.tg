// Comprobación del flujo de invitaciones del motor `wallet` contra la base local
// (R-#265 §3.2 / m#50). No hay rutas ni UI todavía (`billetera_invitada` está declarada
// y sin usar en `eng:check`), así que lo que se puede probar hoy es la **semántica del
// motor**: se ejecuta todo dentro de una transacción y se hace ROLLBACK al final (no
// deja filas).
//
//   cd apps/web && set -a && . ../.env && set +a && node scripts/check-wallet-invitations.mjs
//
// Es opt-in (escribe y hace ROLLBACK), por eso no vive en la suite de vitest; cuando
// existan las rutas (`/api/wallet/invite|accept|cancel`) y la UI, la prueba de verdad
// será un E2E de dos billeteras.

import pg from 'pg'
import {
  ensureWalletLink,
  inviteWallet,
  cancelInvitation,
  findPendingInvitation,
  acceptInvitation,
  listWallets,
  WalletInvitationError,
} from '../packages/generated/wallet/dist/index.js'

const ADDRESS_A = '0x1111111111111111111111111111111111111111'
const ADDRESS_B = '0x2222222222222222222222222222222222222222'
const ADDRESS_C = '0x3333333333333333333333333333333333333333'
const ADDRESS_D = '0x4444444444444444444444444444444444444444'

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || process.env.PGUSER,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
})
const client = await pool.connect()

let failures = 0
const ok = (m) => console.log(`  [OK] ${m}`)
const fail = (m) => { failures += 1; console.log(`  [FAIL] ${m}`) }

/** El motor espera `{ query(text, params) => { rows } }`; todo va por el mismo cliente. */
const executor = {
  query: async (text, params) => {
    const result = await client.query(text, params || [])
    return { rows: result.rows }
  },
}

const rejects = async (promise) => {
  try {
    await promise
    return null
  } catch (error) {
    return error
  }
}

// ── Modo operador: `--address 0x…` ─────────────────────────────────────────────
// Estado de UNA dirección (soporte: "¿por qué no puedo invitar esta billetera?").
// Sólo lee.
const addressIndex = process.argv.indexOf('--address')
if (addressIndex !== -1) {
  const address = (process.argv[addressIndex + 1] || '').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    console.error('uso: node scripts/check-wallet-invitations.mjs [--address 0x…]')
    process.exit(2)
  }
  const linked = await client.query(
    `SELECT b.usuario_id, u.nusuario
       FROM billetera_usuario b JOIN usuario u ON u.id = b.usuario_id
      WHERE LOWER(b.billetera) = $1`,
    [address],
  )
  const pending = await client.query(
    `SELECT i.usuario_id, u.nusuario, i.expires_at
       FROM billetera_invitada i JOIN usuario u ON u.id = i.usuario_id
      WHERE LOWER(i.direccion_invitada) = $1
        AND i.used_at IS NULL AND i.cancelled_at IS NULL`,
    [address],
  )
  console.log(`Dirección ${address}`)
  if (linked.rows.length) {
    console.log(`  ya vinculada a la cuenta #${linked.rows[0].usuario_id} (${linked.rows[0].nusuario ?? '—'})`)
    console.log('  → no se puede invitar (una billetera no cambia de dueño); el enlace tampoco la aceptaría')
  } else if (pending.rows.length) {
    console.log(`  invitación pendiente de la cuenta #${pending.rows[0].usuario_id} (${pending.rows[0].nusuario ?? '—'})`)
    console.log(`  vence: ${pending.rows[0].expires_at ?? '—'} — se acepta al entrar y confirmar (POST /api/wallet/accept)`)
  } else {
    console.log('  libre: se puede invitar (si el invitador tiene perfil ≥ 50)')
  }
  client.release()
  await pool.end()
  process.exit(0)
}

try {
  await client.query('BEGIN')
  console.log(`Base: ${process.env.PGDATABASE} (transacción + ROLLBACK)\n`)

  const inserted = await client.query(
    `INSERT INTO usuario (nombre, nusuario, email, fechacreacion, created_at, updated_at)
     VALUES ($1, $2, $3, now()::date, now(), now()) RETURNING id`,
    ['in App', 'invitcheck1', 'invitecheck@localhost'],
  )
  const usuarioId = inserted.rows[0].id
  ok(`usuario de prueba: id=${usuarioId}`)

  await ensureWalletLink(executor, usuarioId, ADDRESS_A)
  ok(`billetera A enlazada a la cuenta (${ADDRESS_A.slice(0, 10)}…)`)

  // Invitar: la dirección invitada queda pendiente para esa cuenta.
  const invitation = await inviteWallet(executor, usuarioId, ADDRESS_B)
  const pending = await findPendingInvitation(executor, ADDRESS_B)
  if (pending && pending.id === invitation.id && pending.usuario_id === usuarioId) {
    ok('invitación pendiente visible desde la billetera invitada (findPendingInvitation)')
  } else {
    fail(`findPendingInvitation devolvió ${JSON.stringify(pending)}`)
  }

  // No se puede invitar dos veces la misma dirección mientras esté pendiente.
  const repeated = await rejects(inviteWallet(executor, usuarioId, ADDRESS_B))
  if (repeated instanceof WalletInvitationError) ok('re-invitar la misma dirección pendiente se rechaza')
  else fail(`re-invitar no se rechazó: ${repeated}`)

  // Aceptar (el consumidor afirma que ya verificó el SIWE de la billetera invitada).
  await acceptInvitation(executor, ADDRESS_B, usuarioId)
  const wallets = await listWallets(executor, usuarioId)
  const addresses = wallets.map((w) => w.billetera)
  if (addresses.includes(ADDRESS_A) && addresses.includes(ADDRESS_B)) {
    ok(`aceptar adjunta B a la cuenta: ${addresses.map((a) => a.slice(0, 8) + '…').join(', ')}`)
  } else {
    fail(`tras aceptar, la cuenta tiene ${JSON.stringify(addresses)}`)
  }
  const used = await client.query(
    'SELECT used_at FROM billetera_invitada WHERE id = $1',
    [invitation.id],
  )
  if (used.rows[0]?.used_at) ok('la invitación queda marcada como usada (used_at)')
  else fail('la invitación no quedó marcada como usada')

  const again = await rejects(acceptInvitation(executor, ADDRESS_B, usuarioId))
  if (again instanceof WalletInvitationError) ok('aceptar dos veces se rechaza (ya no hay pendiente)')
  else fail(`aceptar dos veces no se rechazó: ${again}`)

  // Cancelar libera el índice parcial: la misma dirección se puede volver a invitar.
  await inviteWallet(executor, usuarioId, ADDRESS_C)
  await cancelInvitation(executor, usuarioId, ADDRESS_C)
  const cancelled = await findPendingInvitation(executor, ADDRESS_C)
  if (cancelled === null) ok('cancelar quita la invitación pendiente')
  else fail(`tras cancelar sigue pendiente: ${JSON.stringify(cancelled)}`)

  // Una billetera ya enlazada a la cuenta no se puede invitar.
  const linked = await rejects(inviteWallet(executor, usuarioId, ADDRESS_A))
  if (linked instanceof WalletInvitationError) ok('invitar una billetera ya enlazada se rechaza')
  else fail(`invitar una billetera ya enlazada no se rechazó: ${linked}`)

  // Una billetera que ya tiene **otra** cuenta no se puede invitar (mismo límite que el
  // `409` del enlace: una billetera nunca cambia de dueño, R-#265 §3.1).
  const otherUser = await client.query(
    `INSERT INTO usuario (nombre, nusuario, email, fechacreacion, created_at, updated_at)
     VALUES ($1, $2, $3, now()::date, now(), now()) RETURNING id`,
    ['otro', 'invitcheck2', 'invitecheck2@localhost'],
  )
  await ensureWalletLink(executor, otherUser.rows[0].id, ADDRESS_D)
  const owned = await rejects(inviteWallet(executor, usuarioId, ADDRESS_D))
  if (owned instanceof WalletInvitationError) ok('invitar una billetera que ya tiene otra cuenta se rechaza')
  else fail(`invitar una billetera de otra cuenta no se rechazó: ${owned}`)
} catch (error) {
  fail(`excepción: ${error?.message || error}`)
} finally {
  await client.query('ROLLBACK').catch(() => {})
  client.release()
  await pool.end()
}

console.log(`\n${failures} fallo(s). Nada quedó escrito (ROLLBACK).`)
process.exit(failures > 0 ? 1 : 0)
