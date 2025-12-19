/// <reference types="vitest/globals" />

import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import { sql } from 'kysely'

// Mock the entire module
vi.mock('@/.config/kysely.config', () => ({
  newKyselyPostgresql: vi.fn(),
}))

// Cast the mock to the correct type for TypeScript
const mockedNewKyselyPostgresql = newKyselyPostgresql as vi.Mock

describe('API /api/courses-with-progress', () => {
  let mockDb: any

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Default mock setup for a successful but empty query chain
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      onRef: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue([]),
    }
    mockedNewKyselyPostgresql.mockReturnValue(mockDb)
  })

  it('should return 400 if walletAddress is missing', async () => {
    const req = new NextRequest('http://localhost?lang=en')
    const response = await GET(req)
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toBe('walletAddress is required')
  })

  it('should return courses with 0 progress if user is not found', async () => {
    const mockCourses = [
      { id: 1, title: 'Course 1', /* other fields */ },
      { id: 2, title: 'Course 2', /* other fields */ },
    ]
    const expectedCourses = mockCourses.map(c => ({
        ...c,
        percentageCompleted: 0,
        percentagePaid: 0,
    }));


    // User query fails
    mockDb.executeTakeFirst.mockResolvedValue(null)
    // Fallback course query succeeds
    mockDb.execute.mockResolvedValue(mockCourses)

    const req = new NextRequest('http://localhost?lang=en&walletAddress=0xnotfound')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual(expectedCourses)
    expect(mockDb.executeTakeFirst).toHaveBeenCalledOnce()
    // Check that the second `execute` (for courses) was called
    expect(mockDb.execute).toHaveBeenCalledOnce()
  })

  it('should return courses with calculated progress if user is found', async () => {
    const mockUser = { userId: 123 }
    const mockCoursesWithProgress = [
      {
        id: 1,
        titulo: 'Course 1',
        percentageCompleted: 50,
        percentagePaid: 25,
      },
    ]

    // User query succeeds
    mockDb.executeTakeFirst.mockResolvedValue(mockUser)
    // Main progress query succeeds
    mockDb.execute.mockResolvedValue(mockCoursesWithProgress)

    const req = new NextRequest('http://localhost?lang=en&walletAddress=0xfound')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual(mockCoursesWithProgress)
    expect(mockDb.executeTakeFirst).toHaveBeenCalledOnce()
    expect(mockDb.execute).toHaveBeenCalledOnce()
    // Verify it's using the more complex query path
    expect(mockDb.leftJoin).toHaveBeenCalled()
    expect(mockDb.groupBy).toHaveBeenCalled()
  })

  it('should handle database errors gracefully', async () => {
    const dbError = new Error('DB connection failed')
    mockedNewKyselyPostgresql.mockImplementation(() => {
      throw dbError
    })

    const req = new NextRequest('http://localhost?lang=en&walletAddress=0xany')
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toContain('Failed to fetch data')
  })
})
