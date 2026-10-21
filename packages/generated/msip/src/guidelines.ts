export interface Guideline {
  n: number;
  title: string;
  text: string;
}

/**
 * Guidelines of the base model (https://github.com/pasosdeJesus/learn.tg/issues/260 §3.2), numbered so a consumer
 * can cite them. Guideline 6 is the generic form of the privacy rule: the base
 * ships the mechanism, the consumer declares its flag columns.
 */
export const GUIDELINES: Guideline[] = [
  {
    n: 1,
    title: 'The base is additive and shared',
    text: 'A consumer may add columns, tables, indexes and triggers. It may not remove, rename or reinterpret a base column; if the base itself must change, `m` publishes a new msip version and the consumers adopt it.',
  },
  {
    n: 2,
    title: 'Extensions must not break the base or another consumer',
    text: 'New columns are nullable or carry a default, and they never change the meaning of a base column.',
  },
  {
    n: 3,
    title: 'The primary key of `usuario` is immutable',
    text: 'Foreign keys point at it (27 in learn.tg): no renumbering, no re-creation, no TRUNCATE. The same holds for the catalogs identifiers.',
  },
  {
    n: 4,
    title: 'Wallets are lowercase',
    text: 'Stored and compared with LOWER(billetera) = LOWER(?).',
  },
  {
    n: 5,
    title: 'The public name is `nusuario`',
    text: 'Never `nombre`; base queries do not expose `nombre` outside the owner-facing profile.',
  },
  {
    n: 6,
    title: 'Visibility flags are honored by every public surface',
    text: 'The base exposes a generic visibility configuration (column names); every query that feeds a public listing must honor it, and the consumer declares those columns in its own migrations and documentation.',
  },
  {
    n: 7,
    title: 'Triggers are allowed and are the consumer\'s responsibility',
    text: 'They must not change the result of a base query, and the consumer documents them.',
  },
  {
    n: 8,
    title: 'No PII in logs',
    text: 'Neither the base queries nor the consumer log personal data.',
  },
  {
    n: 9,
    title: 'Extensions live in the consumer\'s own migrations',
    text: 'Never by editing the baseline; they are documented where that consumer documents its schema.',
  },
  {
    n: 10,
    title: 'A consumer declares the msip version it is on',
    text: 'It records the version, re-runs the conformance check when adopting a new one, and the check is part of the consumer test suite.',
  },
];

export function renderGuidelines(): string {
  return GUIDELINES.map((guideline) => `${guideline.n}. **${guideline.title}.** ${guideline.text}`).join('\n\n');
}
