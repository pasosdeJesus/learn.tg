import { normalizeType } from './parse-structure.js';
import { BASE_MODEL_TABLES, type BaseModelTable } from './version.js';
import type {
  BaselineInventory, CheckFinding, CheckReport, ColumnSpec, ConstraintSpec, ParsedStructure,
  SqlExecutor, TableSpec,
} from './types.js';

function canonicalConstraint(constraint: ConstraintSpec): string {
  const columns = [...constraint.columns].sort().join(',');
  const reference = constraint.references
    ? `${constraint.references.table}(${[...constraint.references.columns].sort().join(',')})`
    : '';
  return `${constraint.kind}:${columns}:${reference}`;
}

export function inventoryFromParsed(parsed: ParsedStructure, tables: readonly string[] = BASE_MODEL_TABLES, version = ''): BaselineInventory {
  const inventory: BaselineInventory = { version, tables: {}, counts: {} };
  for (const table of tables) {
    const source: TableSpec | undefined = parsed.tables[table];
    if (!source) continue;
    const columns: Record<string, ColumnSpec> = {};
    for (const column of source.columns) {
      columns[column.name] = { ...column, type: normalizeType(column.type) };
    }
    inventory.tables[table] = { columns, constraints: source.constraints };
    inventory.counts[table] = source.columns.length;
  }
  return inventory;
}

export function compareInventories(expected: BaselineInventory, actual: BaselineInventory): CheckReport {
  const findings: CheckFinding[] = [];
  const tablesAbsent: string[] = [];
  let tablesChecked = 0;

  for (const [table, baseTable] of Object.entries(expected.tables)) {
    const liveTable = actual.tables[table];
    if (!liveTable) {
      tablesAbsent.push(table);
      findings.push({
        table,
        grade: 'absent',
        detail: `base table "${table}" is missing (apply base model ${expected.version || ''}`.trim() + ')',
      });
      continue;
    }
    tablesChecked++;

    for (const [columnName, baseColumn] of Object.entries(baseTable.columns)) {
      const liveColumn = liveTable.columns[columnName];
      if (!liveColumn) {
        findings.push({ table, column: columnName, grade: 'drift', detail: `base column "${table}.${columnName}" is missing` });
        continue;
      }
      const baseType = normalizeType(baseColumn.type);
      const liveType = normalizeType(liveColumn.type);
      if (baseType !== liveType) {
        findings.push({
          table,
          column: columnName,
          grade: 'drift',
          detail: `"${table}.${columnName}" has type "${liveType}", base declares "${baseType}"`,
        });
      }
      if (baseColumn.notNull && !liveColumn.notNull) {
        findings.push({
          table,
          column: columnName,
          grade: 'drift',
          detail: `"${table}.${columnName}" is nullable, base declares NOT NULL`,
        });
      }
    }

    const liveByCanonical = new Set(liveTable.constraints.map(canonicalConstraint));
    for (const constraint of baseTable.constraints) {
      if (constraint.kind === 'check') {
        if (!liveTable.constraints.some((live) => live.name === constraint.name)) {
          findings.push({
            table,
            constraint: constraint.name,
            grade: 'drift',
            detail: `base check "${constraint.name}" is missing`,
          });
        }
        continue;
      }
      if (!liveByCanonical.has(canonicalConstraint(constraint))) {
        findings.push({
          table,
          constraint: constraint.name,
          grade: 'drift',
          detail: `base constraint "${constraint.name}" (${constraint.kind}) is missing on "${table}"`,
        });
      }
    }

    for (const live of liveTable.constraints) {
      const known = baseTable.constraints.some((base) => base.name === live.name || canonicalConstraint(base) === canonicalConstraint(live));
      if (!known) {
        findings.push({ table, constraint: live.name, grade: 'extra', detail: `consumer constraint "${live.name}" (${live.kind})` });
      }
    }
    for (const liveColumn of Object.keys(liveTable.columns)) {
      if (!baseTable.columns[liveColumn]) {
        findings.push({ table, column: liveColumn, grade: 'extra', detail: `consumer column "${table}.${liveColumn}"` });
      }
    }
  }

  const summary = {
    drift: findings.filter((finding) => finding.grade === 'drift').length,
    absent: findings.filter((finding) => finding.grade === 'absent').length,
    extra: findings.filter((finding) => finding.grade === 'extra').length,
  };
  return {
    ok: summary.drift === 0 && summary.absent === 0,
    baseModelVersion: expected.version,
    findings,
    tablesChecked,
    tablesAbsent,
    summary,
  };
}

