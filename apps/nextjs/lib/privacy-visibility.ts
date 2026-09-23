// Visibilidad pública de las completaciones de cursos
// (https://github.com/pasosdeJesus/learn.tg/issues/259).
//
// La implementación canónica vive en el motor
// (`@learn-tg/rewards/lib/course-privacy`), que la necesita para decidir la
// acuñación y no puede importar alias internos de la app (`@/`). Aquí solo se
// reexporta para que las rutas del host usen un único nombre y una sola regla.
//
// Un SBT en la billetera es público, permanente y enumerable: por eso una
// credencial de un curso `contenido_sensible` no se publica hasta que el dueño
// habilita esa categoría, y una credencial revocada (`revoked_at`) nunca se publica.
export {
  visibilityFromUser,
  canShowCoursePublicly,
  type CoursePrivacyFlags as CourseVisibility,
} from '@learn-tg/rewards/lib/course-privacy'
