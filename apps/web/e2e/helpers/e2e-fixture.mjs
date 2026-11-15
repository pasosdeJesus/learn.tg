// Siembra de un pastor para los specs del clúster
// (https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// La billetera verificadora **no** es pastor: siembra (país, religión, ciudad de
// culto, iglesia y rol) actuando con su propia sesión, y el pastor queda como una
// billetera distinta. El curso GD se compra por la interfaz con
// `premium-course-checkout` (así se prueba también la UI). Los mismos tres pastores
// de `apps/.env` se reutilizan en cada corrida.

export const GD_COURSE_ID = 10

/** Llama a la API desde la sesión de una página. */
export async function apiOn(page, path, init = {}) {
  return page.evaluate(
    async (args) => {
      const res = await fetch(args.path, {
        ...args.init,
        headers: { 'Content-Type': 'application/json', ...(args.init?.headers || {}) },
      })
      let body = null
      try { body = await res.json() } catch { body = null }
      return { status: res.status, body }
    },
    { path, init },
  )
}

/**
 * Deja la billetera lista para formar parte de un clúster:
 * país/religión/ciudad de culto verificada, iglesia propia, rol `pastor` y curso
 * GD pagado. Idempotente: si ya está listo, no crea nada.
 *
 * @param {object} args
 * @param {import('puppeteer').Page} args.verifierPage sesión de la verificadora
 * @param {string} args.verifierAddress billetera de esa sesión
 * @param {import('puppeteer').Page} args.pastorPage sesión del pastor
 * @param {{ pk: string, address: string }} args.pastor
 * @param {string} [args.churchName]
 * @param {number} [args.countryId]
 */
export async function ensurePastorFixture({
  verifierPage,
  verifierAddress,
  pastorPage,
  pastor,
  churchName,
  countryId = 694,
}) {
  const log = []
  const admin = (path, init) =>
    apiOn(verifierPage, path.includes('?') ? `${path}&wallet=${verifierAddress}` : `${path}?wallet=${verifierAddress}`, init)

  const profile = await apiOn(pastorPage, `/api/profile?walletAddress=${pastor.address}`)
  const userId = profile.body?.id
  if (!userId) throw new Error('el pastor no tiene perfil: no pudo iniciar sesión')
  log.push(`perfil #${userId}`)

  await admin(`/api/admin/user/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      pais_id: countryId,
      religion_id: 2,
      position_israel_gaza: 'no',
      verified_place_of_worship_location: 'Freetown, Sierra Leone',
    }),
  })

  let churchId = profile.body?.church_id
  if (!churchId) {
    const name = churchName || `E2E Church ${pastor.address.slice(2, 8)}`
    const created = await admin('/api/admin/churches', {
      method: 'POST',
      body: JSON.stringify({ name, country_id: countryId, city_name: 'Freetown' }),
    })
    churchId = created.body?.church?.id
    if (!churchId) throw new Error(`no se pudo crear la iglesia (${created.status})`)
    log.push(`iglesia #${churchId}`)
  }

  const promote = async (targetChurchId) => {
    const res = await admin(`/api/admin/user/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ church_id: targetChurchId, church_relationship: 'pastor' }),
    })
    return res
  }

  let promoted = await promote(churchId)
  let current = await apiOn(pastorPage, `/api/profile?walletAddress=${pastor.address}`)
  // Una iglesia ya tiene pastor principal (409) o el rol no quedó: se crea una iglesia
  // sólo para esta corrida. Antes se seguía adelante y el pastor fallaba después con un
  // 403 "Only pastors can create clusters" que no decía nada (medido 2026-11-14).
  if (current.body?.church_relationship !== 'pastor') {
    const name = `${churchName || 'E2E'} ${pastor.address.slice(2, 8)} ${Date.now().toString(36)}`
    const created = await admin('/api/admin/churches', {
      method: 'POST',
      body: JSON.stringify({ name, country_id: countryId, city_name: 'Freetown' }),
    })
    churchId = created.body?.church?.id
    if (!churchId) {
      throw new Error(`no se pudo crear la iglesia para el pastor (${created.status} ${JSON.stringify(created.body)})`)
    }
    log.push(`iglesia nueva #${churchId}`)
    promoted = await promote(churchId)
    current = await apiOn(pastorPage, `/api/profile?walletAddress=${pastor.address}`)
  }
  if (current.body?.church_relationship !== 'pastor') {
    throw new Error(
      `el perfil no quedó como pastor principal (rol=${current.body?.church_relationship}, iglesia=${current.body?.church_id}, PATCH=${promoted.status} ${JSON.stringify(promoted.body)})`,
    )
  }
  log.push('rol pastor')

  // El curso GD se compra **por la interfaz** con `premium-course-checkout`
  // (la app calcula el destinatario; no hace falta conocer la billetera que cobra).
  const mine = await apiOn(pastorPage, `/api/courses/premium/mine?walletAddress=${pastor.address}`)
  const owns = (mine.body?.courses || []).some((row) => Number(row.course_id) === GD_COURSE_ID)
  log.push(owns ? 'curso GD ya pagado' : 'curso GD pendiente (lo compra premium-course-checkout)')

  return { userId, churchId, ownsGdCourse: owns, steps: log }
}
