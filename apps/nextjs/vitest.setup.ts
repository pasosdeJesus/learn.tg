
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

// Ensure global React is set before any mocks import React
// @ts-ignore
global.React = React;

import '@pasosdejesus/m/test-utils/radix-mocks';
import {
  menubarMock,
  popoverMock,
  toastMock,
  tooltipMock,
  scrollAreaMock,
  tabsMock
} from '@pasosdejesus/m/test-utils/radix-mocks';
import { apiAuthMocks } from '@pasosdejesus/m/test-utils/rainbowkit-mocks';
console.log('Vitest setup loaded');

// Extract mocks from apiAuthMocks for direct use
const { mocks, setupDefaultImplementations } = apiAuthMocks;

// Setup default implementations for auth mocks
setupDefaultImplementations();

// Radix UI mocks for failing tests
vi.mock('@radix-ui/react-menubar', () => menubarMock);
vi.mock('@radix-ui/react-popover', () => popoverMock);
vi.mock('@radix-ui/react-toast', () => toastMock);
vi.mock('@radix-ui/react-tooltip', () => tooltipMock);
vi.mock('@radix-ui/react-scroll-area', () => scrollAreaMock);
vi.mock('@radix-ui/react-tabs', () => {
  console.log('Mocking @radix-ui/react-tabs');
  return tabsMock;
});

// Set the database URL for tests
process.env.DATABASE_URL = 'postgres://postgres:postgres@db:5432/postgres';

// Mock authentication modules using apiAuthMocks mocks
vi.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  ConnectButton: () => React.createElement('button', null, 'Connect Wallet'),
}));

vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useConfig: () => ({
      config: { chains: [], connectors: [] },
      connectors: [],
      storage: null,
      ssr: false,
    }),
    useAccount: () => mocks.mockUseAccount(),
    useConnect: () => ({
      connect: vi.fn(),
      connectors: [],
      pendingConnectorId: null,
      isPending: false,
      isIdle: true,
      isError: false,
      error: null,
      status: 'idle',
      variables: undefined,
    }),
    useDisconnect: () => ({ disconnect: vi.fn() }),
    useSwitchChain: () => ({ switchChain: vi.fn() }),
    createConfig: vi.fn(() => ({})),
    http: vi.fn(() => ({})),
    WagmiProvider: ({ children, config }: { children: React.ReactNode; config: any }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('wagmi/chains', () => ({
  mainnet: { id: 1, name: 'Mainnet' },
}));

vi.mock('next-auth/react', () => ({
  useSession: () => mocks.mockUseSession(),
  getCsrfToken: () => mocks.mockGetCsrfToken(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('axios', () => ({
  default: {
    get: (...args: any[]) => mocks.mockAxiosGet(...args),
    post: (...args: any[]) => mocks.mockAxiosPost(...args),
    put: (...args: any[]) => mocks.mockAxiosPut(...args),
    delete: (...args: any[]) => mocks.mockAxiosDelete(...args),
    request: (...args: any[]) => mocks.mockAxiosRequest(...args),
  },
}));

vi.mock('siwe', () => ({
  SiweMessage: mocks.mockSiweMessage,
}));

const originalError = console.error;
const originalLog = console.log;
const originalWarn = console.warn;
const NOISY_PATTERNS = [
  'ECONNREFUSED',
  'crossword GET req=',
  'Donating raw (scaled) amount:',
  '** fname=',
  '** cwd=',
  'Course not found',
  'API presentation URL is not defined',
  'Network error',
  'Scholarship API down',
  'API Error',
  'Failed to fetch guide data:',
  'Error fetching scholarship amount:',
];

function shouldSilence(arg: any) {
  return typeof arg === 'string' && NOISY_PATTERNS.some((p) => arg.includes(p));
}

console.error = (...args: any[]) => {
  if (args.some(shouldSilence)) return;
  originalError(...args);
};

console.log = (...args: any[]) => {
  if (args.some(shouldSilence)) return;
  originalLog(...args);
};

console.warn = (...args: any[]) => {
  if (args.some(shouldSilence)) return;
  originalWarn(...args);
};

vi.mock('lz-string', () => ({
  compressToEncodedURIComponent: vi.fn((input) => input),
  decompressFromEncodedURIComponent: vi.fn((input) => input),
}));

vi.mock('@goodsdks/citizen-sdk', () => ({
  ClaimSDK: vi.fn(),
  useIdentitySDK: vi.fn(),
}));
