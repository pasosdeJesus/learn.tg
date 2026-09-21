// Vitest config for the `@learn-tg/rewards` engine (R-#252: the `test` script of
// package.json points here).
//
// The dependencies are resolved from the app (`apps/nextjs/node_modules`) on
// purpose: the engine is consumed through its `exports` map and this monorepo
// installs the deps once, in the app. Same pattern as
// `packages/pdj-wallet/vitest.config.ts`.
const appModules = new URL('../../apps/nextjs/node_modules/', import.meta.url).pathname

export default {
  resolve: {
    alias: [
      { find: 'viem/accounts', replacement: `${appModules}viem/_esm/accounts/index.js` },
      { find: 'viem/chains', replacement: `${appModules}viem/_esm/chains/index.js` },
      { find: 'viem', replacement: `${appModules}viem` },
      { find: '@pasosdejesus/m/test-utils/kysely-mocks', replacement: `${appModules}@pasosdejesus/m/dist/test-utils/kysely-mocks.js` },
      { find: '@pasosdejesus/m/blockchain/deployments', replacement: `${appModules}@pasosdejesus/m/dist/blockchain/deployments.js` },
      { find: '@pasosdejesus/mpdj/test-utils', replacement: `${appModules}@pasosdejesus/mpdj/dist/test-utils/blockchain-mocks.js` },
      { find: 'next/server', replacement: `${appModules}next/server.js` },
      { find: 'next', replacement: `${appModules}next` },
      { find: 'kysely', replacement: `${appModules}kysely` },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    hookTimeout: 30000,
  },
}
