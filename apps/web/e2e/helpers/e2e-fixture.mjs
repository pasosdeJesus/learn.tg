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

  if (profile.body?.church_relationship !== 'pastor') {
    await admin(`/api/admin/user/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ church_relationship: 'pastor' }),
    })
  }
  if (Number(profile.body?.church_id) !== Number(churchId)) {
    const assigned = await admin(`/api/admin/user/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ church_id: churchId }),
    })
    if (assigned.status !== 200) {
      throw new Error(`no se pudo asignar la iglesia (${assigned.status} ${JSON.stringify(assigned.body)})`)
    }
    log.push('rol pastor')
  }

  // El curso GD se compra **por la interfaz** con `premium-course-checkout`
  // (la app calcula el destinatario; no hace falta conocer la billetera que cobra).
  const mine = await apiOn(pastorPage, `/api/courses/premium/mine?walletAddress=${pastor.address}`)
  const owns = (mine.body?.courses || []).some((row) => Number(row.course_id) === GD_COURSE_ID)
  log.push(owns ? 'curso GD ya pagado' : 'curso GD pendiente (lo compra premium-course-checkout)')

  return { userId, churchId, steps: log }
}
