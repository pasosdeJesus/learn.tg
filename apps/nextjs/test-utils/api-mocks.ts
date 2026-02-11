/**
 * API mocking utilities for tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { vi } from 'vitest'

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
 * Mock for lib/guide-utils module
 */
export function mockGuideUtils() {
  return guideUtilsMocks
}

/**
 * Setup all module mocks. Call this in your test file's beforeAll.
 */
export function setupApiMocks() {
  vi.mock('@/lib/metrics/queries', () => metricsQueriesMocks)
  vi.mock('@/lib/crypto', () => cryptoMocks)
  vi.mock('@/lib/scores', () => scoresMocks)
  vi.mock('@/lib/guide-utils', () => guideUtilsMocks)
}

/**
 * Reset all mock implementations
 */
export function resetApiMocks() {
  metricsQueriesMocks.getAllMetrics.mockReset()
  metricsQueriesMocks.getCompletionRate.mockReset()
  metricsQueriesMocks.getRetentionByCooldown.mockReset()
  metricsQueriesMocks.getTimeBetweenGuides.mockReset()
  metricsQueriesMocks.getUserGrowth.mockReset()
  metricsQueriesMocks.getGameEngagement.mockReset()

  cryptoMocks.callWriteFun.mockReset()
  cryptoMocks.waitForReceiptWithRetry.mockReset()

  scoresMocks.updateUserAndCoursePoints.mockReset()

  guideUtilsMocks.getGuidesByCourseId.mockReset()
  guideUtilsMocks.getGuideIdBySuffix.mockReset()
  guideUtilsMocks.getActividadpfId.mockReset()
  guideUtilsMocks.getCourseIdByPrefix.mockReset()
}

/**
 * Mock for NextRequest constructor
 */
export function createMockNextRequest(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)

  return {
    method: init?.method || 'GET',
    url,
    headers,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    formData: vi.fn().mockResolvedValue(new FormData()),
    clone: vi.fn().mockReturnThis(),
    ...init,
  } as any
}

/**
 * Mock for NextResponse
 */
export const mockNextResponse = {
  json: vi.fn().mockReturnValue(new Response()),
  redirect: vi.fn().mockReturnValue(new Response()),
  next: vi.fn().mockReturnValue(new Response()),
}

/**
 * Setup common API mocks for route tests
 */
export function setupCommonRouteMocks() {
  setupApiMocks()
  return {
    metricsMocks: metricsQueriesMocks,
    cryptoMocks,
    scoresMocks,
    guideUtilsMocks,
  }
}