const appModules = new URL('../../apps/nextjs/node_modules/', import.meta.url).pathname

export default {
  resolve: {
    alias: [
      { find: 'viem/accounts', replacement: `${appModules}viem/_esm/accounts/index.js` },
      { find: 'viem/chains', replacement: `${appModules}viem/_esm/chains/index.js` },
      { find: 'viem', replacement: `${appModules}viem` },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    hookTimeout: 30000,
  },
}
