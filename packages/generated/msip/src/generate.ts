import { normalizeType } from './parse-structure.js';
import type {
  BaselineAdditions, BaselineExtensions, BaselineInventory, ColumnSpec, ConstraintSpec, ParsedStructure,
  SequenceSpec, ServerDefaultSpec, TableSpec,
} from './types.js';

export interface GenerateOptions {
  parsed: ParsedStructure;
  extensions: BaselineExtensions;
  /** Entries the base declares beyond the reference (see references/msip.ts). */
  additions?: BaselineAdditions;
  /** Where the additions come from, for the manifest (path or "built-in"). */
  additionsSource?: string;
  version: string;
  reference?: { source: string; sha256: string };
  tables?: readonly string[];
}

export interface GeneratedBaseline {
  sql: string;
  inventory: BaselineInventory;
  manifest: {
    version: string;
    reference?: { source: string; sha256: string };
    additions?: string;
    tables: Record<string, { columns: number; constraints: number; extensions: number }>;
    externalConstraints: Array<{ table: string; name: string; references: string }>;
  };
}

const GENERATED_HEADER = [
  '-- Base model baseline (generated, do not edit by hand).',
  '-- Source of truth: the reference database; regenerate with',
  '--   bin/m eng:msip:dump --from-structure <structure.sql> [--additions <file>]',
  '-- Consumers apply this to a fresh database and then their own migrations.',
];

function isExtensionColumn(table: string, column: string, extensions: BaselineExtensions): boolean {
  return extensions.columns.includes(`${table}.${column}`);
}

function isExtensionConstraint(table: string, constraint: string, extensions: BaselineExtensions): boolean {
  return extensions.constraints.includes(`${table}.${constraint}`);
}

function renderColumn(column: ColumnSpec): string {
  const parts = [`    ${column.name} ${column.type}`];
  if (column.default !== undefined) parts.push(`DEFAULT ${column.default}`);
  if (column.notNull) parts.push('NOT NULL');
  return parts.join(' ');
}

function renderConstraint(table: string, constraint: ConstraintSpec): string {
  return `ALTER TABLE ONLY public.${table}\n    ADD CONSTRAINT ${constraint.name} ${constraint.definition};`;
}

function renderServerDefault(spec: ServerDefaultSpec): string {
  return `ALTER TABLE ONLY public.${spec.table} ALTER COLUMN ${spec.column} SET DEFAULT ${spec.default};`;
}

function renderSequence(sequence: SequenceSpec): string {
  const owned = sequence.ownedBy
    ? `\n\nALTER SEQUENCE public.${sequence.name} OWNED BY public.${sequence.ownedBy.table}.${sequence.ownedBy.column};`
    : '';
  return `${sequence.definition};${owned}`;
}

/**
 * Tables the derivation looks at: every table of the reference structure (the
 * motor's real schema, `db/structure.sql`) plus the tables an addition declares.
 */
function resolveTables(options: GenerateOptions): readonly string[] {
  const base = options.tables ?? Object.keys(options.parsed.tables);
  const added = (options.additions?.tables ?? []).map((spec) => spec.name);
  return [...new Set<string>([...(base as readonly string[]), ...added])];
}

function isExternalFk(constraint: ConstraintSpec, tables: Set<string>): boolean {
  return constraint.kind === 'foreign-key'
    && constraint.references !== undefined
    && !tables.has(constraint.references.table);
}

/**
 * Spec of a base table: what the reference has (minus the declared extensions and
 * the foreign keys pointing outside the base), plus what the reviewed additions
 * declare for it. Returns `undefined` when neither has the table: the reference
 * (msip-2.2) does not have every table the base model knows, and a table it does
 * not have is not part of the baseline unless an addition defines it.
 */
