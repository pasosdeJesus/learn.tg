import { Kysely, sql } from 'kysely'

/**
 * Estado inicial de "publicar cursos con contenido cristiano" según el país
 * (decisión del operador, 2026-09-23).
 *
 * El interruptor `usuario.mostrar_cursos_cristianos_publico` (R-#259,
 * https://github.com/pasosdeJesus/learn.tg/issues/259) protege a quien vive donde
 * declarar la fe cristiana le puede costar la familia, el trabajo o la vida. Pero
 * en países donde el gobierno no persigue a los cristianos el default prudente ya
 * no aplica, y empezar en "no" solo esconde el curso a quien perfectamente podría
 * publicarlo. Entonces:
 *
 * - `msip_pais.persigue_cristianos` marca los países cuyo **gobierno** persigue a
 *   los cristianos, y `msip_pais.clasificado_cristianos` dice si ese país ya se
 *   evaluó (la lista de países vive en su propia migración, que el operador
 *   mantiene);
 * - el **estado inicial** del interruptor se deriva del país del estudiante: en un
 *   país perseguidor empieza en `false` (no publica), en los demás en `true`;
 * - sigue siendo **una decisión suya**: en cuanto el estudiante toca el interruptor
 *   en `/[lang]/settings`, ese valor manda y no se recalcula (la columna deja de ser
 *   `NULL`).
 *
 * La columna queda **tri-estado**: `NULL` = "sin decidir" (el estudiante nunca lo
 * tocó y su país todavía no se conoce). En ese caso todo el código de R-#259 lee
 * `NULL` como "no publicar" (`=== true`), que es el default conservador. La
 * materialización desde el país la hacen el `UPDATE` de este archivo (usuarios
 * existentes con país) y el disparador (usuarios nuevos o que fijan/cambian país
 * después).
 *
 * **El disparador solo actúa sobre países ya clasificados**
 * (`clasificado_cristianos`): mientras la lista esté incompleta, ningún país se
 * materializa y el interruptor queda en `NULL` = no publicar. Así una clasificación
 * a medias nunca publica a alguien de un país perseguidor.
 */

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('msip_pais')
    .addColumn('persigue_cristianos', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute()

  // ¿Ya se evaluó este país? Mientras no, el disparador no materializa nada (ver
  // arriba): la lista de países marca ambos campos a la vez.
  await db.schema
    .alterTable('msip_pais')
    .addColumn('clasificado_cristianos', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute()

  await sql`
    COMMENT ON COLUMN msip_pais.persigue_cristianos IS
      'El gobierno de este pais persigue a los cristianos (R-#259): estado inicial de usuario.mostrar_cursos_cristianos_publico'
  `.execute(db)
  await sql`
    COMMENT ON COLUMN msip_pais.clasificado_cristianos IS
      'Este pais ya se evaluo para persecucion de cristianos (R-#259): mientras sea false el pais no cambia el estado inicial del interruptor'
  `.execute(db)

  // Tri-estado: `NULL` = el estudiante nunca decidió. Sin `DEFAULT` para poder
  // distinguir "no lo enviaron" de un `false` explícito (el disparador aprovecha
  // eso). El código de R-#259 lee `NULL` como "no publicar".
  await db.schema
    .alterTable('usuario')
    .alterColumn('mostrar_cursos_cristianos_publico', (col) => col.dropNotNull())
    .execute()
  await db.schema
    .alterTable('usuario')
    .alterColumn('mostrar_cursos_cristianos_publico', (col) => col.dropDefault())
    .execute()

  // Materializa el estado inicial cuando el país se conoce **y está clasificado**. Un
  // `BEFORE INSERT` no basta: el país suele llegar después, al completar el perfil,
  // así que también se dispara al fijar o cambiar `pais_id`. Si el estudiante ya
  // decidió (no es NULL), no se toca.
  await sql`
    CREATE OR REPLACE FUNCTION usuario_visibilidad_cristiana_por_pais()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.mostrar_cursos_cristianos_publico IS NULL AND NEW.pais_id IS NOT NULL THEN
        SELECT CASE WHEN p.clasificado_cristianos
                    THEN NOT COALESCE(p.persigue_cristianos, false)
                    ELSE NULL
               END
          INTO NEW.mostrar_cursos_cristianos_publico
          FROM msip_pais p
         WHERE p.id = NEW.pais_id;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER usuario_visibilidad_cristiana_bi
    BEFORE INSERT ON usuario
    FOR EACH ROW EXECUTE FUNCTION usuario_visibilidad_cristiana_por_pais()
  `.execute(db)

  await sql`
    CREATE TRIGGER usuario_visibilidad_cristiana_bu
    BEFORE UPDATE OF pais_id ON usuario
    FOR EACH ROW EXECUTE FUNCTION usuario_visibilidad_cristiana_por_pais()
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS usuario_visibilidad_cristiana_bu ON usuario`.execute(db)
  await sql`DROP TRIGGER IF EXISTS usuario_visibilidad_cristiana_bi ON usuario`.execute(db)
  await sql`DROP FUNCTION IF EXISTS usuario_visibilidad_cristiana_por_pais()`.execute(db)

  // Vuelve a booleano con el default histórico (no publicar).
  await sql`UPDATE usuario SET mostrar_cursos_cristianos_publico = false WHERE mostrar_cursos_cristianos_publico IS NULL`.execute(db)
  await db.schema
    .alterTable('usuario')
    .alterColumn('mostrar_cursos_cristianos_publico', (col) => col.setDefault(false))
    .execute()
  await db.schema
    .alterTable('usuario')
    .alterColumn('mostrar_cursos_cristianos_publico', (col) => col.setNotNull())
    .execute()

  await db.schema.alterTable('msip_pais').dropColumn('persigue_cristianos').execute()
  await db.schema.alterTable('msip_pais').dropColumn('clasificado_cristianos').execute()
}
