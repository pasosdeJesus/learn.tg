// Identificador público de un clúster (el alias que se muestra en lugar del nombre).
//
// El slug se **sugiere** a partir del nombre con las iniciales de sus palabras y la
// persona lo puede editar; se valida siempre al escribir. Si el derivado ya existe, el
// endpoint de creación le añade `-<id>` (ver `slugWithId`), así que dos clústeres nunca
// comparten slug.
//
// Refs: https://github.com/pasosdeJesus/learn.tg/issues/299

const MAX_SLUG = 40

/** Minúsculas sin acentos y con todo lo que no sea `[a-z0-9]` convertido a guion. */
export function normalizeSlug(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Slug sugerido para un nombre: iniciales de sus palabras
 * (`Iglesia Nueva Jerusalén` → `inj`, `Cl 1 1` → `c11`). Una palabra que empieza con
 * dígito aporta sus dígitos iniciales. Con una sola palabra se usa entera; si el
 * resultado queda por debajo del mínimo, se usa el nombre normalizado completo.
 */
export function suggestSlug(name: string): string {
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
  if (initials.length >= 2) return initials.slice(0, MAX_SLUG)
  return normalizeSlug(name).slice(0, MAX_SLUG)
}

export type SlugError = 'slug_invalid'

/** Valida el slug que se va a guardar (escrito por la persona o derivado). */
export function validateSlug(value: string): { ok: true; slug: string } | { ok: false; reason: SlugError } {
  const slug = String(value ?? '').trim()
  if (slug.length < 2 || slug.length > MAX_SLUG) return { ok: false, reason: 'slug_invalid' }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, reason: 'slug_invalid' }
  return { ok: true, slug }
}

/** `<base>-<id>` recortando la base para que el slug completo no pase de 40. */
export function slugWithId(base: string, id: number): string {
  const suffix = `-${id}`
  const room = MAX_SLUG - suffix.length
  const trimmed = base.slice(0, Math.max(1, room)).replace(/-+$/g, '')
  return `${trimmed || 'cl'}-${id}`.slice(0, MAX_SLUG)
}

export { MAX_SLUG }