function resolveTableSpec(
  parsed: ParsedStructure,
  table: string,
  options: GenerateOptions,
  tables: Set<string>,
): TableSpec | undefined {
  const additions = options.additions;
  const extension = options.extensions;
  const source = parsed.tables[table];
  let spec: TableSpec | undefined;

  if (source) {
    const keepsConstraint = (constraint: ConstraintSpec) => {
      if (isExtensionConstraint(table, constraint.name, extension)) return false;
      if (isExternalFk(constraint, tables)) return false;
      if (constraint.kind === 'check') return true;
      return constraint.columns.every((column) => !isExtensionColumn(table, column, extension));
    };
    spec = {
      name: table,
      columns: source.columns.filter((column) => !isExtensionColumn(table, column.name, extension)),
      constraints: source.constraints.filter(keepsConstraint),
    };
  }

  const additionTable = additions?.tables.find((entry) => entry.name === table);
  if (additionTable) {
    spec = spec ?? { name: table, columns: [], constraints: [] };
    for (const column of additionTable.columns) {
      if (!spec.columns.some((existing) => existing.name === column.name)) spec.columns.push(column);
    }
    for (const constraint of additionTable.constraints) {
      if (!spec.constraints.some((existing) => existing.name === constraint.name)) spec.constraints.push(constraint);
    }
  }

  for (const column of additions?.columns ?? []) {
    if (column.table !== table) continue;
    spec = spec ?? { name: table, columns: [], constraints: [] };
    if (spec.columns.some((existing) => existing.name === column.name)) continue;
    const { table: _table, ...rest } = column;
    spec.columns.push(rest);
  }

  for (const constraint of additions?.constraints ?? []) {
    if (constraint.table !== table) continue;
    spec = spec ?? { name: table, columns: [], constraints: [] };
    if (spec.constraints.some((existing) => existing.name === constraint.name)) continue;
    const { table: _table, ...rest } = constraint;
    spec.constraints.push(rest);
  }

  return spec;
}

function collectExternalConstraints(
  parsed: ParsedStructure,
  tables: Set<string>,
  extensions: BaselineExtensions,
): GeneratedBaseline['manifest']['externalConstraints'] {
  const external: GeneratedBaseline['manifest']['externalConstraints'] = [];
  for (const [table, spec] of Object.entries(parsed.tables)) {
    if (!tables.has(table)) continue;
    for (const constraint of spec.constraints) {
      if (isExtensionConstraint(table, constraint.name, extensions)) continue;
      if (!isExternalFk(constraint, tables)) continue;
      external.push({
        table,
        name: constraint.name,
        references: `${constraint.references!.table}(${constraint.references!.columns.join(',')})`,
      });
    }
  }
  return external;
}

export function buildInventory(parsed: ParsedStructure, options: GenerateOptions): BaselineInventory {
  const tables = resolveTables(options) as readonly string[];
  const tableSet = new Set<string>(tables as readonly string[]);
  const inventory: BaselineInventory = { version: options.version, tables: {}, counts: {} };
  for (const table of tables) {
    const spec = resolveTableSpec(parsed, table, options, tableSet);
    if (!spec) continue; // the reference does not have it and no addition declares it
    const columns: Record<string, ColumnSpec> = {};
    for (const column of spec.columns) {
      columns[column.name] = { ...column, type: normalizeType(column.type) };
    }
    inventory.tables[table] = { columns, constraints: spec.constraints };
    inventory.counts[table] = spec.columns.length;
  }
  return inventory;
}

