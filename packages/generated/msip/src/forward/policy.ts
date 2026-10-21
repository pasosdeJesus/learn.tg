/**
 * Guard de la política de compatibilidad del modelo base (https://gitlab.com/pasosdeJesus/m/-/work_items/46 D12).
 *
 * Los cambios **restrictivos** —los que obligan al consumidor a actuar— solo se
 * permiten en un salto de **major**; además todo paso debe traer un `downSql`
 * explícito. La detección es heurística sobre el SQL (los casos inequívocos); un
 * cambio restrictivo que se escape debe seguir declarándose a mano.
 */
import type { BaseModelMigration } from './types.js';

export interface MigrationPolicyViolation {
  migration: BaseModelMigration;
  reason: string;
}

/** Patrones que en D12 solo se permiten con un salto de major. */
const RESTRICTIVE_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\bDROP\s+TABLE\b/i, label: 'DROP TABLE' },
  { re: /\bDROP\s+COLUMN\b/i, label: 'DROP COLUMN' },
  { re: /\bRENAME\b/i, label: 'RENAME' },
  { re: /\bSET\s+NOT\s+NULL\b/i, label: 'SET NOT NULL' },
  { re: /\bALTER\s+COLUMN\b[^;]*\b(?:TYPE|SET\s+DATA\s+TYPE)\b/i, label: 'ALTER COLUMN … TYPE' },
  { re: /\bDROP\s+CONSTRAINT\b/i, label: 'DROP CONSTRAINT' },
];

function major(version: string): number {
  return Number.parseInt(version.split('.')[0] ?? '0', 10) || 0;
}

/** Quita comentarios (`-- …` y de bloque) para no confundirlos con SQL. */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** Devuelve las violaciones de D12 (lista vacía si todo está permitido). */
export function checkMigrationPolicy(
  migrations: readonly BaseModelMigration[],
): MigrationPolicyViolation[] {
  const violations: MigrationPolicyViolation[] = [];
  for (const migration of migrations) {
    if (migration.downSql.trim() === '') {
      violations.push({ migration, reason: 'downSql vacío: D12 exige un downSql explícito' });
    }
    const upSql = stripComments(migration.upSql);
    const restrictive = RESTRICTIVE_PATTERNS
      .filter(({ re }) => re.test(upSql))
      .map(({ label }) => label);
    if (restrictive.length > 0 && major(migration.to) <= major(migration.from)) {
      violations.push({
        migration,
        reason: `cambio restrictivo (${restrictive.join(', ')}) sin subir de major: ${migration.from} → ${migration.to}`,
      });
    }
  }
  return violations;
}
