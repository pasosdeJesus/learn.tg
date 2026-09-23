import { Kysely, sql } from 'kysely'

/**
 * Países cuyo gobierno persigue a los cristianos (R-#259, estado inicial del
 * interruptor "publicar cursos con contenido cristiano").
 *
 * Fuente: **World Watch List 2026 de Open Doors**, países con puntaje de
 * persecución **>= 72** (`/var/www/adJ-ia/tmp/p.txt`, lista que mantiene el
 * operador). El puntaje mide la presión del gobierno y de la sociedad; aquí se usa
 * como el criterio del operador para decidir en qué países el interruptor de R-#259
 * empieza apagado.
 *
 * Los 29 países (alfa3, con el puntaje de la lista):
 *
 * | País | alfa3 | puntaje |
 * |---|---|---|
 * | Corea del Norte | PRK | 97 |
 * | Somalia | SOM | 94 |
 * | Yemen | YEM | 93 |
 * | Sudán | SDN | 92 |
 * | Eritrea | ERI | 90 |
 * | Siria | SYR | 90 |
 * | Nigeria | NGA | 89 |
 * | Pakistán | PAK | 87 |
 * | Libia | LBY | 87 |
 * | Irán | IRN | 87 |
 * | Afganistán | AFG | 86 |
 * | India | IND | 84 |
 * | Arabia Saudita | SAU | 82 |
 * | Birmania | MMR | 81 |
 * | Malí | MLI | 81 |
 * | Burkina Faso | BFA | 80 |
 * | China | CHN | 79 |
 * | Irak | IRQ | 79 |
 * | Maldivas | MDV | 79 |
 * | Argelia | DZA | 77 |
 * | Mauritania | MRT | 76 |
 * | República Centroafricana | CAF | 75 |
 * | Marruecos | MAR | 75 |
 * | Cuba | CUB | 73 |
 * | Uzbekistán | UZB | 73 |
 * | Níger | NER | 72 |
 * | Tayikistán | TJK | 72 |
 * | Laos | LAO | 72 |
 * | República Democrática del Congo | COD | 72 |
 *
 * Además de marcar `persigue_cristianos`, esta migración marca **todos** los países
 * como `clasificado_cristianos`: a partir de aquí el disparador (`20260923150546`)
 * materializa el estado inicial del interruptor desde el país. Antes la tabla estaba
 * sin clasificar a propósito (nada se materializaba = nadie se publicaba por error).
 *
 * Los usuarios con país conocido quedan con el estado inicial de su país **solo si
 * todavía no habían decidido** (la columna era `false` por defecto y la página de
 * privacidad nunca se desplegó, así que no hay elecciones explícitas). A quien ya
 * tenía `true` no se le apaga nada.
 */

const PAISES_PERSECUCION = [
  'PRK', 'SOM', 'YEM', 'SDN', 'ERI', 'SYR', 'NGA', 'PAK', 'LBY', 'IRN',
  'AFG', 'IND', 'SAU', 'MMR', 'MLI', 'BFA', 'CHN', 'IRQ', 'MDV', 'DZA',
  'MRT', 'CAF', 'MAR', 'CUB', 'UZB', 'NER', 'TJK', 'LAO', 'COD',
]

export async function up(db: Kysely<any>): Promise<void> {
  const marcados = await sql`
    UPDATE msip_pais
       SET clasificado_cristianos = true,
           persigue_cristianos = (alfa3 = ANY(${sql.val(PAISES_PERSECUCION)}))
  `.execute(db)
  console.log(`[marcar_paises_persecucion] países clasificados: ${marcados.numAffectedRows ?? '?'} (lista de ${PAISES_PERSECUCION.length} perseguidores)`)

  // Estado inicial para quien ya tiene país pero nunca decidió: `NULL` (los que
  // empezaron con la columna tri-estado) y `false` (el default histórico anterior a
  // la página de privacidad) cuentan como "no decidió".
  const usuarios = await sql`
    UPDATE usuario u
       SET mostrar_cursos_cristianos_publico = NOT p.persigue_cristianos
      FROM msip_pais p
     WHERE u.pais_id = p.id
       AND COALESCE(u.mostrar_cursos_cristianos_publico, false) = false
  `.execute(db)
  console.log(`[marcar_paises_persecucion] usuarios con el estado inicial de su país: ${usuarios.numAffectedRows ?? '?'}`)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Vuelve a "sin clasificar" (nada materializa) y al default conservador.
  await sql`UPDATE usuario SET mostrar_cursos_cristianos_publico = false WHERE mostrar_cursos_cristianos_publico = true`.execute(db)
  await sql`UPDATE msip_pais SET clasificado_cristianos = false, persigue_cristianos = false`.execute(db)
}
