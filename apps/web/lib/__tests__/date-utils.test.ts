import { describe, it, expect } from 'vitest'
import { dateKeyInTimezone } from '../date-utils'

// El día de un instante **en la zona del calendario**, no en la del dispositivo
// (bug del 2026-09-30: los cupos de la tarde se indexaban con el día UTC y no
// coincidían con la celda del calendario en dispositivos con otra zona).
describe('dateKeyInTimezone', () => {
  it('da el día calendario del instante en la zona pedida', () => {
    // 2026-10-02T01:00Z son las 20:00 del 1 de octubre en Bogotá (UTC-5) y la 01:00 del 2 en UTC.
    const instant = '2026-10-02T01:00:00Z'
    expect(dateKeyInTimezone(instant, 'UTC')).toBe('2026-10-02')
    expect(dateKeyInTimezone(instant, 'America/Bogota')).toBe('2026-10-01')
    expect(dateKeyInTimezone(instant, 'Africa/Freetown')).toBe('2026-10-02')
  })

  it('acepta un Date y respeta el cambio de día por la zona', () => {
    const d = new Date('2026-01-05T23:30:00-05:00')
    expect(dateKeyInTimezone(d, 'America/Bogota')).toBe('2026-01-05')
    expect(dateKeyInTimezone(d, 'UTC')).toBe('2026-01-06')
  })

  it('devuelve cadena vacía con un valor inválido', () => {
    expect(dateKeyInTimezone('no-es-fecha', 'UTC')).toBe('')
  })
})
