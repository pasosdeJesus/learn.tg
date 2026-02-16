/**
 * Learn.tg specific mocking utilities for tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { vi } from 'vitest'
import { viemMocks, viemChainsMocks } from '../common/viem-mocks'

// Mock objects defined with vi.hoisted for proper hoisting
const metricsQueriesMocks = vi.hoisted(() => ({
  getAllMetrics: vi.fn(() => Promise.resolve({
    completionRate: [],
    retention: [],
    timeBetweenGuides: [],
    userGrowth: [],
    gameEngagement: [],
    lastUpdated: new Date().toISOString(),
  })),
  getCompletionRate: vi.fn(() => Promise.resolve([])),
  getRetentionByCooldown: vi.fn(() => Promise.resolve([])),
  getTimeBetweenGuides: vi.fn(() => Promise.resolve([])),
  getUserGrowth: vi.fn(() => Promise.resolve([])),
  getGameEngagement: vi.fn(() => Promise.resolve([])),
}))

const cryptoMocks = vi.hoisted(() => ({
  callWriteFun: vi.fn(() => Promise.resolve('0xmocktxhash')),
  waitForReceiptWithRetry: vi.fn(() => Promise.resolve({
    status: 'success',
    transactionHash: '0xmocktxhash',
  })),
}))

const scoresMocks = vi.hoisted(() => ({
  updateUserAndCoursePoints: vi.fn(() => Promise.resolve(undefined)),
}))

const guideUtilsMocks = vi.hoisted(() => ({
  getGuidesByCourseId: vi.fn(() => Promise.resolve(null)),
  getGuideIdBySuffix: vi.fn(() => Promise.resolve(null)),
  getActividadpfId: vi.fn(() => Promise.resolve(null)),
  getCourseIdByPrefix: vi.fn(() => Promise.resolve(null)),
}))

const metricsServerMocks = vi.hoisted(() => ({
  recordEvent: vi.fn(() => Promise.resolve(undefined)),
}))

const libConfigMocks = vi.hoisted(() => ({
  IS_PRODUCTION: false,
}))

/**
 * Mock for lib/metrics/queries module
 */
export function mockMetricsQueries() {
  return metricsQueriesMocks
}

/**
 * Mock for lib/crypto module
 */
export function mockCrypto() {
  return cryptoMocks
}

/**
 * Mock for lib/scores module
 */
export function mockScores() {
  return scoresMocks
}

/**
 * Mock for lib/metrics-server module
 */
export function mockMetricsServer() {
  return metricsServerMocks
}

/**
 * Mock for lib/config module
 */
export function mockLibConfig() {
  return libConfigMocks
}

/**
 * Setup all module mocks. Call this in your test file's beforeAll.
 */
export function setupApiMocks() {
  vi.mock('@/lib/metrics/queries', () => metricsQueriesMocks)
  vi.mock('@/lib/crypto', () => cryptoMocks)
  vi.mock('@/lib/scores', () => scoresMocks)
  vi.mock('@/lib/guide-utils', () => guideUtilsMocks)
  vi.mock('viem', () => viemMocks)
  vi.mock('viem/chains', () => viemChainsMocks)
  vi.mock('@/lib/metrics-server', () => metricsServerMocks)
  vi.mock('@/lib/config', () => libConfigMocks)
}

