import { NextRequest, NextResponse } from 'next/server'

// R-#227 Fase 2 (CSRF/origin checks, ver doc/api-security.md y REQ/227 §4.3):
// las APIs autenticadas por cookie necesitan protección CSRF en métodos no
// seguros. Los navegadores modernos mandan siempre `Sec-Fetch-Site`; se
// rechaza `cross-site` (y `same-site` no se confía: subdominios hermanos).
// Si el header no viene (cliente no-navegador: specs, scripts, Rails) se
// permite y se cae a verificación de `Origin` cuando está presente — un
// atacante CSRF necesita navegador (que sí manda Sec-Fetch-Site), así que no
// hay bypass con credenciales ambientales.
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const TRUSTED_FETCH_SITE = new Set(['same-origin', 'none'])

export function middleware(req: NextRequest) {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) return NextResponse.next()

  const secFetchSite = req.headers.get('sec-fetch-site')
  if (secFetchSite) {
    if (!TRUSTED_FETCH_SITE.has(secFetchSite)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // Sin Sec-Fetch (no-navegador): si hay Origin, exigir que coincida con el host.
  const origin = req.headers.get('origin')
  if (origin) {
    let originHost = ''
    try { originHost = new URL(origin).host } catch { /* inválido */ }
    const reqHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    if (originHost && originHost !== reqHost) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
