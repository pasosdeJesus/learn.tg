'use client'

/**
 * Último `profilescore` conocido del usuario (R-#242, pedido del operador el
 * 2026-09-21).
 *
 * Sin conexión el crucigrama no puede preguntar al servidor si el perfil llega a
 * los 50 puntos que exige la beca, así que la respuesta se encolaba y el rechazo
 * se descubría mucho después. Con el último puntaje guardado (que se lee en el
 * perfil y al cargar la lista de cursos) la página puede avisarlo **antes** de
 * encolar.
 *
 * No es un dato sensible: el puntaje es público en la tabla de líderes.
 */
const SCORE_KEY = 'learn.tg.profileScore'
const SAVED_AT_KEY = 'learn.tg.profileScoreAt'

export const MIN_PROFILE_SCORE_FOR_SCHOLARSHIP = 50

export function saveProfileScore(score: unknown): void {
  // `Number(null)` es 0: sin este filtro un valor ausente se guardaría como 0 y el
  // aviso sin conexión se dispararía por error.
  if (score === null || score === undefined || score === '') return
  const value = Number(score)
  if (!Number.isFinite(value) || value < 0) return
  try {
    localStorage.setItem(SCORE_KEY, String(value))
    localStorage.setItem(SAVED_AT_KEY, String(Date.now()))
  } catch {
    // almacenamiento bloqueado: sin aviso sin conexión, pero nada se rompe
  }
}

export function getProfileScore(): number | null {
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/** Epoch ms of the last saved score, or null. */
export function getProfileScoreSavedAt(): number | null {
  try {
    const raw = localStorage.getItem(SAVED_AT_KEY)
    return raw === null ? null : Number(raw)
  } catch {
    return null
  }
}

/** True when the last known score is below the scholarship minimum. */
export function profileScoreBelowMinimum(score: number | null = getProfileScore()): boolean {
  return score !== null && score < MIN_PROFILE_SCORE_FOR_SCHOLARSHIP
}
