// Construcción segura de los campos a actualizar en un PATCH (REQ/229).
//
// Bug de clase: convertir `''`/`undefined` a `null` en TODAS las columnas rompe
// las columnas `NOT NULL` (p. ej. `church.pastor_whatsapp` al guardar solo el
// nombre de la iglesia, o `usuario.email` al editar un usuario) con
// `null value in column "X" violates not-null constraint` → 500.
//
// Regla: en columnas `NOT NULL` un valor vacío/ausente NO se envía (se conserva
// el valor actual); en columnas nullable `''`/`null`/`undefined` → `null`.

export function buildSafeUpdates(
  body: Record<string, any>,
  allowed: string[],
  notNullFields: Set<string> | string[] = [],
): Record<string, any> {
  const notNull = notNullFields instanceof Set ? notNullFields : new Set(notNullFields)
  const updates: Record<string, any> = {}
  for (const f of allowed) {
    if (!(f in body)) continue
    const v = body[f]
    const empty = v === '' || v === undefined || v === null
    if (empty && notNull.has(f)) continue
    updates[f] = empty ? null : v
  }
  return updates
}
