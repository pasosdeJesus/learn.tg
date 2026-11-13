import { Kysely, sql } from 'kysely'

// R-#299: invitar pastores a un clúster por billetera y publicar una página por clúster.
//
// - `clustergd` pierde `code` (el ingreso por código de 6 caracteres) y `pseudonym` (el
//   alias pasa a ser `slug`, que se muestra en lugar del nombre).
// - `slug` es obligatorio y único; los clústeres existentes lo reciben de las iniciales de
//   su nombre con `-<id>` si dos coinciden (aquí no hay clústeres en producción).
// - `cluster_invitation` gana los campos de la invitación por billetera y de la
//   reinvitación única tras un rechazo.
//
// Reversible en el esquema (el `down` no reconstruye los códigos ni los seudónimos).

const MAX_SLUG = 40

function normalize(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Copia congelada de `suggestSlug` (packages/gdcluster/src/lib/slug.ts): una migración no
 * debe depender de código que puede cambiar. */
function suggestSlug(name: string): string {
  const words = String(name ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, MAX_SLUG)
  const initials = words
    .map((word) => (/^[0-9]/.test(word) ? word.match(/^[0-9]+/)![0] : word[0]))
    .join('')
  return (initials.length >= 2 ? initials : normalize(name)).slice(0, MAX_SLUG)
}

function slugWithId(base: string, id: number): string {
  const suffix = `-${id}`
  const trimmed = base.slice(0, Math.max(1, MAX_SLUG - suffix.length)).replace(/-+$/g, '')
  return `${trimmed || 'cl'}${suffix}`.slice(0, MAX_SLUG)
}

export async function up(db: Kysely<any>): Promise<void> {
  // 1. El slug, primero nullable para poder rellenarlo.
  await db.schema.alterTable('clustergd').addColumn('slug', 'varchar(120)').execute()

  const clusters = await db
    .selectFrom('clustergd')
    .select(['id', 'name'])
    .orderBy('id')
    .execute()
  const used = new Set<string>()
  for (const cluster of clusters) {
    let slug = suggestSlug(cluster.name) || `cl-${cluster.id}`
    if (used.has(slug)) slug = slugWithId(slug, cluster.id)
    used.add(slug)
    await db.updateTable('clustergd').set({ slug } as any).where('id', '=', cluster.id).execute()
  }

  await sql`ALTER TABLE clustergd ALTER COLUMN slug SET NOT NULL`.execute(db)
  await sql`CREATE UNIQUE INDEX clustergd_slug_unique ON clustergd (slug)`.execute(db)
  await sql`CREATE UNIQUE INDEX clustergd_name_unique ON clustergd (lower(btrim(name)))`.execute(db)

  // 2. El código de 6 caracteres y el seudónimo desaparecen.
  await db.schema.alterTable('clustergd').dropColumn('code').execute()
  await db.schema.alterTable('clustergd').dropColumn('pseudonym').execute()

  // 3. Invitación por billetera y reinvitación única.
  await db.schema
    .alterTable('cluster_invitation')
    .addColumn('invite_count', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('invited_wallet', 'varchar(42)')
    .addColumn('origin', 'varchar(20)', (c) => c.notNull().defaultTo('candidates'))
    .addColumn('response_note', 'varchar(200)')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('cluster_invitation')
    .dropColumn('response_note')
    .dropColumn('origin')
    .dropColumn('invited_wallet')
    .dropColumn('invite_count')
    .execute()

  await db.schema.alterTable('clustergd').addColumn('pseudonym', 'varchar(100)').execute()
  await db.schema.alterTable('clustergd').addColumn('code', 'varchar(6)').execute()

  await sql`DROP INDEX IF EXISTS clustergd_name_unique`.execute(db)
  await sql`DROP INDEX IF EXISTS clustergd_slug_unique`.execute(db)
  await db.schema.alterTable('clustergd').dropColumn('slug').execute()
}
