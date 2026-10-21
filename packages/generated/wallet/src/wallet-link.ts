// wallet-link.ts — modelo del motor `wallet`: enlace billetera ↔ usuario (N billeteras).
//
// `billetera_usuario`/`billetera_invitada` son **tablas propias** del motor
// ([REQ/50](https://gitlab.com/pasosdeJesus/m/-/work_items/50) D4/D9): salieron de la extensión opcional de `msip` y ahora las declara
// este motor (sus migraciones, `db/migrations/`). El motor `provides: ["auth","wallet"]`
// y compone `msip` sólo por `usuario`.
//
// **Contrato** (`doc/identidad-multibilletera.md` §4.1/§4.2, endurecido tras la auditoría
// de learn.tg 2026-10-13): una billetera pertenece a **un solo** usuario; `linkWallet`
// **rechaza** si ya es de otro; `unlinkWallet` rechaza quitar la última; `acceptInvitation`
// es **transaccional** y rechaza si la dirección ya es de otra cuenta.
//
// Cardinalidad (https://gitlab.com/pasosdeJesus/m/-/work_items/38): un `usuario` tiene **N** billeteras. `UNIQUE (billetera)`
// (una billetera es de un solo usuario), `UNIQUE (usuario_id, billetera)` (sin
// duplicados) e `INDEX (usuario_id)` **no** único. Las direcciones se normalizan a
// minúsculas antes de escribir (EIP-55 es solo presentación).
//
// Declarar las tablas si no existen:
//   WALLET_LINK_SEQUENCE_DDL + WALLET_LINK_DDL
//   WALLET_INVITE_SEQUENCE_DDL + WALLET_INVITE_DDL

import { USUARIO_BASE_COLUMNS } from 'generated-msip';
import type { SqlExecutor, Usuario } from 'generated-msip';

/** DDL de referencia de la tabla del enlace (idempotente con IF NOT EXISTS). */
export const WALLET_LINK_DDL = `CREATE TABLE IF NOT EXISTS public.billetera_usuario (
    id bigint DEFAULT nextval('public.billetera_usuario_id_seq'::regclass) NOT NULL,
    billetera character varying(60) NOT NULL,
    usuario_id integer NOT NULL,
    nonce character varying(255),
    nonce_expires_at timestamp without time zone,
    linked_at timestamp without time zone NOT NULL DEFAULT now(),
    linked_by character varying(60),
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT billetera_usuario_pkey PRIMARY KEY (id),
    CONSTRAINT billetera_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id),
    CONSTRAINT billetera_usuario_billetera_key UNIQUE (billetera),
    CONSTRAINT billetera_usuario_usuario_id_billetera_key UNIQUE (usuario_id, billetera)
);
CREATE INDEX IF NOT EXISTS billetera_usuario_usuario_id_idx ON public.billetera_usuario (usuario_id);`;

/** Secuencia que necesita el `id` de `WALLET_LINK_DDL`. */
export const WALLET_LINK_SEQUENCE_DDL = `CREATE SEQUENCE IF NOT EXISTS public.billetera_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;`;

/**
 * DDL de las invitaciones. Los índices únicos son **parciales** (`pending`), para
 * permitir re-invitar una dirección tras cancelar o expirar (la fila se conserva
 * para auditoría). `now()` no puede aparecer en el predicado (no es IMMUTABLE): la
 * expiración se aplica en la aplicación, que además marca `cancelled_at`.
 */
export const WALLET_INVITE_DDL = `CREATE TABLE IF NOT EXISTS public.billetera_invitada (
    id bigint DEFAULT nextval('public.billetera_invitada_id_seq'::regclass) NOT NULL,
    direccion_invitada character varying(60) NOT NULL,
    usuario_id integer NOT NULL,
    invited_by integer,
    used_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    expires_at timestamp without time zone NOT NULL DEFAULT (now() + interval '30 days'),
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT billetera_invitada_pkey PRIMARY KEY (id),
    CONSTRAINT billetera_invitada_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS billetera_invitada_pendiente_direccion_idx
    ON public.billetera_invitada (direccion_invitada)
    WHERE used_at IS NULL AND cancelled_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billetera_invitada_pendiente_usuario_idx
    ON public.billetera_invitada (usuario_id, direccion_invitada)
    WHERE used_at IS NULL AND cancelled_at IS NULL;`;

