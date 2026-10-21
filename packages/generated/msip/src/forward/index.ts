/**
 * Pasos de migración del modelo base (https://gitlab.com/pasosdeJesus/m/-/work_items/46 D11).
 *
 * `BASE_MODEL_MIGRATIONS` está en orden (el más antiguo primero). Los helpers
 * `migrationMarker`/`planSetup`/`renderMigrationFile`/`splitSqlStatements` son
 * puros y los usa `eng:msip:setup`.
 */
import { BASELINE_1_0_0 } from './baseline_1_0_0.js';
import type { BaseModelMigration } from './types.js';

export type { BaseModelMigration } from './types.js';
export { BASELINE_1_0_0 } from './baseline_1_0_0.js';
export { checkMigrationPolicy } from './policy.js';
export type { MigrationPolicyViolation } from './policy.js';

/** Pasos del modelo base, en orden. */
export const BASE_MODEL_MIGRATIONS: readonly BaseModelMigration[] = [BASELINE_1_0_0];

/** Marcador que identifica el paso en el nombre del archivo generado. */
export function migrationMarker(migration: BaseModelMigration): string {
  return `base_model_${migration.from}_${migration.to}_${migration.slug}`;
}

export interface SetupPlan {
  missing: BaseModelMigration[];
  present: BaseModelMigration[];
}

/**
 * Decide qué pasos faltan a partir de los nombres de archivo ya presentes en
 * `db/migrations/` (un paso está tomado si hay un archivo que lleva su marcador).
 */
export function planSetup(
  migrations: readonly BaseModelMigration[],
  existingFiles: readonly string[],
): SetupPlan {
  const missing: BaseModelMigration[] = [];
  const present: BaseModelMigration[] = [];
  for (const migration of migrations) {
    const marker = migrationMarker(migration);
    (existingFiles.some((file) => file.includes(marker)) ? present : missing).push(migration);
  }
  return { missing, present };
}

/**
 * Trocea un guion SQL en sentencias (sin `;` final), respetando cadenas con
 * comillas simples, cadenas con *dollar-quoting* (`$$`/`$tag$`) y comentarios
 * de línea (`--`) y de bloque. Postgres por el protocolo extendido no acepta
 * varias sentencias juntas, así que el paso las ejecuta una por una.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '$') {
      const match = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (match) {
        const tag = match[0];
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? n : end + tag.length;
        current += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }
    if (ch === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  const last = current.trim();
  if (last) statements.push(last);
  return statements;
}

/** Contenido de la migración Kysely que el consumidor aplica con `db:migrate`. */
export function renderMigrationFile(migration: BaseModelMigration): string {
  const up = splitSqlStatements(migration.upSql);
  const down = splitSqlStatements(migration.downSql);
  return `// Migración del modelo base ${migration.from} → ${migration.to} (${migration.slug}).
// Generada por \`m eng:msip:setup\` (https://gitlab.com/pasosdeJesus/m/-/work_items/46 D11). No editar a mano.
import { Kysely, sql } from 'kysely';

const UP = ${JSON.stringify(up, null, 2)};

const DOWN = ${JSON.stringify(down, null, 2)};

export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) {
    await sql.raw(statement).execute(db);
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) {
    await sql.raw(statement).execute(db);
  }
}
`;
}
