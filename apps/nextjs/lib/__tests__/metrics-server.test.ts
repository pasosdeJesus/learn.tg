import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordEvent } from '../metrics-server'
import { libDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'

// Setup mocks before using libDbMocks.MockKysely
libDbMocks.setupMocks()

// Create mock DB instance
let mockDb: any
let mockInsertIntoSpy: any
let mockValuesSpy: any
let mockGetDb: any

// Mock dynamic import of '@/db/database' (hoisted)
vi.mock('@/db/database', () => ({
  getDb: () => mockGetDb(),
}))

describe('metrics-server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    libDbMocks.resetMocks()
    // Reset window to undefined (server-side)
    Object.defineProperty(global, 'window', {
      value: undefined,
      writable: true,
    })
    // Reset mocks to default behavior
    libDbMocks.mockExecute.mockResolvedValue(undefined)

    // Create fresh mock DB instance
    mockDb = new libDbMocks.MockKysely()
    mockInsertIntoSpy = vi.spyOn(mockDb, 'insertInto').mockReturnValue(mockDb)
    mockValuesSpy = vi.spyOn(mockDb, 'values').mockReturnValue(mockDb)
    mockGetDb = vi.fn(() => mockDb)
  })

  it('should throw error when called client-side (window defined)', async () => {
    // Simulate browser environment
    Object.defineProperty(global, 'window', {
      value: { location: {} },
      writable: true,
    })

    await expect(recordEvent({ event_type: 'test' }))
      .rejects.toThrow('recordEvent should only be called server-side')

    // Restore
    Object.defineProperty(global, 'window', {
      value: undefined,
      writable: true,
    })
  })

  it('should record event successfully with all fields', async () => {
    const event = {
      event_type: 'test_event',
      event_data: { key: 'value' },
      usuario_id: 123,
      timestamp: new Date('2024-01-01'),
    }

    await recordEvent(event)

    expect(mockGetDb).toHaveBeenCalled()
    expect(mockInsertIntoSpy).toHaveBeenCalledWith('userevent')
    expect(mockValuesSpy).toHaveBeenCalledWith({
      event_type: 'test_event',
      event_data: '{"key":"value"}',
      created_at: event.timestamp,
      usuario_id: 123,
    })
    expect(libDbMocks.mockExecute).toHaveBeenCalled()
  })

  it('should record event without usuario_id when null', async () => {
    const event = {
      event_type: 'test_event',
      event_data: null,
      usuario_id: null,
    }

    await recordEvent(event as any)

    expect(mockValuesSpy).toHaveBeenCalledWith({
      event_type: 'test_event',
      event_data: null,
      created_at: expect.any(Date),
      // usuario_id should NOT be included
    })
    expect(mockValuesSpy.mock.calls[0][0]).not.toHaveProperty('usuario_id')
  })

  it('should record event without usuario_id when undefined', async () => {
    const event = {
      event_type: 'test_event',
      event_data: undefined,
      // usuario_id omitted
    }

    await recordEvent(event)

    expect(mockValuesSpy).toHaveBeenCalledWith({
      event_type: 'test_event',
      event_data: null,
      created_at: expect.any(Date),
      // usuario_id should NOT be included
    })
    expect(mockValuesSpy.mock.calls[0][0]).not.toHaveProperty('usuario_id')
  })

  it('should handle database errors and rethrow', async () => {
    const error = new Error('DB failure')
    libDbMocks.mockExecute.mockRejectedValue(error)

    const event = { event_type: 'test' }

    await expect(recordEvent(event)).rejects.toThrow(error)
  })
})