/** Secuencia que necesita el `id` de `WALLET_INVITE_DDL`. */
export const WALLET_INVITE_SEQUENCE_DDL = `CREATE SEQUENCE IF NOT EXISTS public.billetera_invitada_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;`;

export interface WalletLink {
  id: number;
  usuario_id: number;
  billetera: string;
  /** Cuándo se vinculó (para elegir "la más antigua" como dirección pública). */
  linked_at?: string | null;
}

export interface WalletInvitation {
  id: number;
  direccion_invitada: string;
  usuario_id: number;
  used_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
}

/** La billetera ya está vinculada a **otro** usuario (no se puede re-vincular). */
export class WalletOwnedByOtherError extends Error {
  readonly wallet: string;
  constructor(wallet: string) {
    super(`la billetera ${wallet} ya está vinculada a otra cuenta`);
    this.name = 'WalletOwnedByOtherError';
    this.wallet = wallet;
  }
}

/** No hay una invitación pendiente válida para esa dirección y esa cuenta. */
export class WalletInvitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletInvitationError';
  }
}

/** La dirección de billetera no es `0x` + 40 hex (error tipado, V5). */
export class InvalidWalletAddressError extends Error {
  readonly wallet: string;
  constructor(wallet: string) {
    super(`dirección de billetera inválida: ${wallet}`);
    this.name = 'InvalidWalletAddressError';
    this.wallet = wallet;
  }
}

/** `true` si `wallet` es `0x` + 40 hex (una dirección EVM válida). */
export function isValidAddress(wallet: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(wallet.toLowerCase());
}

/** Normaliza una dirección de billetera (las direcciones son case-insensitive). */
export function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase();
}

/** Normaliza y **valida** la dirección (rechaza entradas mal formadas en el motor). */
function assertAddress(wallet: string): string {
  if (!isValidAddress(wallet)) throw new InvalidWalletAddressError(wallet);
  return wallet.toLowerCase();
}

function selectUsuario(): string {
  return `SELECT ${USUARIO_BASE_COLUMNS.map((column) => `u.${column}`).join(', ')}\n  FROM usuario u`;
}

export function siweNusuario(wallet: string): string {
  return `${wallet.slice(0, 7)}...${wallet.slice(-5)}`;
}

/** Busca el usuario por **cualquiera** de sus billeteras (case-insensitive). */
export async function getUserByWallet(db: SqlExecutor, wallet: string): Promise<Usuario | null> {
  const address = assertAddress(wallet);
  const result = await db.query<Usuario>(
    `${selectUsuario()}
  JOIN billetera_usuario b ON b.usuario_id = u.id
 WHERE LOWER(b.billetera) = $1
 ORDER BY u.id
 LIMIT 1`,
    [address],
  );
  return result.rows[0] ?? null;
}

/** Billeteras de un usuario (la más antigua primero; incluye `linked_at`). */
export async function listWallets(db: SqlExecutor, usuarioId: number): Promise<WalletLink[]> {
  const result = await db.query<WalletLink>(
    `SELECT id, usuario_id, billetera, linked_at
       FROM billetera_usuario
      WHERE usuario_id = $1
      ORDER BY linked_at, id`,
    [usuarioId],
  );
  return result.rows;
}

/**
 * Enlaza una billetera a un usuario (idempotente bajo los `UNIQUE`). **Rechaza**
 * (`WalletOwnedByOtherError`) si la billetera ya es de **otro** usuario.
 */
export async function linkWallet(
  db: SqlExecutor,
  usuarioId: number,
  wallet: string,
  options: { linkedBy?: string } = {},
): Promise<void> {
  const address = assertAddress(wallet);
  const result = await db.query<{ id: number }>(
    `INSERT INTO billetera_usuario (usuario_id, billetera, linked_at, linked_by, created_at, updated_at)
     VALUES ($1, $2, now(), $3, now(), now())
     ON CONFLICT (billetera) DO UPDATE SET updated_at = now()
       WHERE billetera_usuario.usuario_id = EXCLUDED.usuario_id
     RETURNING id`,
    [usuarioId, address, options.linkedBy ?? null],
  );
  if (result.rows.length === 0) throw new WalletOwnedByOtherError(address);
}

/** Como `linkWallet`, sin auditoría: una billetera, un enlace; rechaza la ajena. */
export async function ensureWalletLink(
  db: SqlExecutor,
  usuarioId: number,
  wallet: string,
): Promise<void> {
  await linkWallet(db, usuarioId, wallet);
}

