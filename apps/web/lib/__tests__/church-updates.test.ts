import { describe, it, expect } from 'vitest'
import { buildChurchUpdates, CHURCH_NOT_NULL_FIELDS } from '../church-updates'
import { buildSafeUpdates } from '../safe-updates'

// https://github.com/pasosdeJesus/learn.tg/issues/229 — al editar una iglesia (p. ej. solo el nombre) los campos NOT NULL
// vacíos no deben convertirse en null (era la causa del 500 not-null violation
// en pastor_whatsapp).

const ALLOWED = ['name', 'pastor_name', 'pastor_whatsapp', 'pastor_telegram',
  'city_name', 'registration_verified', 'country_id', 'pastor_id']

describe('buildChurchUpdates', () => {
  it('conserva (omite) los campos NOT NULL vacíos al guardar solo el nombre', () => {
    const updates = buildChurchUpdates(
      { name: 'Iglesia Nueva', pastor_name: 'Juan', pastor_whatsapp: '', country_id: 170 },
      ALLOWED,
    )
    expect(updates).toEqual({ name: 'Iglesia Nueva', pastor_name: 'Juan', country_id: 170 })
    expect('pastor_whatsapp' in updates).toBe(false)
  })

  it('convierte a null los campos nullable vacíos', () => {
    const updates = buildChurchUpdates(
      { name: 'X', pastor_telegram: '', city_name: undefined, pastor_id: null },
      ALLOWED,
    )
    expect(updates).toEqual({ name: 'X', pastor_telegram: null, city_name: null, pastor_id: null })
  })

  it('ignora campos no permitidos y los ausentes', () => {
    const updates = buildChurchUpdates(
      { name: 'X', deleted_at: new Date(), created_by: 1 },
      ALLOWED,
    )
    expect(updates).toEqual({ name: 'X' })
  })

  it('expone la lista de columnas NOT NULL de church (name, country_id, pastor_name, pastor_whatsapp)', () => {
    expect([...CHURCH_NOT_NULL_FIELDS].sort()).toEqual(['country_id', 'name', 'pastor_name', 'pastor_whatsapp'])
  })

  it('buildSafeUpdates: mismo resguardo en usuario (email NOT NULL editable)', () => {
    const fields = ['nombre', 'email', 'whatsapp', 'telegram']
    expect(buildSafeUpdates({ nombre: 'Ana', email: '' }, fields, ['email']))
      .toEqual({ nombre: 'Ana' })
    expect(buildSafeUpdates({ nombre: 'Ana', email: 'ana@x.org', whatsapp: '' }, fields, ['email']))
      .toEqual({ nombre: 'Ana', email: 'ana@x.org', whatsapp: null })
  })
})
