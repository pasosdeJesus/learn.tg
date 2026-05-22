import { Kysely, sql } from 'kysely'

/**
 * Enforce lowercase wallet addresses in billetera_usuario and transaction tables.
 *
 * Wallet addresses are hex strings (0x…). They should always be stored in
 * lowercase for consistency. Existing data varies in case, so we first
 * normalize all rows, then add triggers to enforce lowercase on INSERT/UPDATE.
 */
export async function up(db: Kysely<any>): Promise<void> {
  const tablas = [
    { tabla: 'billetera_usuario', columna: 'billetera' },
    { tabla: 'transaction', columna: 'wallet' },
  ]

  for (const { tabla, columna } of tablas) {
    // 1. Normalize existing data
    await sql`
      UPDATE ${sql.table(tabla)}
      SET ${sql.ref(columna)} = LOWER(${sql.ref(columna)})
      WHERE ${sql.ref(columna)} IS NOT NULL
        AND ${sql.ref(columna)} <> LOWER(${sql.ref(columna)})
    `.execute(db)

    // 2. Drop existing trigger if any (idempotent)
    await sql`
      DROP TRIGGER IF EXISTS ${sql.ref(`${tabla}_lowercase_${columna}_trigger`)}
      ON ${sql.table(tabla)}
    `.execute(db)

    // 3. Create trigger function (one per table)
    const fnName = `${tabla}_lowercase_${columna}_fn`
    await sql`
      DROP FUNCTION IF EXISTS ${sql.ref(fnName)}() CASCADE
    `.execute(db)

    await sql`
      CREATE FUNCTION ${sql.ref(fnName)}()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.${sql.ref(columna)} := LOWER(NEW.${sql.ref(columna)});
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `.execute(db)

    // 4. Create trigger
    await sql`
      CREATE TRIGGER ${sql.ref(`${tabla}_lowercase_${columna}_trigger`)}
      BEFORE INSERT OR UPDATE OF ${sql.ref(columna)}
      ON ${sql.table(tabla)}
      FOR EACH ROW
      EXECUTE FUNCTION ${sql.ref(fnName)}()
    `.execute(db)
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  const tablas = [
    { tabla: 'billetera_usuario', columna: 'billetera' },
    { tabla: 'transaction', columna: 'wallet' },
  ]

  for (const { tabla, columna } of tablas) {
    const fnName = `${tabla}_lowercase_${columna}_fn`
    await sql`
      DROP TRIGGER IF EXISTS ${sql.ref(`${tabla}_lowercase_${columna}_trigger`)}
      ON ${sql.table(tabla)}
    `.execute(db)
    await sql`
      DROP FUNCTION IF EXISTS ${sql.ref(fnName)}() CASCADE
    `.execute(db)
  }
}
