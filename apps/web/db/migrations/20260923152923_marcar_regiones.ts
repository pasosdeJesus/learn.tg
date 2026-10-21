import { Kysely, sql } from 'kysely'

/**
 * Regiones Tipo 2 (lista de vigilancia) — R-#259, estado inicial del interruptor
 * "publicar cursos con contenido sensible" (categoría B).
 *
 * Fuente de la lista: `.crushrules` (la mantiene el operador). Son 29 países; los
 * demás quedan como Región Tipo 1. Ningún archivo del repositorio explica a qué
 * se refieren las regiones: a propósito.
 *
 * Además de marcar `tipo_region`, esta migración marca **todos** los países como
 * clasificados (ninguno queda en `NULL`): a partir de aquí el disparador
 * (`20260923150546`) materializa el estado inicial del interruptor desde la región.
 * Antes la tabla estaba sin clasificar a propósito (nada se materializaba = nadie
 * se publicaba por error).
 *
 * Los usuarios con país conocido quedan con el estado inicial de su región **solo
 * si todavía no habían decidido** (la columna era `false` por defecto y la página
 * de privacidad nunca se desplegó, así que no hay elecciones explícitas). A quien
 * ya tenía `true` no se le apaga nada.
 */

const REGIONES_TIPO2 = [
  'PRK', 'SOM', 'YEM', 'SDN', 'ERI', 'SYR', 'NGA', 'PAK', 'LBY', 'IRN',
  'AFG', 'IND', 'SAU', 'MMR', 'MLI', 'BFA', 'CHN', 'IRQ', 'MDV', 'DZA',
  'MRT', 'CAF', 'MAR', 'CUB', 'UZB', 'NER', 'TJK', 'LAO', 'COD',
]

export async function up(db: Kysely<any>): Promise<void> {
  const marcados = await sql`
    UPDATE msip_pais
       SET tipo_region = CASE WHEN alfa3 = ANY(${sql.val(REGIONES_TIPO2)}) THEN 2 ELSE 1 END
  `.execute(db)
  console.log(`[marcar_regiones] países clasificados: ${marcados.numAffectedRows ?? '?'} (lista de ${REGIONES_TIPO2.length} regiones tipo 2)`)

  // Estado inicial para quien ya tiene país pero nunca decidió: `NULL` (los que
  // empezaron con la columna tri-estado) y `false` (el default histórico anterior a
  // la página de privacidad) cuentan como "no decidió".
  const usuarios = await sql`
    UPDATE usuario u
       SET mostrar_cursos_sensibles_publico = (p.tipo_region = 1)
      FROM msip_pais p
     WHERE u.pais_id = p.id
       AND COALESCE(u.mostrar_cursos_sensibles_publico, false) = false
  `.execute(db)
  console.log(`[marcar_regiones] usuarios con el estado inicial de su región: ${usuarios.numAffectedRows ?? '?'}`)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Vuelve a "sin clasificar" (nada materializa) y al default conservador.
  await sql`UPDATE usuario SET mostrar_cursos_sensibles_publico = false WHERE mostrar_cursos_sensibles_publico = true`.execute(db)
  await sql`UPDATE msip_pais SET tipo_region = NULL`.execute(db)
}