function dbType(row: {
  data_type: string; character_maximum_length: number | null; datetime_precision: number | null;
  numeric_precision: number | null; numeric_scale: number | null; udt_name: string;
}): string {
  const dataType = row.data_type;
  if (dataType === 'character varying' || dataType === 'character') {
    return row.character_maximum_length === null ? dataType : `${dataType}(${row.character_maximum_length})`;
  }
  if (dataType === 'numeric') {
    return row.numeric_precision === null ? 'numeric' : `numeric(${row.numeric_precision},${row.numeric_scale ?? 0})`;
  }
  if (dataType.startsWith('timestamp')) {
    return row.datetime_precision === null || row.datetime_precision === 6
      ? dataType
      : `timestamp(${row.datetime_precision})${dataType.replace('timestamp', '')}`;
  }
  return dataType;
}

function sqlTableList(tables: readonly string[]): string {
  return tables.map((table) => `'${table.replace(/'/g, "''")}'`).join(', ');
}

export async function inventoryFromDb(
  db: SqlExecutor,
  tables: readonly string[] = BASE_MODEL_TABLES,
  version = '',
): Promise<BaselineInventory> {
  const inventory: BaselineInventory = { version, tables: {}, counts: {} };
  const tableList = sqlTableList(tables);
  const columnsResult = await db.query<{
    table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null;
    character_maximum_length: number | null; datetime_precision: number | null; numeric_precision: number | null;
    numeric_scale: number | null; udt_name: string;
  }>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default,
            character_maximum_length, datetime_precision, numeric_precision, numeric_scale, udt_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN (${tableList})
      ORDER BY table_name, ordinal_position`,
  );
  const constraintsResult = await db.query<{ table_name: string; conname: string; contype: string; definition: string }>(
    `SELECT t.relname AS table_name, c.conname, c.contype::text AS contype, pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname IN (${tableList}) AND c.contype IN ('p','u','f','c')
      ORDER BY t.relname, c.conname`,
  );

  const kinds: Record<string, ConstraintSpec['kind']> = {
    p: 'primary-key', u: 'unique', f: 'foreign-key', c: 'check',
  };

  for (const row of columnsResult.rows) {
    const table = inventory.tables[row.table_name] ?? (inventory.tables[row.table_name] = {
      columns: {}, constraints: [],
    });
    table.columns[row.column_name] = {
      name: row.column_name,
      type: dbType(row),
      notNull: row.is_nullable === 'NO',
      default: row.column_default ?? undefined,
    };
  }

  for (const row of constraintsResult.rows) {
    const table = inventory.tables[row.table_name];
    if (!table) continue;
    const columnsMatch = row.definition.match(/\((?:[^()]|\([^()]*\))*\)/);
    const referencesMatch = row.definition.match(/REFERENCES\s+(?:\w+\.)?(\w+)\s*\(([^)]*)\)/);
    table.constraints.push({
      name: row.conname,
      kind: kinds[row.contype] ?? 'check',
      definition: row.definition,
      columns: columnsMatch ? columnsMatch[0].slice(1, -1).split(',').map((column) => column.trim()) : [],
      references: referencesMatch
        ? { table: referencesMatch[1], columns: referencesMatch[2].split(',').map((column) => column.trim()) }
        : undefined,
    });
  }

  for (const table of Object.keys(inventory.tables)) {
    inventory.counts[table] = Object.keys(inventory.tables[table].columns).length;
  }
  return inventory;
}

export function formatCheckReport(report: CheckReport): string {
  const lines: string[] = [];
  lines.push(`Base model ${report.baseModelVersion}: ${report.ok ? 'compliant' : 'DRIFT'}`);
  lines.push(`  tables checked: ${report.tablesChecked}`);
  if (report.tablesAbsent.length > 0) lines.push(`  absent tables: ${report.tablesAbsent.join(', ')}`);
  for (const finding of report.findings.filter((entry) => entry.grade !== 'extra')) {
    lines.push(`  [${finding.grade}] ${finding.detail}`);
  }
  const extras = report.findings.filter((entry) => entry.grade === 'extra');
  if (extras.length > 0) lines.push(`  [extra] ${extras.length} consumer additions (not a failure)`);
  return lines.join('\n');
}
