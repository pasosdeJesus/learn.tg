// Normalización de las respuestas del crucigrama.
//
// El estudiante escribe la letra de cada celda y el servidor compara contra la
// respuesta del Markdown. La comparación ignora mayúsculas y los diacríticos: en un
// teclado móvil o en inglés cuesta escribirlos y el sentido de la respuesta no cambia
// ("pais" vale por "país", "ensena" vale por "enseña"). La tilde de la ñ es un
// diacrítico más, así que también se pliega; antes la ñ quedaba estricta mientras las
// vocales acentuadas no, que era una inconsistencia silenciosa (2026-10-28).
//
// Las respuestas del Markdown pueden escribirse con su ortografía correcta (ñ,
// acentos): el generador del crucigrama las coloca tal cual y esta función se encarga
// de las dos formas de escribirla.

const FOLDED: Array<[RegExp, string]> = [
  [/á/gi, 'A'],
  [/é/gi, 'E'],
  [/í/gi, 'I'],
  [/ó/gi, 'O'],
  [/ú/gi, 'U'],
  [/ü/gi, 'U'],
  [/ñ/gi, 'N'],
]

/** Respuesta comparable: mayúsculas, sin acentos y con la ñ como N. */
export function normalizeAnswer(value: unknown): string {
  return FOLDED.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(value ?? '').toUpperCase(),
  )
}
