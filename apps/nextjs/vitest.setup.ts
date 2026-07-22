
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

// Setup default implementations for auth mocks
const { mocks, setupDefaultImplementations } = apiAuthMocks;
setupDefaultImplementations()

// Mock @pasosdejesus/m shadcn components to avoid React version mismatch
vi.mock('@pasosdejesus/m/shadcn-components/ui/button', () => ({
  Button: ({ children, onClick, type, className, size, variant, ...props }: any) =>
    React.createElement('button', { onClick, type, className, ...props }, children),
  buttonVariants: () => '',
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/dialog', () => {
  const Dialog = ({ open, onOpenChange, children }: any) =>
    open ? React.createElement(React.Fragment, null, children) : null
  return {
    Dialog,
    DialogContent: ({ children, className }: any) =>
      React.createElement('div', { role: 'dialog' }, children),
    DialogDescription: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    DialogFooter: ({ children, className }: any) =>
      React.createElement(React.Fragment, null, children),
    DialogHeader: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    DialogTitle: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    DialogTrigger: ({ children, asChild }: any) =>
      React.createElement(React.Fragment, null, children),
  }
})

vi.mock('@pasosdejesus/m/shadcn-components/ui/select', () => ({
  Select: ({ children }: any) => React.createElement(React.Fragment, null, children),
  SelectTrigger: ({ children }: any) => React.createElement('button', null, children),
  SelectValue: ({ placeholder }: any) => React.createElement('span', null, placeholder),
  SelectContent: ({ children }: any) => React.createElement(React.Fragment, null, children),
  SelectItem: ({ children, value }: any) => React.createElement('div', { 'data-value': value }, children),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => React.createElement('label', { htmlFor }, children),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/card', () => ({
  Card: ({ children }: any) => React.createElement('div', null, children),
  CardHeader: ({ children }: any) => React.createElement('div', null, children),
  CardTitle: ({ children }: any) => React.createElement('h2', null, children),
  CardDescription: ({ children }: any) => React.createElement('p', null, children),
  CardContent: ({ children }: any) => React.createElement('div', null, children),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/table', () => ({
  Table: ({ children }: any) => React.createElement('table', null, children),
  TableHeader: ({ children }: any) => React.createElement('thead', null, children),
  TableBody: ({ children }: any) => React.createElement('tbody', null, children),
  TableRow: ({ children }: any) => React.createElement('tr', null, children),
  TableHead: ({ children }: any) => React.createElement('th', null, children),
  TableCell: ({ children }: any) => React.createElement('td', null, children),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/alert', () => ({
  Alert: ({ children, className }: any) => React.createElement('div', { role: 'alert', className }, children),
  AlertTitle: ({ children }: any) => React.createElement('h5', null, children),
  AlertDescription: ({ children }: any) => React.createElement('div', null, children),
}))

// Override dialog mock to handle open/close state
vi.mock('@radix-ui/react-dialog', () => {
  const Root = ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? React.createElement(React.Fragment, null, children) : null
  const Trigger = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  const Portal = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  const Overlay = () => null
  const Content = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  const Title = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  const Description = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  const Close = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  return { Root, Trigger, Portal, Overlay, Content, Title, Description, Close }
})

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

vi.mock('next-auth/react', () => ({
  useSession: () => mocks.mockUseSession(),
  getCsrfToken: () => mocks.mockGetCsrfToken(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Override/auth mocks with learn.tg-specific implementations
vi.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  ConnectButton: () => React.createElement('button', null, 'Connect Wallet'),
}));

vi.mock('wagmi', () => {
  const { mocks } = apiAuthMocks;
  return {
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

// next-auth/react uses apiAuthMocks but adds SessionProvider
vi.mock('next-auth/react', () => {
  const { mocks } = apiAuthMocks;
  return {
    useSession: () => mocks.mockUseSession(),
    getCsrfToken: () => mocks.mockGetCsrfToken(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  }
});

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

vi.mock('lz-string', () => {
  const mockCompress = vi.fn((input: string) => input)
  const mockDecompress = vi.fn((input: string) => input)
  return {
    compressToEncodedURIComponent: mockCompress,
    decompressFromEncodedURIComponent: mockDecompress,
    default: {
      compressToEncodedURIComponent: mockCompress,
      decompressFromEncodedURIComponent: mockDecompress,
    },
  }
});

vi.mock('@goodsdks/citizen-sdk', () => {
  const ClaimSDK = vi.fn()
  return { ClaimSDK, useIdentitySDK: vi.fn() }
});

vi.mock('@goodsdks/react-hooks', () => ({
  useIdentitySDK: vi.fn(),
}));
