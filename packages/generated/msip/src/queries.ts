import { BASE_MODEL_VERSION } from './version.js';
import { BASELINE_INVENTORY } from './baseline.generated.js';
import type { SqlExecutor, TownResult, Usuario, VisibilityConfig } from './types.js';

/**
 * Columns of `usuario` that the base model publishes (the reference's, msip-2.2).
 * A consumer that adds columns reads them with `readProfile({ columns })`. The
 * wallet-link helpers **no longer live here**: they moved to the `wallet` engine
 * (`@pasosdejesus/wallet`, REQ/50 D4/D9).
 */
export const USUARIO_BASE_COLUMNS = [
  'id', 'nusuario', 'password', 'nombre', 'descripcion', 'rol', 'idioma', 'email',
  'encrypted_password', 'sign_in_count', 'fechacreacion', 'fechadeshabilitacion',
  'reset_password_token', 'reset_password_sent_at', 'remember_created_at',
  'current_sign_in_at', 'last_sign_in_at', 'current_sign_in_ip', 'last_sign_in_ip',
  'created_at', 'updated_at', 'failed_attempts', 'unlock_token', 'locked_at', 'tema_id',
] as const;

export const SEARCH_TOWNS_SQL = [
  'SELECT t.id, t.nombre AS town, m.id AS municipio_id, m.nombre AS municipio,',
  '       d.id AS departamento_id, d.nombre AS departamento',
  '  FROM msip_centropoblado t',
  '  JOIN msip_municipio m ON m.id = t.municipio_id',
  '  JOIN msip_departamento d ON d.id = m.departamento_id',
  ' WHERE t.fechadeshabilitacion IS NULL',
].join('\n');

function selectUsuario(): string {
  return `SELECT ${USUARIO_BASE_COLUMNS.map((column) => `u.${column}`).join(', ')}\n  FROM usuario u`;
}

export async function getUserById(db: SqlExecutor, id: number): Promise<Usuario | null> {
  const result = await db.query<Usuario>(`${selectUsuario()}\n WHERE u.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export function siweNusuario(wallet: string): string {
  return `${wallet.slice(0, 7)}...${wallet.slice(-5)}`;
}

export function isSessionSubject(
  session: { address?: string | null } | null | undefined,
  wallet: string,
): boolean {
  const address = session?.address;
  if (!address || !wallet) return false;
  return address.toLowerCase() === wallet.toLowerCase();
}

export async function readProfile(
  db: SqlExecutor,
  userId: number,
  options: { columns?: string[] } = {},
): Promise<Record<string, unknown> | null> {
  const extra = (options.columns ?? []).filter((column) => /^[a-z_][a-z0-9_]*$/.test(column));
  const selected = [...USUARIO_BASE_COLUMNS, ...extra];
  const result = await db.query<Record<string, unknown>>(
    `SELECT ${selected.join(', ')} FROM usuario WHERE id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function updateProfile(
  db: SqlExecutor,
  userId: number,
  fields: Record<string, unknown>,
  allowList: readonly string[],
): Promise<Record<string, unknown> | null> {
  const allowed = new Set(allowList);
  const entries = Object.entries(fields).filter(([key]) => allowed.has(key) && /^[a-z_][a-z0-9_]*$/.test(key));
  if (entries.length === 0) return readProfile(db, userId);
  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);
  const result = await db.query<Record<string, unknown>>(
    `UPDATE usuario SET ${assignments.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [userId, ...values],
  );
  return result.rows[0] ?? null;
}

export async function setVisibility(
  db: SqlExecutor,
  userId: number,
  values: Record<string, unknown>,
  config: VisibilityConfig,
): Promise<Record<string, unknown> | null> {
  const entries = Object.entries(values).filter(([key]) => config.columns.includes(key));
  if (entries.length === 0) return null;
  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const result = await db.query<Record<string, unknown>>(
    `UPDATE usuario SET ${assignments.join(', ')}, updated_at = now() WHERE id = $1 RETURNING id, ${config.columns.join(', ')}`,
    [userId, ...entries.map(([, value]) => value)],
  );
  return result.rows[0] ?? null;
}

export async function listCountries(db: SqlExecutor): Promise<Array<Record<string, unknown>>> {
  const result = await db.query(
    'SELECT id, nombre, alfa2, alfa3 FROM msip_pais WHERE fechadeshabilitacion IS NULL ORDER BY nombre',
  );
  return result.rows;
}

export async function listDepartments(db: SqlExecutor, paisId: number): Promise<Array<Record<string, unknown>>> {
  const result = await db.query(
    'SELECT id, nombre, pais_id FROM msip_departamento WHERE pais_id = $1 AND fechadeshabilitacion IS NULL ORDER BY nombre',
    [paisId],
  );
  return result.rows;
}

export async function listMunicipalities(db: SqlExecutor, departamentoId: number): Promise<Array<Record<string, unknown>>> {
  const result = await db.query(
    'SELECT id, nombre, departamento_id FROM msip_municipio WHERE departamento_id = $1 AND fechadeshabilitacion IS NULL ORDER BY nombre',
    [departamentoId],
  );
  return result.rows;
}

export async function searchTowns(
  db: SqlExecutor,
  query: { q?: string; countryId?: number; departamentoId?: number; municipalityId?: number; limit?: number } = {},
): Promise<TownResult[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (query.countryId !== undefined) {
    params.push(query.countryId);
    where.push(`d.pais_id = $${params.length}`);
  }
  if (query.departamentoId !== undefined) {
    params.push(query.departamentoId);
    where.push(`d.id = $${params.length}`);
  }
  if (query.municipalityId !== undefined) {
    params.push(query.municipalityId);
    where.push(`m.id = $${params.length}`);
  }
  const q = query.q ?? '';
  if (q.length >= 2) {
    params.push(`${q}%`);
    where.push(`t.nombre ILIKE $${params.length}`);
  }
  params.push(query.limit ?? 20);
  const sql = [
    SEARCH_TOWNS_SQL,
    ...(where.length > 0 ? [`   AND ${where.join(' AND ')}`] : []),
    ' ORDER BY t.nombre',
    ` LIMIT $${params.length}`,
  ].join('\n');
  const result = await db.query<TownResult>(sql, params);
  return result.rows;
}

export async function catalogCounts(db: SqlExecutor): Promise<Record<string, number>> {
  const result = await db.query<{ table: string; total: string }>(
    `SELECT 'msip_pais' AS table, count(*)::text AS total FROM msip_pais
      UNION ALL SELECT 'msip_departamento', count(*)::text FROM msip_departamento
      UNION ALL SELECT 'msip_municipio', count(*)::text FROM msip_municipio
      UNION ALL SELECT 'msip_centropoblado', count(*)::text FROM msip_centropoblado`,
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows) counts[row.table] = Number(row.total);
  return counts;
}

export function baseModelInfo(): { version: string; tables: readonly string[] } {
  return { version: BASE_MODEL_VERSION, tables: Object.keys(BASELINE_INVENTORY.tables) };
}