/**
 * Desenlaza una billetera; se niega si es la **última** del usuario. Es una única
 * sentencia (evita el TOCTOU de `count` + `DELETE`).
 */
export async function unlinkWallet(
  db: SqlExecutor,
  usuarioId: number,
  wallet: string,
): Promise<boolean> {
  const address = assertAddress(wallet);
  const deleted = await db.query<{ id: number }>(
    `DELETE FROM billetera_usuario
      WHERE usuario_id = $1 AND billetera = $2
        AND (SELECT count(*) FROM billetera_usuario WHERE usuario_id = $1) > 1
      RETURNING id`,
    [usuarioId, address],
  );
  return deleted.rows.length > 0;
}

export async function upsertUserByWallet(
  db: SqlExecutor,
  wallet: string,
  options: { ip?: string } = {},
): Promise<{ usuario: Usuario; created: boolean }> {
  const address = assertAddress(wallet);
  const ip = options.ip ?? '127.0.0.1';
  const existing = await db.query<Usuario>(
    `${selectUsuario()}
  JOIN billetera_usuario b ON b.usuario_id = u.id
 WHERE LOWER(b.billetera) = $1
 ORDER BY u.id
 LIMIT 1`,
    [address],
  );

  if (!existing.rows[0]) {
    const address15 = siweNusuario(address);
    const created = await db.query<Usuario>(
      `INSERT INTO usuario (nombre, nusuario, email, fechacreacion, current_sign_in_at, current_sign_in_ip, created_at, updated_at)
       VALUES ($1, $2, $3, now()::date, now(), $4, now(), now())
       RETURNING ${USUARIO_BASE_COLUMNS.join(', ')}`,
      [address, address15, `${address15}@localhost`, ip],
    );
    const usuario = created.rows[0];
    try {
      await ensureWalletLink(db, usuario.id, address);
    } catch (error) {
      // Carrera: otra petición ganó la billetera. Deshace el usuario huérfano (sin enlaces)
      // y devuelve al ganador.
      if (error instanceof WalletOwnedByOtherError) {
        await db.query(
          `DELETE FROM usuario WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM billetera_usuario WHERE usuario_id = $1)`,
          [usuario.id],
        );
        const winner = await getUserByWallet(db, address);
        if (winner) return { usuario: winner, created: false };
      }
      throw error;
    }
    return { usuario, created: true };
  }

  const previous = existing.rows[0];
  const updated = await db.query<Usuario>(
    `UPDATE usuario
        SET last_sign_in_ip = COALESCE(last_sign_in_ip, current_sign_in_ip),
            last_sign_in_at = COALESCE(last_sign_in_at, current_sign_in_at),
            current_sign_in_ip = $2,
            current_sign_in_at = now(),
            updated_at = now()
      WHERE id = $1
      RETURNING ${USUARIO_BASE_COLUMNS.join(', ')}`,
    [previous.id, ip],
  );
  await db.query('UPDATE billetera_usuario SET updated_at = now() WHERE usuario_id = $1', [previous.id]);
  return { usuario: updated.rows[0] ?? previous, created: false };
}

// ── Invitaciones (una segunda billetera se une a una cuenta existente) ──

/**
 * Invita una dirección a unirse a la cuenta. **Rechaza** si la dirección ya es una
 * billetera vinculada o si ya hay una invitación **pendiente** (a esta o a otra cuenta).
 */
export async function inviteWallet(
  db: SqlExecutor,
  usuarioId: number,
  address: string,
  options: { invitedBy?: number; expiresAt?: Date } = {},
): Promise<WalletInvitation> {
  const lower = assertAddress(address);
  const linked = await db.query<{ id: number }>(
    'SELECT id FROM billetera_usuario WHERE billetera = $1 LIMIT 1',
    [lower],
  );
  if (linked.rows.length > 0) throw new WalletInvitationError(`la billetera ${lower} ya está vinculada a una cuenta`);
  const pending = await db.query<{ id: number }>(
    `SELECT id FROM billetera_invitada
      WHERE direccion_invitada = $1 AND used_at IS NULL AND cancelled_at IS NULL
      LIMIT 1`,
    [lower],
  );
  if (pending.rows.length > 0) throw new WalletInvitationError(`ya hay una invitación pendiente para ${lower}`);

  try {
    const result = await db.query<WalletInvitation>(
      `INSERT INTO billetera_invitada
         (direccion_invitada, usuario_id, invited_by, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, COALESCE($4, now() + interval '30 days'), now(), now())
       RETURNING id, direccion_invitada, usuario_id, used_at, cancelled_at, expires_at`,
      [lower, usuarioId, options.invitedBy ?? null, options.expiresAt ?? null],
    );
    return result.rows[0];
  } catch (error) {
    // Carrera: dos invitaciones de la misma dirección chocan con el índice parcial.
    if ((error as { code?: string })?.code === '23505') {
      throw new WalletInvitationError(`ya hay una invitación pendiente para ${lower}`);
    }
    throw error;
  }
}

