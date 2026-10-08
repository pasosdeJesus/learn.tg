import { NextRequest, NextResponse } from 'next/server'

// R-#227 Fase 2 (CSRF/origin checks, ver doc/api-security.md y https://github.com/pasosdeJesus/learn.tg/issues/227 §4.3):
// las APIs autenticadas por cookie necesitan protección CSRF en métodos no
// seguros. Los navegadores modernos mandan siempre `Sec-Fetch-Site`; se
// rechaza `cross-site` (y `same-site` no se confía: subdominios hermanos).
// Si el header no viene (cliente no-navegador: specs, scripts, Rails) se
// permite y se cae a verificación de `Origin` cuando está presente — un
// atacante CSRF necesita navegador (que sí manda Sec-Fetch-Site), así que no
// hay bypass con credenciales ambientales.
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const TRUSTED_FETCH_SITE = new Set(['same-origin', 'none'])

// R-#247 (https://github.com/pasosdeJesus/learn.tg/issues/247): Content Security
// Policy servida en **Report-Only** mientras se recolectan las violaciones
// (doc/csp.md). Fase 1: el navegador recibe `Content-Security-Policy-Report-Only`,
// así que nada se bloquea; el header "enforcing" se pone solo en el *request*, que
// es como Next.js extrae el nonce y lo inyecta en sus scripts. Así el reporte queda
// honesto (los scripts que Next marca con el nonce no se reportan).
const CSP_REPORT_URI = '/api/csp-report'
const CSP_CONNECT_SRC = [
  "'self'",
  'https://forno.celo.org',
  'https://forno.celo-sepolia.celo-testnet.org',
  'https://rpc.ankr.com',
  'https://celo.drpc.org',
  'https://celo-sepolia.drpc.org',
  'https://celo-rpc.publicnode.com',
  'https://celo-sepolia-rpc.publicnode.com',
  'https://1rpc.io',
  'https://goodserver.gooddollar.org',
]

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${CSP_CONNECT_SRC.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
    `report-uri ${CSP_REPORT_URI}`,
  ].join('; ')
}

export function middleware(req: NextRequest) {
  // 1. CSRF/origin guard for unsafe API methods (R-#227 §4.3).
  if (UNSAFE_METHODS.has(req.method.toUpperCase())) {
    const secFetchSite = req.headers.get('sec-fetch-site')
    if (secFetchSite) {
      if (!TRUSTED_FETCH_SITE.has(secFetchSite)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const origin = req.headers.get('origin')
      if (origin) {
        let originHost = ''
        try { originHost = new URL(origin).host } catch { /* inválido */ }
        const reqHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
        if (originHost && originHost !== reqHost) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }
  }

  // 2. CSP Report-Only (R-#247). El nonce va en el request para que Next.js lo
  //    inyecte en sus scripts; al navegador solo le llega el header Report-Only,
  //    de modo que nada se bloquea mientras el recolector aprende.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const policy = buildCsp(nonce)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', policy)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy-Report-Only', policy)
  return res
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
