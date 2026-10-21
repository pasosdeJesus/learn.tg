import { Kysely, sql } from 'kysely'

/**
 * Región del país y estado inicial de "publicar cursos con contenido sensible"
 * (categoría B) — https://github.com/pasosdeJesus/learn.tg/issues/259.
 *
 * El interruptor `usuario.mostrar_cursos_sensibles_publico` protege al estudiante
 * que vive en una región restringida, donde publicar esa marca puede costarle la
 * familia, el trabajo o la vida. El significado de "contenido sensible" y de las
 * regiones tipo 1/2 está en `.crushrules`, nunca en el código.
 *
 * Entonces:
 *
 * - `msip_pais.tipo_region` clasifica el país: `1` = Región Tipo 1 (sin
 *   restricciones), `2` = Región Tipo 2 (lista de vigilancia) y `NULL` = sin
 *   clasificar (el país todavía no se evaluó);
 * - el **estado inicial** del interruptor se deriva de esa región: Tipo 2 empieza
 *   en `false` (no publica), Tipo 1 en `true`;
 * - sigue siendo **una decisión suya**: en cuanto el estudiante toca el interruptor
 *   en `/[lang]/settings`, ese valor manda hasta que cambie de país (ver la
 *   migración `20260923155642`, que completa la regla).
 *
 * La columna queda **tri-estado**: `NULL` = "sin decidir". En ese caso todo el
 * código de R-#259 lee `NULL` como "no publicar" (`=== true`), que es el default
 * conservador. La materialización desde la región la hacen el `UPDATE` de este
 * archivo (usuarios existentes con país) y el disparador (usuarios nuevos o que
 * fijan/cambian país después).
 *
 * **El disparador solo actúa sobre países ya clasificados** (`tipo_region IS NOT
 * NULL`): mientras la lista esté incompleta, ningún país se materializa y el
 * interruptor queda en `NULL` = no publicar. Así una clasificación a medias nunca
 * publica a alguien de una región restringida.
 */

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE msip_pais
      ADD COLUMN IF NOT EXISTS tipo_region SMALLINT,
      ADD CONSTRAINT msip_pais_tipo_region_check CHECK (tipo_region IN (1, 2))
  `.execute(db)

  await sql`
    COMMENT ON COLUMN msip_pais.tipo_region IS
      'Region del pais (R-#259): 1 = sin restricciones, 2 = lista de vigilancia, NULL = sin clasificar. Ver .crushrules'
  `.execute(db)

  // Tri-estado: `NULL` = el estudiante nunca decidió. Sin `DEFAULT` para poder
  // distinguir "no lo enviaron" de un `false` explícito (el disparador aprovecha
  // eso). El código de R-#259 lee `NULL` como "no publicar".
  await db.schema
    .alterTable('usuario')
    .alterColumn('mostrar_cursos_sensibles_publico', (col) => col.dropNotNull())
    .execute()
  await db.schema
    .alterTable('usuario')
    .alterColumn('mostrar_cursos_sensibles_publico', (col) => col.dropDefault())
    .execute()

  // Materializa el estado inicial cuando el país se conoce **y está clasificado**. Un
  // `BEFORE INSERT` no basta: el país suele llegar después, al completar el perfil,
  // así que también se dispara al fijar o cambiar `pais_id`.
  await sql`
    CREATE OR REPLACE FUNCTION usuario_visibilidad_sensible_por_region()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.mostrar_cursos_sensibles_publico IS NULL AND NEW.pais_id IS NOT NULL THEN
        SELECT CASE WHEN p.tipo_region IS NOT NULL
                    THEN p.tipo_region = 1
                    ELSE NULL
               END
          INTO NEW.mostrar_cursos_sensibles_publico
          FROM msip_pais p
         WHERE p.id = NEW.pais_id;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER usuario_visibilidad_sensible_bi
    BEFORE INSERT ON usuario
    FOR EACH ROW EXECUTE FUNCTION usuario_visibilidad_sensible_por_region()
  `.execute(db)

  await sql`
    CREATE TRIGGER usuario_visibilidad_sensible_bu
    BEFORE UPDATE OF pais_id ON usuario
    FOR EACH ROW EXECUTE FUNCTION usuario_visibilidad_sensible_por_region()
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS usuario_visibilidad_sensible_bu ON usuario`.execute(db)
  await sql`DROP TRIGGER IF EXISTS usuario_visibilidad_sensible_bi ON usuario`.execute(db)
  await sql`DROP FUNCTION IF EXISTS usuario_visibilidad_sensible_por_region()`.execute(db)

  // Vuelve a booleano con el default histórico (no publicar).
  await sql`UPDATE usuario SET mostrar_cursos_sensibles_publico = false WHERE mostrar_cursos_sensibles_publico IS NULL`.execute(db)
  await db.schema
    .alterTable('usuario')
    .alterColumn('mostrar_cursos_sensibles_publico', (col) => col.setDefault(false))
    .execute()
  await db.schema
    .alterTable('usuario')
    .alterColumn('mostrar_cursos_sensibles_publico', (col) => col.setNotNull())
    .execute()

  await sql`ALTER TABLE msip_pais DROP CONSTRAINT IF EXISTS msip_pais_tipo_region_check`.execute(db)
  await db.schema.alterTable('msip_pais').dropColumn('tipo_region').execute()
}
