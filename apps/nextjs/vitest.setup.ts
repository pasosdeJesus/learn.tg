
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

// Set the database URL for tests
process.env.DATABASE_URL = 'postgres://postgres:postgres@db:5432/postgres';

// @ts-ignore
global.React = React;

vi.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  ConnectButton: () => React.createElement('button', null, 'Connect Wallet'),
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