export function renderBaselineSql(parsed: ParsedStructure, options: GenerateOptions): string {
  const tables = resolveTables(options) as readonly string[];
  const tableSet = new Set<string>(tables as readonly string[]);
  const blocks: string[] = [
    ...GENERATED_HEADER,
    `-- Base model version: ${options.version}`,
  ];
  if (options.reference) {
    blocks.push(`-- Reference: ${options.reference.source} (sha256 ${options.reference.sha256})`);
  }
  blocks.push('');

  const specs = tables
    .map((table) => resolveTableSpec(parsed, table, options, tableSet))
    .filter((spec): spec is TableSpec => spec !== undefined);

  // Una secuencia pertenece a la tabla que la **posee** (`OWNED BY`); si no lo
  // declara, a la tabla de nombre más largo que la prefija. El prefijo solo no
  // basta: emitiría la secuencia una vez por cada tabla-prefijo
  // (p. ej. `msip_pais` y `msip_pais_histvigencia`).
  const sequenceOwner = (name: string): string | undefined => {
    const owned = Object.values(parsed.sequences).find((sequence) => sequence.name === name)?.ownedBy?.table;
    if (owned && tableSet.has(owned)) return owned;
    let best: string | undefined;
    for (const table of tables) {
      if (name.startsWith(`${table}_`) && (!best || table.length > best.length)) best = table;
    }
    return best;
  };
  const allSequences = [
    ...Object.values(parsed.sequences),
    ...(options.additions?.sequences ?? []).filter((sequence) => !parsed.sequences[sequence.name]),
  ];
  for (const table of tables) {
    const sequences = allSequences
      .filter((sequence) => sequenceOwner(sequence.name) === table)
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const sequence of sequences) blocks.push(renderSequence(sequence));
    if (sequences.length > 0) blocks.push('');
  }

  for (const spec of specs) {
    const body = [
      ...spec.columns.map(renderColumn),
      ...spec.constraints.filter((constraint) => constraint.kind === 'check').map((constraint) => `    CONSTRAINT ${constraint.name} ${constraint.definition}`),
    ];
    blocks.push(`CREATE TABLE public.${spec.name} (\n${body.join(',\n')}\n);`, '');
  }

  for (const spec of specs) {
    for (const constraint of spec.constraints) {
      if (constraint.kind === 'check' || constraint.kind === 'foreign-key') continue;
      blocks.push(renderConstraint(spec.name, constraint), '');
    }
  }

  for (const spec of specs) {
    for (const constraint of spec.constraints) {
      if (constraint.kind !== 'foreign-key') continue;
      blocks.push(renderConstraint(spec.name, constraint), '');
    }
  }

  for (const table of tables) {
    const defaults = parsed.serverDefaults
      .filter((spec) => spec.table === table)
      .filter((spec) => !isExtensionColumn(table, spec.column, options.extensions))
      .sort((a, b) => (a.column < b.column ? -1 : 1));
    for (const spec of defaults) blocks.push(renderServerDefault(spec), '');
  }

  return `${blocks.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

export function buildBaseline(options: GenerateOptions): GeneratedBaseline {
  const tables = resolveTables(options) as readonly string[];
  const tableSet = new Set<string>(tables as readonly string[]);
  const inventory = buildInventory(options.parsed, options);
  const manifestTables: GeneratedBaseline['manifest']['tables'] = {};
  for (const table of tables) {
    const source = options.parsed.tables[table];
    manifestTables[table] = {
      columns: inventory.tables[table] ? Object.keys(inventory.tables[table].columns).length : 0,
      constraints: inventory.tables[table]?.constraints.length ?? 0,
      extensions: source
        ? source.columns.filter((column) => isExtensionColumn(table, column.name, options.extensions)).length
        : 0,
    };
  }
  return {
    sql: renderBaselineSql(options.parsed, options),
    inventory,
    manifest: {
      version: options.version,
      reference: options.reference,
      additions: options.additionsSource,
      tables: manifestTables,
      externalConstraints: collectExternalConstraints(options.parsed, tableSet, options.extensions),
    },
  };
}

export function renderGeneratedModule(baseline: GeneratedBaseline): string {
  return [
    '// Generated by `bin/m eng:msip:dump`; do not edit by hand.',
    "import type { BaselineInventory } from './types.js';",
    '',
    `export const BASELINE_GENERATED_MANIFEST = ${JSON.stringify(baseline.manifest, null, 2)} as const;`,
    '',
    `export const BASELINE_INVENTORY: BaselineInventory = ${JSON.stringify(baseline.inventory, null, 2)};`,
    '',
    `export const BASELINE_SQL = ${JSON.stringify(baseline.sql)};`,
    '',
  ].join('\n');
}
