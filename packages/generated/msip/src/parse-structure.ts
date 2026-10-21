import type {
  ConstraintSpec, IndexSpec, ParsedStructure, SequenceSpec, ServerDefaultSpec, TableSpec,
} from './types.js';

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let inQuote = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'" ) inQuote = !inQuote;
    if (!inQuote) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function findTopLevel(text: string, needle: string): number {
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i <= text.length - needle.length; i++) {
    const ch = text[i];
    if (ch === "'") inQuote = !inQuote;
    if (!inQuote) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (depth === 0 && text.startsWith(needle, i)) return i;
    }
  }
  return -1;
}

export function normalizeType(type: string): string {
  return type
    .replace(/\s+COLLATE\s+\S+/i, '')
    // `information_schema.datetime_precision` is 6 both for `timestamp` and
    // `timestamp(6)`, so the explicit default precision is not comparable.
    .replace(/\b(timestamp|time)\(6\)/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseConstraint(item: string): ConstraintSpec | null {
  const match = item.match(/^CONSTRAINT\s+(\S+)\s+([\s\S]+)$/);
  if (!match) return null;
  const name = match[1];
  const definition = match[2].trim();
  const kind: ConstraintSpec['kind'] = /PRIMARY KEY/i.test(definition)
    ? 'primary-key'
    : /UNIQUE/i.test(definition)
      ? 'unique'
      : /FOREIGN KEY/i.test(definition)
        ? 'foreign-key'
        : 'check';
  const columnsMatch = definition.match(/\((?:[^()]|\([^()]*\))*\)/);
  const columns = columnsMatch
    ? columnsMatch[0].slice(1, -1).split(',').map((column) => column.trim().split(/\s+/)[0])
    : [];
  const referencesMatch = definition.match(/REFERENCES\s+public\.(\w+)\s*\(([^)]*)\)/);
  return {
    name,
    kind,
    definition,
    columns,
    references: referencesMatch
      ? { table: referencesMatch[1], columns: referencesMatch[2].split(',').map((column) => column.trim()) }
      : undefined,
  };
}

function parseColumn(item: string) {
  const match = item.match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) return null;
  const name = match[1];
  let rest = match[2].trim();
  // `NOT NULL` may precede other column options (pg_dump writes
  // `nombre character varying(200) NOT NULL COLLATE public.es_co_utf_8`).
  const notNull = /\bNOT NULL\b/i.test(rest);
  rest = rest.replace(/\s*\bNOT NULL\b/i, '').trim();
  let defaultValue: string | undefined;
  const defaultIndex = findTopLevel(rest, ' DEFAULT ');
  if (defaultIndex >= 0) {
    defaultValue = rest.slice(defaultIndex + ' DEFAULT '.length).trim();
    rest = rest.slice(0, defaultIndex).trim();
  }
  return { name, type: normalizeType(rest), notNull, default: defaultValue };
}

export function parseStructureSql(sql: string, tables?: readonly string[]): ParsedStructure {
  const wanted = tables ? new Set(tables) : null;
  const parsed: ParsedStructure = { tables: {}, sequences: {}, serverDefaults: [], indexes: [] };

  const tableRe = /^CREATE TABLE (?:ONLY )?public\.(\w+) \(\r?\n([\s\S]*?)\r?\n\);/gm;
  for (const match of sql.matchAll(tableRe)) {
    const name = match[1];
    if (wanted && !wanted.has(name)) continue;
    const columns: TableSpec['columns'] = [];
    const constraints: ConstraintSpec[] = [];
    for (const item of splitTopLevel(match[2])) {
      if (/^CONSTRAINT\s/i.test(item)) {
        const constraint = parseConstraint(item);
        if (constraint) constraints.push(constraint);
        continue;
      }
      const column = parseColumn(item);
      if (column) columns.push(column);
    }
    parsed.tables[name] = { name, columns, constraints };
  }

  const sequenceRe = /^CREATE SEQUENCE public\.(\w+)\r?\n([\s\S]*?);/gm;
  for (const match of sql.matchAll(sequenceRe)) {
    const name = match[1];
    const definition = match[2].trim();
    const owned = definition.match(/OWNED BY public\.(\w+)\.(\w+)/);
    const spec: SequenceSpec = {
      name,
      definition: `CREATE SEQUENCE public.${name}\n    ${definition}`,
      ownedBy: owned ? { table: owned[1], column: owned[2] } : undefined,
    };
    if (wanted && !wanted.has(name.replace(/_\w+_seq$/, ''))) continue;
    parsed.sequences[name] = spec;
  }

  const defaultRe = /^ALTER TABLE (?:ONLY )?public\.(\w+) ALTER COLUMN (\w+) SET DEFAULT ([\s\S]*?);/gm;
  for (const match of sql.matchAll(defaultRe)) {
    const spec: ServerDefaultSpec = { table: match[1], column: match[2], default: match[3].trim() };
    if (wanted && !wanted.has(spec.table)) continue;
    parsed.serverDefaults.push(spec);
  }

  const constraintRe = /^ALTER TABLE (?:ONLY )?public\.(\w+)\r?\n\s*ADD CONSTRAINT (\S+) ([\s\S]*?);/gm;
  for (const match of sql.matchAll(constraintRe)) {
    const table = match[1];
    if (wanted && !wanted.has(table)) continue;
    const tableSpec = parsed.tables[table];
    if (!tableSpec) continue;
    const constraint = parseConstraint(`CONSTRAINT ${match[2]} ${match[3]}`);
    if (constraint) tableSpec.constraints.push(constraint);
  }

  const indexRe = /^CREATE (UNIQUE )?INDEX (\w+) ON public\.(\w+) USING btree ([\s\S]*?);/gm;
  for (const match of sql.matchAll(indexRe)) {
    const spec: IndexSpec = {
      name: match[2],
      table: match[3],
      unique: Boolean(match[1]),
      definition: `CREATE ${match[1] ?? ''}INDEX ${match[2]} ON public.${match[3]} USING btree ${match[4].trim()}`,
    };
    if (wanted && !wanted.has(spec.table)) continue;
    parsed.indexes.push(spec);
  }

  return parsed;
}
