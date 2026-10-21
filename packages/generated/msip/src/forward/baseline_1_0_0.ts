/**
 * Paso 0.0.0 → 1.0.0: el baseline del modelo base.
 *
 * Es el primer paso que recibe un proyecto nuevo: en vez de que el consumidor
 * escriba a mano la migración del baseline (lo que los tutoriales tenían que
 * explicar), `eng:msip:setup` la genera. `down` revierte el esquema base a
 * vacío (drop de las tablas y la secuencia).
 */
import { BASELINE_SQL } from '../baseline.generated.js';
import { BASE_MODEL_TABLES } from '../version.js';
import type { BaseModelMigration } from './types.js';

const SEQUENCES = [...BASELINE_SQL.matchAll(/CREATE SEQUENCE public\.(\w+)/g)].map((match) => match[1]);

const DOWN_SQL = [
  ...[...BASE_MODEL_TABLES].reverse().map((table) => `DROP TABLE IF EXISTS public.${table} CASCADE;`),
  ...SEQUENCES.map((sequence) => `DROP SEQUENCE IF EXISTS public.${sequence};`),
].join('\n');

export const BASELINE_1_0_0: BaseModelMigration = {
  from: '0.0.0',
  to: '1.0.0',
  slug: 'baseline',
  description: `Base model 1.0.0 baseline: ${BASE_MODEL_TABLES.join(', ')}`,
  upSql: BASELINE_SQL,
  downSql: DOWN_SQL,
};
