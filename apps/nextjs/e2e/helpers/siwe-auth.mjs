// R-#227: helpers compartidos para el token de API DEDICADO en specs/smokes.
//
// Tras un SIWE exitoso, el token de API es el DEDICADO (256 bits) en
// `billetera_usuario.token`, expuesto por GET /api/auth/token con la session
// cookie. El CSRF de NextAuth es solo el nonce del handshake y queda como
// respaldo legacy. Estos helpers evitan duplicar ese fragmento en cada spec.

/** Token dedicado vía axios (cookie de sesión); fallback al CSRF dado. */
export async function dedicatedApiTokenAxios(axios, httpsAgent, site, cookies, csrfFallback) {
  let apiToken = csrfFallback
  try {
    const tokRes = await axios.get(`${site}/api/auth/token`, {
      httpsAgent,
      headers: { Cookie: cookies },
    })
    if (tokRes.data?.token) apiToken = tokRes.data.token
  } catch { /* respaldo CSRF legacy */ }
  return apiToken
}

/** Token dedicado vía fetch (cookie de sesión); fallback al CSRF dado. */
export async function dedicatedApiTokenFetch(site, cookies, csrfFallback) {
  let apiToken = csrfFallback
  try {
    const tokRes = await fetch(`${site}/api/auth/token`, { headers: { Cookie: cookies } })
    if (tokRes.ok) {
      const j = await tokRes.json()
      if (j?.token) apiToken = j.token
    }
  } catch { /* respaldo CSRF legacy */ }
  return apiToken
}
