import { Kysely, sql } from 'kysely'

// Arregla los metadatos de las credenciales (SBT) de los cursos que existen en
// `cor1440_gen_proyectofinanciero` (https://github.com/pasosdeJesus/learn.tg/issues/161 §12):
//
//   - `course_id` en NULL: el metadata que sirve `/api/credential/[tokenId]` no traía
//     el atributo "Course ID" ni el enlace al curso;
//   - `is_premium = false` aunque el curso se paga (`porPagar > 0`), con lo que el
//     atributo "Premium" del SBT mentía y `premiumSbtCount` (nivel de stable-sl) no
//     contaba los cursos premium.
//
// Se cruza por **título** y no por `token_id`: el mismo id apunta a cursos distintos en
// producción y en desarrollo (verificado con los volcados de ambas bases), así que los
// ids no sirven como clave. Sólo se tocan filas de curso (`course_completion`,
// `site = 'learn.tg'`) cuyo título corresponde a un curso existente.
//
// `image_url` NO se toca: los iconos se arreglan en otra pasada.

export async function up(db: Kysely<any>): Promise<void> {
  // `course_id` e `is_premium` desde el curso, por título (sin acentos ni mayúsculas).
  // `DISTINCT ON` deja una sola fila si dos cursos comparten título: se prefiere el que
  // sigue abierto (`fechacierre` nulo) y, entre iguales, el id menor.
  await sql`
    UPDATE credential_metadata AS cm
       SET course_id = c.id,
           is_premium = (COALESCE(c."porPagar", 0) > 0),
           updated_at = now()
      FROM (
        SELECT DISTINCT ON (public.unaccent(lower(btrim(titulo))))
               id,
               public.unaccent(lower(btrim(titulo))) AS clave,
               "porPagar"
          FROM cor1440_gen_proyectofinanciero
         WHERE titulo IS NOT NULL
         ORDER BY public.unaccent(lower(btrim(titulo))), fechacierre NULLS FIRST, id
      ) AS c
     WHERE cm.type = 'course_completion'
       AND cm.site = 'learn.tg'
       AND public.unaccent(lower(btrim(cm.name))) = c.clave
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Vuelve a los valores que tenían los dos sitios: sin curso y no premium (los volcados
  // de producción y desarrollo muestran `course_id` NULL e `is_premium` false en todas
  // las filas de curso). `image_url` no se toca en ninguna dirección.
  await sql`
    UPDATE credential_metadata AS cm
       SET course_id = NULL,
           is_premium = false,
           updated_at = now()
      FROM (
        SELECT DISTINCT ON (public.unaccent(lower(btrim(titulo))))
               public.unaccent(lower(btrim(titulo))) AS clave
          FROM cor1440_gen_proyectofinanciero
         WHERE titulo IS NOT NULL
         ORDER BY public.unaccent(lower(btrim(titulo))), fechacierre NULLS FIRST, id
      ) AS c
     WHERE cm.type = 'course_completion'
       AND cm.site = 'learn.tg'
       AND public.unaccent(lower(btrim(cm.name))) = c.clave
  `.execute(db)
}
