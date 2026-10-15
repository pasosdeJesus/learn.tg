/**
 * Types of the base model (https://github.com/pasosdeJesus/learn.tg/issues/260, Part A in `m`).
 *
 * The DB handle is injected through `SqlExecutor`: `m` never creates a
 * connection and never depends on a query builder at runtime (decision D3).
 * Consumers can pass a `pg` Pool/Client (its `query(text, values)` already has
 * this shape) or a small adapter over Kysely's `executeQuery`.
 */

export interface SqlExecutor {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export interface ColumnSpec {
  name: string;
  type: string;
  notNull: boolean;
  default?: string;
}

export interface ConstraintSpec {
  name: string;
  kind: 'primary-key' | 'unique' | 'foreign-key' | 'check';
  definition: string;
  columns: string[];
  references?: { table: string; columns: string[] };
}

export interface TableSpec {
  name: string;
  columns: ColumnSpec[];
  constraints: ConstraintSpec[];
}

export interface SequenceSpec {
  name: string;
  definition: string;
  ownedBy?: { table: string; column: string };
}

export interface ServerDefaultSpec {
  table: string;
  column: string;
  default: string;
}

export interface IndexSpec {
  name: string;
  table: string;
  unique: boolean;
  definition: string;
}

export interface ParsedStructure {
  tables: Record<string, TableSpec>;
  sequences: Record<string, SequenceSpec>;
  serverDefaults: ServerDefaultSpec[];
  indexes: IndexSpec[];
}

export interface BaselineInventory {
  version: string;
  tables: Record<string, { columns: Record<string, ColumnSpec>; constraints: ConstraintSpec[] }>;
  counts: Record<string, number>;
}

export interface BaselineExtensions {
  /** "table.column" entries that belong to the consumer, not to the base. */
  columns: string[];
  /** "table.constraint" entries that belong to the consumer. */
  constraints: string[];
}

/**
 * Entries the base model declares **beyond** its reference database.
 *
 * The reference (msip-2.2) is the source of truth for the shared columns; this
 * list is the reviewed addition for everything the base model wants and the
 * reference does not have yet: a whole table the consumer apps share (the wallet
 * link), columns the base queries use, or an integrity rule. It is the mirror of
 * `BaselineExtensions` when the reference is a superset: with a subset reference
 * (msip) there is nothing to subtract, only something to add.
 */
export interface BaselineAdditions {
  /** Tables the base declares although the reference does not have them. */
  tables: TableSpec[];
  /** Sequences those tables need (their `id` defaults). */
  sequences: SequenceSpec[];
  /** Columns added to tables that do exist in the reference. */
  columns: Array<ColumnSpec & { table: string }>;
  /** Constraints added to tables that do exist in the reference. */
  constraints: Array<ConstraintSpec & { table: string }>;
}

export type CheckGrade = 'drift' | 'absent' | 'extra';

export interface CheckFinding {
  table: string;
  column?: string;
  constraint?: string;
  grade: CheckGrade;
  detail: string;
}

export interface CheckReport {
  ok: boolean;
  baseModelVersion: string;
  findings: CheckFinding[];
  tablesChecked: number;
  tablesAbsent: string[];
  summary: { drift: number; absent: number; extra: number };
}

/** Base columns of the learner (groups A and B of the upstream annex). */
export interface UsuarioBase {
  id: number;
  nusuario: string;
  nombre?: string | null;
  descripcion?: string | null;
  email: string;
  rol?: number | null;
  idioma?: string | null;
  pais_id?: number | null;
  religion_id?: number | null;
  oficina_id?: number | null;
  tema_id?: number | null;
  fechacreacion: string;
  fechadeshabilitacion?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [extension: string]: unknown;
}

/** Legacy columns kept for the Rails backoffice; `m` types but never writes them. */
export interface UsuarioLegacy {
  password?: string;
  encrypted_password?: string;
  reset_password_token?: string | null;
  sign_in_count?: number;
  failed_attempts?: number;
  unlock_token?: string | null;
  locked_at?: string | null;
}

export interface Usuario extends UsuarioBase, UsuarioLegacy {}

export interface BilleteraUsuario {
  id: number;
  billetera: string;
  usuario_id: number;
  created_at: string;
  updated_at: string;
  [extension: string]: unknown;
}

export interface Pais {
  id: number;
  nombre: string;
  alfa2?: string | null;
  alfa3?: string | null;
  fechacreacion?: string | null;
  fechadeshabilitacion?: string | null;
  [extension: string]: unknown;
}

export interface Departamento extends Pais {}

export interface Municipio {
  id: number;
  nombre: string;
  departamento_id?: number | null;
  pais_id?: number | null;
  fechacreacion?: string | null;
  fechadeshabilitacion?: string | null;
  [extension: string]: unknown;
}

export interface CentroPoblado {
  id: number;
  nombre: string;
  municipio_id?: number | null;
  departamento_id?: number | null;
  pais_id?: number | null;
  fechacreacion?: string | null;
  fechadeshabilitacion?: string | null;
  [extension: string]: unknown;
}

export interface VisibilityConfig {
  /** Column that marks a row as publicly visible (e.g. `mostrar_cursos_publico`). */
  columns: string[];
  /** Value that means "public"; defaults to boolean true. */
  publicValue?: unknown;
}

export interface GeoCascadeQuery {
  q?: string;
  municipalityId?: number;
  departamentoId?: number;
  limit?: number;
}

export interface TownResult {
  id: number;
  nombre: string;
  municipio_id?: number | null;
  municipio?: string | null;
  departamento?: string | null;
  pais?: string | null;
}
