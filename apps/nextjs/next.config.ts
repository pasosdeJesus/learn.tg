import type { NextConfig } from 'next'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load shared .env from apps/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import withPWA from 'next-pwa';
import type { PWAConfig } from 'next-pwa';

// El PWA se activa siempre (dev y producción) para poder probar la instalación
// en el sitio de desarrollo; `NEXT_PUBLIC_PWA_DISABLE=1` lo apaga en el build
// (y entonces el registrador desregistra cualquier worker sobrante).
// Ojo: en `next dev` next-pwa fuerza NetworkOnly (sin caché ni offline) y
// regenera el worker en cada compilación; el offline solo se prueba en un build
// de producción. Ver doc/pwa-developer-guide.md.
const pwaDisabled = process.env.NEXT_PUBLIC_PWA_DISABLE === '1';

const pwaConfig: PWAConfig = {
  dest: 'public',
  // El auto-registro de next-pwa inyecta register.js en la entrada main.js, que
  // no existe en el App Router: el sw.js se genera pero nadie lo registra. Lo
  // registra components/ServiceWorkerRegistrar.tsx (ver doc/pwa-developer-guide.md).
  register: false,
  skipWaiting: true,
  disable: pwaDisabled,
  fallbacks: {
    document: '/offline',
  } as PWAConfig['fallbacks'],
  additionalManifestEntries: [
    { url: '/offline', revision: null },
    // R-#240 §4b: el armazón de la lista de cursos queda precacheado para que el
    // menú ☰ → Courses funcione sin conexión (el operador lo reportó el
    // 2026-09-21: mostraba la página de respaldo). Los datos los aporta
    // `lib/offline-catalog.ts`.
    { url: '/en', revision: null },
    { url: '/es', revision: null },
  ],
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/[^\/]+\/[a-z]{2}\/diligent-records/,
      handler: 'NetworkFirst' as const,
      options: {
        cacheName: 'diligent-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
        },
      },
    },
    {
      urlPattern: /^https?:\/\/[^\/]+\/_next\/static\/.*\.(js|css|png|jpg)$/,
      handler: 'CacheFirst' as const,
      options: {
        cacheName: 'diligent-static',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 días
        },
      },
    },
    {
      urlPattern: /^https?:\/\/[^\/]+\/(img|icons)\/.*\.(png|jpg|jpeg|svg|webp|gif)$/,
      handler: 'CacheFirst' as const,
      options: {
        cacheName: 'learntg-images',
        expiration: {
          maxEntries: 150,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
        },
      },
    },
    {
      urlPattern: /^https?:\/\/[^\/]+\/(en|es)\/.*/,
      handler: 'NetworkFirst' as const,
      options: {
        cacheName: 'learntg-pages',
        networkTimeoutSeconds: 5,
        // `ignoreVary` es imprescindible (R-#256): el HTML de Next trae
        // `Vary: rsc, next-router-state-tree, next-router-prefetch,
        // next-router-segment-prefetch`, así que las cabeceras de la **petición**
        // forman parte de la clave de caché. La descarga de un curso calienta la
        // caché con un `fetch()` normal y luego la navegación sin conexión llega
        // con otras cabeceras: sin `ignoreVary` no hay acierto, el handler falla y
        // el respaldo `fallbacks.document` sirve `/offline` en vez de la guía
        // descargada (medido en el sitio de desarrollo el 2026-09-22).
        matchOptions: { ignoreVary: true },
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 24 * 60 * 60, // 24 horas
        },
      },
    },
    {
      urlPattern: ({ url, request }) =>
        url.pathname.startsWith('/api/') && request.method === 'GET',
      handler: 'NetworkFirst' as const,
      options: {
        cacheName: 'learntg-api-get',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60, // 1 hora
        },
      },
    },
    {
      urlPattern: ({ url, request }) =>
        url.pathname.startsWith('/api/') && request.method !== 'GET',
      handler: 'NetworkOnly' as const,
      // `options: {}` is required, not cosmetic: with `fallbacks` configured,
      // next-pwa@5.6 reads `entry.options.precacheFallback` for every entry and
      // crashes the production build ("Cannot read properties of undefined
      // (reading 'precacheFallback')") when an entry has no `options`.
      options: {},
    },
  ],
};

const nextConfig: NextConfig = {
  // Lo lee components/ServiceWorkerRegistrar.tsx: registra el worker cuando esta
  // compilación lo genera, y si está apagado desregistra el que hubiera quedado.
  env: {
    NEXT_PUBLIC_PWA_ENABLED: pwaDisabled ? '0' : '1',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['learn.tg', '127.0.0.1'],
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    console.log('**[next.config] NEXT_PUBLIC_API_URL:', apiUrl || '(empty, API served locally)')
    if (!apiUrl) return []
    console.log('**[next.config] proxying /api/* →', apiUrl)
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ],
    }
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'origin-when-cross-origin',
        },
      ],
    },
  ],
  webpack: (config, { isServer }) => {
    // Límite de workers de compilación (https://gitlab.com/pasosdeJesus/m/-/work_items/35 gate): la máquina real tiene
    // 16G RAM (+16G swap) y corre otras apps; 15 workers webpack × heap grande
    // la tumban (OOM). 8 workers × 2048 MB es lo seguro. Configurable vía
    // WEBPACK_PARALLELISM (1 = completamente secuencial).
    config.parallelism = parseInt(process.env.WEBPACK_PARALLELISM || '8', 10)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    }
    // Motores (packages/rewards, packages/mr519): learn.tg no es workspace pnpm,
    // los paquetes link: no tienen node_modules propio. Añadir el node_modules de
    // la app como fallback de resolución (respeta exports map → dist/*, y los
    // subpaths con nombres distintos: shadcn-components → dist/shadcn_components).
    config.resolve.modules = [
      ...(config.resolve.modules ?? []),
      path.join(__dirname, 'node_modules'),
    ]
    // WORKAROUND next@16.3.1 (pre-existente): `next/dynamic` en App Router con
    // webpack requiere `route-modules/app-page/vendored/contexts/loadable`, que
    // 16.3.1 no incluye en app-page (sí en pages). Se alinea al shared-lib, que
    // es el módulo real que el flujo de dynamic usa.
    config.resolve.alias = {
      ...config.resolve.alias,
      'next/dist/server/route-modules/app-page/vendored/contexts/loadable$': path.join(__dirname, 'node_modules/next/dist/shared/lib/loadable.shared-runtime.js'),
      'next/dist/server/route-modules/app-page/vendored/contexts/loadable-context$': path.join(__dirname, 'node_modules/next/dist/shared/lib/loadable-context.shared-runtime.js'),
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '#async_hooks': false,
    }

    // Caché persistente webpack: DESHABILITADO temporalmente — falla en este
    // entorno (`Can't resolve next.config.compiled.js`) y sirve entradas stale
    // que rompen la resolución de módulos vendored de Next (app-page/loadable).
    // Re-evaluar con workspace pnpm o CI Linux (m https://gitlab.com/pasosdeJesus/m/-/work_items/35, antes https://github.com/pasosdeJesus/learn.tg/issues/206).

    // Excluir módulos de servidor en cliente
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'fs': false,
        'path': false,
        'os': false,
      }
    }

    return config
  },
}

// @ts-ignore - next-pwa type version mismatch
export default withPWA(pwaConfig)(nextConfig)
