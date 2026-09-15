const appModules = new URL('../../apps/nextjs/node_modules/', import.meta.url).pathname
const coreWallet = new URL('../pdj-wallet/dist/index.js', import.meta.url).pathname

export default {
  resolve: {
    alias: [
      { find: '@learn-tg/pdj-wallet', replacement: coreWallet },
      { find: 'react-dom', replacement: `${appModules}react-dom` },
      { find: 'react', replacement: `${appModules}react` },
      { find: '@testing-library/react', replacement: `${appModules}@testing-library/react` },
    ],
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    hookTimeout: 30000,
  },
}