/** Invitaciones **pendientes** de un usuario (ni usadas ni canceladas). */
export async function listInvitations(db: SqlExecutor, usuarioId: number): Promise<WalletInvitation[]> {
  const result = await db.query<WalletInvitation>(
    `SELECT id, direccion_invitada, usuario_id, used_at, cancelled_at, expires_at
       FROM billetera_invitada
      WHERE usuario_id = $1 AND used_at IS NULL AND cancelled_at IS NULL
      ORDER BY created_at, id`,
    [usuarioId],
  );
  return result.rows;
}

/** Cancela una invitación pendiente (libera el índice parcial para re-invitar). */
export async function cancelInvitation(
  db: SqlExecutor,
  usuarioId: number,
  address: string,
): Promise<boolean> {
  const result = await db.query<{ id: number }>(
    `UPDATE billetera_invitada
        SET cancelled_at = now(), updated_at = now()
      WHERE usuario_id = $1 AND direccion_invitada = $2
        AND used_at IS NULL AND cancelled_at IS NULL
      RETURNING id`,
    [usuarioId, assertAddress(address)],
  );
  return result.rows.length > 0;
}

/**
 * Busca la invitación pendiente de una dirección. Si expiró, la marca
 * `cancelled_at` (para que deje de bloquear el índice parcial) y devuelve `null`.
 */
export async function findPendingInvitation(
  db: SqlExecutor,
  address: string,
): Promise<WalletInvitation | null> {
  const lower = assertAddress(address);
  const result = await db.query<WalletInvitation>(
    `SELECT id, direccion_invitada, usuario_id, used_at, cancelled_at, expires_at
       FROM billetera_invitada
      WHERE direccion_invitada = $1 AND used_at IS NULL AND cancelled_at IS NULL
      ORDER BY id
      LIMIT 1`,
    [lower],
  );
  const invitation = result.rows[0];
  if (!invitation) return null;
  if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
    await cancelInvitation(db, invitation.usuario_id, lower);
    return null;
  }
  return invitation;
}

/**
 * Acepta la invitación de `address` para `usuarioId`: enlaza la billetera y marca la
 * invitación usada en **una sola sentencia** (atómica). **Rechaza** si no hay
 * invitación pendiente para esa cuenta o si la dirección ya es de **otra** cuenta
 * (en cuyo caso **no** marca `used_at`).
 */
export async function acceptInvitation(
  db: SqlExecutor,
  address: string,
  usuarioId: number,
): Promise<void> {
  const lower = assertAddress(address);
  const result = await db.query<{ id: number }>(
    `WITH invite AS (
       SELECT id FROM billetera_invitada
        WHERE direccion_invitada = $1 AND usuario_id = $2
          AND used_at IS NULL AND cancelled_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        LIMIT 1
     ), link AS (
       INSERT INTO billetera_usuario (usuario_id, billetera, linked_at, created_at, updated_at)
       SELECT $2, $1, now(), now(), now() FROM invite
       ON CONFLICT (billetera) DO UPDATE SET updated_at = now()
         WHERE billetera_usuario.usuario_id = EXCLUDED.usuario_id
       RETURNING id
     ), used AS (
       UPDATE billetera_invitada SET used_at = now(), updated_at = now()
        WHERE id IN (SELECT id FROM invite) AND EXISTS (SELECT 1 FROM link)
        RETURNING id
     )
     SELECT id FROM used`,
    [lower, usuarioId],
  );
  if (result.rows.length === 0) {
    throw new WalletInvitationError(
      `no hay invitación pendiente para ${lower} en la cuenta ${usuarioId}, o la billetera ya es de otra cuenta`,
    );
  }
}
