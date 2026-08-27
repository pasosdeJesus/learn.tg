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

const pwaConfig: PWAConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: true,
  // Solo cachear diligent-records
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
  ],
};

const nextConfig: NextConfig = {
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
    // Límite de workers de compilación (REQ/35 gate): la máquina real tiene
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
    // Re-evaluar con workspace pnpm o CI Linux (#206).

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
