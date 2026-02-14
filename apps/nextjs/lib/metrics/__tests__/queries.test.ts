import { describe, it, expect, vi, beforeEach } from 'vitest'
import { libDbMocks } from '@/test-utils/db-mocks'

// Setup mocks using libDbMocks before importing the module
const { mockSqlExecute, mockSql, MockKysely } = libDbMocks

// Mock kysely and related modules
vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn(),
  sql: mockSql,
}))

vi.mock('@/.config/kysely.config', () => ({
  newKyselyPostgresql: vi.fn(() => new MockKysely()),
}))

// Mock the database module to return our mock db instance
const mockDb = new MockKysely()
vi.mock('@/db/database', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Now import the module after mocks are set up
import * as metricsQueries from '../queries'

describe('metrics/queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    libDbMocks.resetMocks()
    // Configure sql mock to support template tag usage
    mockSql.mockImplementation(() => ({
      execute: mockSqlExecute,
      val: vi.fn((val) => val),
    }))
    // Default empty response
    mockSqlExecute.mockResolvedValue({ rows: [] })
  })

  describe('getCompletionRate', () => {
    it('should return completion rate data grouped by date when data exists', async () => {
      const mockRows = [
        {
          date: '2024-01-01',
          completion_rate: '75.5',
          total_guides: 100,
          completed_guides: 75,
        },
        {
          date: '2024-01-02',
          completion_rate: '80.0',
          total_guides: 120,
          completed_guides: 96,
        },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockRows })

      const result = await metricsQueries.getCompletionRate()

      expect(result).toEqual([
        { date: '2024-01-01', completionRate: 75.5, totalGuides: 100, completedGuides: 75 },
        { date: '2024-01-02', completionRate: 80.0, totalGuides: 120, completedGuides: 96 },
      ])
      expect(mockSql).toHaveBeenCalled()
    })

    it('should return overall completion rate when no dated data exists', async () => {
      // First call returns empty rows (no dated data)
      mockSqlExecute.mockResolvedValueOnce({ rows: [] })
      // Second call returns overall data
      mockSqlExecute.mockResolvedValueOnce({
        rows: [{ completion_rate: '65.3', total_guides: 200, completed_guides: 130 }],
      })

      const result = await metricsQueries.getCompletionRate()

      // Should return single data point with today's date
      expect(result).toHaveLength(1)
      expect(result[0].completionRate).toBe(65.3)
      expect(result[0].totalGuides).toBe(200)
      expect(result[0].completedGuides).toBe(130)
      expect(result[0].date).toBe(new Date().toISOString().split('T')[0])
    })

    it('should return empty array when no data at all', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })

      const result = await metricsQueries.getCompletionRate()

      expect(result).toEqual([])
    })

    it('should handle database errors and return empty array', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await metricsQueries.getCompletionRate()

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith('[metrics] Error fetching completion rate:', expect.any(Error))
      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })
  })

  describe('getRetentionByCooldown', () => {
    it('should return retention data when available', async () => {
      const mockRows = [
        { cooldown_type: 'After 24h', retention_rate: 45.5, users: 50 },
        { cooldown_type: 'After 48h', retention_rate: 30.2, users: 33 },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockRows })

      const result = await metricsQueries.getRetentionByCooldown()

      expect(result).toEqual([
        { cooldownType: 'After 24h', retentionRate: 45.5, users: 50 },
        { cooldownType: 'After 48h', retentionRate: 30.2, users: 33 },
      ])
    })

    it('should return empty array when no retention data', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await metricsQueries.getRetentionByCooldown()

      expect(result).toEqual([])
      expect(consoleWarnSpy).toHaveBeenCalledWith('[metrics] No retention data found')
      consoleWarnSpy.mockRestore()
    })

    it('should handle database errors and return empty array', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await metricsQueries.getRetentionByCooldown()

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith('[metrics] Error fetching retention by cooldown:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getTimeBetweenGuides', () => {
    it('should return time distribution data', async () => {
      const mockRows = [
        { time_range: '0-6h', users: 100, percentage: 50.0 },
        { time_range: '6-12h', users: 50, percentage: 25.0 },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockRows })

      const result = await metricsQueries.getTimeBetweenGuides()

      expect(result).toEqual([
        { timeRange: '0-6h', users: 100, percentage: 50.0 },
        { timeRange: '6-12h', users: 50, percentage: 25.0 },
      ])
    })

    it('should return empty array when no data', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await metricsQueries.getTimeBetweenGuides()

      expect(result).toEqual([])
      expect(consoleWarnSpy).toHaveBeenCalledWith('[metrics] No time between guides data found')
      consoleWarnSpy.mockRestore()
    })

    it('should handle database errors', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await metricsQueries.getTimeBetweenGuides()

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith('[metrics] Error fetching time between guides:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getUserGrowth', () => {
    it('should return user growth data', async () => {
      const mockRows = [
        { date: '2024-01-01', new_users: 10, total_users: 10, active_users: 8 },
        { date: '2024-01-02', new_users: 5, total_users: 15, active_users: 12 },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockRows })

      const result = await metricsQueries.getUserGrowth()

      expect(result).toEqual([
        { date: '2024-01-01', newUsers: 10, totalUsers: 10, activeUsers: 8 },
        { date: '2024-01-02', newUsers: 5, totalUsers: 15, activeUsers: 12 },
      ])
    })

    it('should return empty array when no data', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await metricsQueries.getUserGrowth()

      expect(result).toEqual([])
      expect(consoleWarnSpy).toHaveBeenCalledWith('[metrics] No user growth data found')
      consoleWarnSpy.mockRestore()
    })

    it('should handle database errors', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await metricsQueries.getUserGrowth()

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith('[metrics] Error fetching user growth:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getGameEngagement', () => {
    it('should return game engagement data', async () => {
      const mockRows = [
        { game_type: 'crossword', completion_rate: 85.5, avg_time: 2.5, users: 150 },
        { game_type: 'quiz', completion_rate: 92.0, avg_time: 1.8, users: 120 },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockRows })

      const result = await metricsQueries.getGameEngagement()

      expect(result).toEqual([
        { gameType: 'crossword', completionRate: 85.5, avgTime: 2.5, users: 150 },
        { gameType: 'quiz', completionRate: 92.0, avgTime: 1.8, users: 120 },
      ])
    })

    it('should return empty array when no data', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await metricsQueries.getGameEngagement()

      expect(result).toEqual([])
      expect(consoleWarnSpy).toHaveBeenCalledWith('[metrics] No game engagement data found')
      consoleWarnSpy.mockRestore()
    })

    it('should handle database errors', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await metricsQueries.getGameEngagement()

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith('[metrics] Error fetching game engagement:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getGoodDollarClaimsOverTime', () => {
    it('should return GoodDollar claim data', async () => {
      const mockRows = [
        { date: '2024-01-01', claims: '15', users: '10' },
        { date: '2024-01-02', claims: '20', users: '12' },
      ]
      mockSqlExecute.mockResolvedValue({ rows: mockRows })

      const result = await metricsQueries.getGoodDollarClaimsOverTime()

      expect(result).toEqual([
        { date: '2024-01-01', claims: 15, users: 10 },
        { date: '2024-01-02', claims: 20, users: 12 },
      ])
    })

    it('should return empty array when no data', async () => {
      mockSqlExecute.mockResolvedValue({ rows: [] })
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await metricsQueries.getGoodDollarClaimsOverTime()

      expect(result).toEqual([])
      expect(consoleWarnSpy).toHaveBeenCalledWith('[metrics] No GoodDollar claim data found')
      consoleWarnSpy.mockRestore()
    })

    it('should handle database errors', async () => {
      mockSqlExecute.mockRejectedValue(new Error('DB error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await metricsQueries.getGoodDollarClaimsOverTime()

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith('[metrics] Error fetching GoodDollar claims over time:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getAllMetrics', () => {
    it.skip('should return all metrics data', async () => {
      const completionRateMock = [{ date: '2024-01-01', completionRate: 75.0, totalGuides: 100, completedGuides: 75 }]
      const retentionMock = [{ cooldownType: 'After 24h', retentionRate: 45.5, users: 50 }]
      const timeBetweenGuidesMock = [{ timeRange: '0-6h', users: 100, percentage: 50.0 }]
      const userGrowthMock = [{ date: '2024-01-01', newUsers: 10, totalUsers: 10, activeUsers: 8 }]
      const gameEngagementMock = [{ gameType: 'crossword', completionRate: 85.5, avgTime: 2.5, users: 150 }]
      const goodDollarClaimsMock = [{ date: '2024-01-01', claims: 15, users: 10 }]

      // Mock each function individually
      vi.spyOn(metricsQueries, 'getCompletionRate').mockResolvedValue(completionRateMock)
      vi.spyOn(metricsQueries, 'getRetentionByCooldown').mockResolvedValue(retentionMock)
      vi.spyOn(metricsQueries, 'getTimeBetweenGuides').mockResolvedValue(timeBetweenGuidesMock)
      vi.spyOn(metricsQueries, 'getUserGrowth').mockResolvedValue(userGrowthMock)
      vi.spyOn(metricsQueries, 'getGameEngagement').mockResolvedValue(gameEngagementMock)
      vi.spyOn(metricsQueries, 'getGoodDollarClaimsOverTime').mockResolvedValue(goodDollarClaimsMock)

      const result = await metricsQueries.getAllMetrics()

      expect(result).toEqual({
        completionRate: completionRateMock,
        retention: retentionMock,
        timeBetweenGuides: timeBetweenGuidesMock,
        userGrowth: userGrowthMock,
        gameEngagement: gameEngagementMock,
        goodDollarClaims: goodDollarClaimsMock,
        lastUpdated: expect.any(String),
      })
      expect(new Date(result.lastUpdated).toString()).not.toBe('Invalid Date')
    })
  })
})