/**
 * Centralized profile score rules.
 * Used by both recalculateProfileScore() and AdminWidgets to keep logic in sync.
 */
export interface ScoreRule {
  points: number
  /** Returns true if this criterion is satisfied */
  check: (user: Record<string, any>) => boolean
  /** Fields needed from DB for this check */
  fields: string[]
}

export const SCORE_RULES: ScoreRule[] = [
  {
    points: 26,
    fields: ['nombre', 'passport_name'],
    check: (u) => !!(u.nombre && u.passport_name && u.nombre === u.passport_name),
  },
  {
    points: 24,
    fields: ['pais_id', 'passport_nationality'],
    check: (u) => u.pais_id != null && u.passport_nationality != null && u.pais_id === u.passport_nationality,
  },
  {
    points: 9,
    fields: ['email', 'verified_email'],
    check: (u) => !!(u.email && u.verified_email && u.email === u.verified_email),
  },
  {
    points: 9,
    fields: ['whatsapp', 'telegram', 'verified_whatsapp', 'verified_telegram'],
    check: (u) =>
      (!!(u.whatsapp && u.verified_whatsapp && u.whatsapp === u.verified_whatsapp)) ||
      (!!(u.telegram && u.verified_telegram && u.telegram === u.verified_telegram)),
  },
  {
    points: 7,
    fields: ['lastgooddollarverification'],
    check: (u) => u.lastgooddollarverification != null,
  },
  {
    points: 9,
    fields: ['city_id', 'verified_city_id', 'place_of_worship_location', 'verified_place_of_worship_location'],
    check: (u) =>
      (u.city_id != null && u.verified_city_id === u.city_id) ||
      (u.city_id == null && u.verified_city_id == null &&
       u.place_of_worship_location != null &&
       u.verified_place_of_worship_location === u.place_of_worship_location),
  },
  {
    points: 9,
    fields: ['religion_id', 'church_id', 'church_relationship', 'verified_church_relationship', 'place_of_worship', 'verified_place_of_worship'],
    check: (u) =>
      // Christian (religion_id = 2): church membership verified
      (u.religion_id === 2 &&
       u.church_id != null &&
       u.church_relationship != null &&
       u.verified_church_relationship != null &&
       u.church_relationship === u.verified_church_relationship) ||
      // Non-Christian: place of worship verified
      (u.religion_id !== 2 &&
       u.place_of_worship != null &&
       u.verified_place_of_worship != null &&
       u.place_of_worship === u.verified_place_of_worship),
  },
  {
    points: 7,
    fields: ['proposed_date_of_interview', 'conducted_date_of_interview'],
    check: (u) => u.proposed_date_of_interview != null || u.conducted_date_of_interview != null,
  },
]

/** All fields needed from DB to calculate profile score */
export const ALL_SCORE_FIELDS = [...new Set(SCORE_RULES.flatMap(r => r.fields))]

/** VERIFIED_FIELDS config for AdminWidgets — derived from score rules */
export const VERIFIED_FIELDS_CONFIG = [
  { key: 'verified_whatsapp', source: 'whatsapp', labelEn: 'WhatsApp', labelEs: 'WhatsApp' },
  { key: 'verified_telegram', source: 'telegram', labelEn: 'Telegram', labelEs: 'Telegram' },
  { key: 'verified_email', source: 'email', labelEn: 'Email', labelEs: 'Correo' },
  { key: 'verified_city_id', source: 'city_id', labelEn: 'City', labelEs: 'Ciudad' },
  { key: 'verified_place_of_worship', source: 'place_of_worship', labelEn: 'Place of Worship', labelEs: 'Lugar de Culto' },
  { key: 'verified_place_of_worship_location', source: 'place_of_worship_location', labelEn: 'Worship Location', labelEs: 'Ubicación del Culto' },
  { key: 'verified_church_relationship', source: 'church_relationship', labelEn: 'Church Role', labelEs: 'Rol en Iglesia' },
]
