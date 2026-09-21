// Vitest config for the `@learn-tg/gdcluster` engine (R-#252: the `test` script of
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
      { find: '@learn-tg/rewards/lib/donate-utils', replacement: `${appModules}@learn-tg/rewards/dist/lib/donate-utils.js` },
      { find: '@learn-tg/rewards/lib/verify-transfer', replacement: `${appModules}@learn-tg/rewards/dist/lib/verify-transfer.js` },
      { find: '@pasosdejesus/usdt/lib/donate-utils', replacement: `${appModules}@pasosdejesus/usdt/dist/lib/donate-utils.js` },
      { find: '@pasosdejesus/usdt/lib/parse-wallet-error', replacement: `${appModules}@pasosdejesus/usdt/dist/lib/parse-wallet-error.js` },
      { find: '@pasosdejesus/usdt/hooks/useContractPayment', replacement: `${appModules}@pasosdejesus/usdt/dist/hooks/useContractPayment.js` },
      { find: '@pasosdejesus/usdt/hooks/useGasEstimation', replacement: `${appModules}@pasosdejesus/usdt/dist/hooks/useGasEstimation.js` },
      { find: '@pasosdejesus/usdt/components/TransactionStatus', replacement: `${appModules}@pasosdejesus/usdt/dist/components/TransactionStatus.js` },
      { find: '@pasosdejesus/m/test-utils/kysely-mocks', replacement: `${appModules}@pasosdejesus/m/dist/test-utils/kysely-mocks.js` },
      { find: '@pasosdejesus/m/plugin', replacement: `${appModules}@pasosdejesus/m/dist/plugin.js` },
      { find: '@pasosdejesus/m/shadcn-components/ui/use-toast', replacement: `${appModules}@pasosdejesus/m/dist/shadcn_components/ui/use-toast.js` },
      { find: '@pasosdejesus/m/shadcn-components/ui/select', replacement: `${appModules}@pasosdejesus/m/dist/shadcn_components/ui/select.js` },
      { find: 'next/server', replacement: `${appModules}next/server.js` },
      { find: 'next/link', replacement: `${appModules}next/link.js` },
      { find: 'next', replacement: `${appModules}next` },
      { find: 'kysely', replacement: `${appModules}kysely` },
      { find: 'react', replacement: `${appModules}react` },
      { find: 'react-dom', replacement: `${appModules}react-dom` },
      { find: 'lucide-react', replacement: `${appModules}lucide-react` },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    hookTimeout: 30000,
  },
}
