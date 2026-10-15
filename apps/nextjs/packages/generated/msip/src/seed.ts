/**
 * Datos iniciales (seed) del motor `msip` (https://gitlab.com/pasosdeJesus/m/-/work_items/39, https://gitlab.com/pasosdeJesus/m/-/work_items/46).
 *
 * El motor trae un **subconjunto chico** (`db/seed.sql.gz`: catálogos +
 * `msip_pais`/`msip_departamento`/`msip_municipio` + el detalle de un municipio);
 * el dataset completo (`datos-basicas.sql`, ~104 MB) se pasa con
 * `eng:msip:seed --file <sql>`.
 *
 * Estos helpers son **puros**: el CLI aporta la conexión (`psql`) y la
 * descompresión.
 *
 * "Dad, pues, a César lo que es de César, y a Dios lo que es de Dios." (Mateo 22:21)
 */

/** Tablas tocadas por un guion de seed (`INSERT INTO public.<t>`), en orden de aparición. */
export function seedTables(sql: string): string[] {
  const seen = new Set<string>()
  const tables: string[] = []
  for (const match of sql.matchAll(/^INSERT INTO public\.(\w+)/gm)) {
    const table = match[1]
    if (!seen.has(table)) {
      seen.add(table)
      tables.push(table)
    }
  }
  return tables
}

/** `true` si todas las tablas del seed tienen filas (el seed ya se aplicó). */
export function seedIsLoaded(tables: readonly string[], counts: Record<string, number>): boolean {
  return tables.length > 0 && tables.every((table) => (counts[table] ?? 0) > 0)
}

/** Sentencias que cuentan las filas por tabla del seed (una línea por tabla). */
export function countStatement(tables: readonly string[]): string {
  return tables.map((table) => `SELECT '${table}', count(*) FROM public.${table};`).join('\n')
}

/** Sentencia que vacía las tablas del seed (para `--force`). */
export function truncateStatement(tables: readonly string[]): string {
  return `TRUNCATE ${tables.map((table) => `public.${table}`).join(', ')} RESTART IDENTITY CASCADE;`
}
