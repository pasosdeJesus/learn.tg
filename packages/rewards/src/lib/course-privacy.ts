// Privacidad de la afiliación sensible (https://github.com/pasosdeJesus/learn.tg/issues/259).
//
// Implementación canónica: vive en el motor porque el motor la necesita y no
// puede importar alias internos del host (`@/`). La app la reexporta desde
// `apps/nextjs/lib/privacy-visibility.ts`, así que hay una sola regla.
//
// Un SBT en la billetera es público, permanente y enumerable: quien lo mira sabe
// que esa persona completó un curso sensible. Por eso, en un curso marcado
// `contenido_sensible`, no se acuña mientras el estudiante no haya habilitado
// publicar esa categoría (opt-in tardío desde `/[lang]/settings`), y ninguna
// superficie pública lo lista.

import type { Kysely } from 'kysely'

export interface CoursePrivacyFlags {
  contenido_sensible?: boolean | null
  mostrar_cursos_publico?: boolean | null
  mostrar_cursos_sensibles_publico?: boolean | null
}

/** Los dos interruptores del dueño, con sus valores por defecto (NULL = default). */
export function visibilityFromUser(user: CoursePrivacyFlags | null | undefined) {
  return {
    // default TRUE: conserva el comportamiento histórico de la plataforma
    publicCourses: user?.mostrar_cursos_publico !== false,
    // default FALSE: es lo que expone a una persona en un contexto restringido
    publicSensitiveCourses: user?.mostrar_cursos_sensibles_publico === true,
  }
}

/**
 * ¿Se puede publicar (listar en un perfil, contar en el ranking) esta credencial?
 *
 * Las consultas SQL aplican la misma regla con estas condiciones (`credential_emission`
 * como `e`, el curso como `c`):
 *   - `e.revoked_at IS NULL`
 *   - el dueño con `mostrar_cursos_publico` en true
 *   - `NOT c.contenido_sensible OR mostrar_cursos_sensibles_publico`
 */
export function canShowCoursePublicly(
  user: CoursePrivacyFlags | null | undefined,
  curso: { contenido_sensible?: boolean | null } | null | undefined,
): boolean {
  const { publicCourses, publicSensitiveCourses } = visibilityFromUser(user)
  if (!publicCourses) return false
  if (curso?.contenido_sensible) return publicSensitiveCourses
  return true
}

/**
 * ¿Se puede acuñar la credencial de este curso sin exponer al estudiante?
 *
 * - Curso no sensible: siempre (comportamiento histórico de la plataforma;
 *   `mostrar_cursos_publico` gobierna las listas, no la acuñación).
 * - Curso sensible: solo con el interruptor de publicar cursos públicos en
 *   `true` (o sin fila, que es el default) Y el de contenido sensible en `true`
 *   (que es el default `false`).
 */
export function canMintPublicly(flags: CoursePrivacyFlags | null | undefined): boolean {
  if (!flags?.contenido_sensible) return true
  return (
    flags?.mostrar_cursos_publico !== false &&
    flags?.mostrar_cursos_sensibles_publico === true
  )
}

/**
 * Lee las tres banderas que deciden la acuñación de un curso para un estudiante.
 * Devuelve `null` si el curso no existe.
 */
export async function coursePrivacyFlags(
  db: Kysely<any>,
  courseId: number,
  usuarioId: number,
): Promise<CoursePrivacyFlags | null> {
  const row = await db
    .selectFrom('cor1440_gen_proyectofinanciero as c')
    .leftJoin('usuario as u', (j: any) => j.on('u.id', '=', usuarioId))
    .select([
      'c.contenido_sensible',
      'u.mostrar_cursos_publico',
      'u.mostrar_cursos_sensibles_publico',
    ])
    .where('c.id', '=', courseId)
    .executeTakeFirst()
  return row ?? null
}
