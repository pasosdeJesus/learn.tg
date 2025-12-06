  import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
  import { NextRequest } from 'next/server'
  import { getServerSession } from 'next-auth/next'

  // Mocks de dependencias
  const mockExecuteTakeFirst = vi.fn()
  const mockExecute = vi.fn()

  const mockKysely = {
    selectFrom: vi.fn(() => mockKysely),
    select: vi.fn(() => mockKysely),
    where: vi.fn(() => mockKysely),
    orderBy: vi.fn(() => mockKysely),
    execute: mockExecute,
    executeTakeFirst: mockExecuteTakeFirst,
  }

  vi.mock('next-auth/next')
  vi.mock('@/.config/kysely.config.ts', () => ({
    newKyselyPostgresql: () => mockKysely,
  }))

  const mockGetServerSession = getServerSession as any

  let GET: any

  describe('GET /api/guide-status', () => {
    beforeAll(async () => {
      const route = await import('../route')
      GET = route.GET
    })

    const MOCK_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890'
    const MOCK_COURSE_ID = '1'
    const MOCK_USER_ID = 100

    const createMockRequest = (queryParams: Record<string, string>): NextRequest => {
      const url = `http://localhost/api/guide-status?${new URLSearchParams(queryParams)}`
      return new NextRequest(url)
    }

    beforeEach(() => {
      vi.clearAllMocks()
      mockExecute.mockClear()
      mockExecuteTakeFirst.mockClear()
    })

    it('should return 401 Unauthorized if session address does not match', async () => {
      mockGetServerSession.mockResolvedValue({ address: '0xdifferentwallet' })
      const req = createMockRequest({ walletAddress: MOCK_WALLET_ADDRESS, courseId: MOCK_COURSE_ID, guideNumber: '1' })
      const response = await GET(req)
      const body = await response.json()
      expect(response.status).toBe(401)
      expect(body).toEqual({ error: 'No autorizado' })
    })

    it('should return 400 if parameters are missing', async () => {
      mockGetServerSession.mockResolvedValue({ address: MOCK_WALLET_ADDRESS })
      const req = createMockRequest({ walletAddress: MOCK_WALLET_ADDRESS })
      const response = await GET(req)
      const body = await response.json()
      expect(response.status).toBe(400)
      expect(body).toEqual({ error: 'Parámetros requeridos ausentes' })
    })

    it('should return default status if user not found', async () => {
      mockGetServerSession.mockResolvedValue({ address: MOCK_WALLET_ADDRESS })
      mockExecuteTakeFirst.mockResolvedValueOnce(null)
      const req = createMockRequest({ walletAddress: MOCK_WALLET_ADDRESS, courseId: MOCK_COURSE_ID, guideNumber: '1' })
      const response = await GET(req)
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toEqual({ completed: false, receivedScholarship: false })
    })

    it('should return 404 if guide number is out of bounds', async () => {
      mockGetServerSession.mockResolvedValue({ address: MOCK_WALLET_ADDRESS })
      mockExecuteTakeFirst.mockResolvedValueOnce({ usuario_id: MOCK_USER_ID })
      mockExecute.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      const req = createMockRequest({ walletAddress: MOCK_WALLET_ADDRESS, courseId: MOCK_COURSE_ID, guideNumber: '3' })
      const response = await GET(req)
      const body = await response.json()
      expect(response.status).toBe(404)
      expect(body).toEqual({ error: 'Guía no encontrada para este curso' })
    })

    it('should return correct status for an unattempted guide', async () => {
      mockGetServerSession.mockResolvedValue({ address: MOCK_WALLET_ADDRESS })
      mockExecuteTakeFirst.mockResolvedValueOnce({ usuario_id: MOCK_USER_ID })
      mockExecute.mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
      mockExecuteTakeFirst.mockResolvedValueOnce(null)
      const req = createMockRequest({ walletAddress: MOCK_WALLET_ADDRESS, courseId: MOCK_COURSE_ID, guideNumber: '2' })
      const response = await GET(req)
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toEqual({ completed: false, receivedScholarship: false })
    })

    it('should return correct status for a completed guide without scholarship', async () => {
      mockGetServerSession.mockResolvedValue({ address: MOCK_WALLET_ADDRESS })
      mockExecuteTakeFirst.mockResolvedValueOnce({ usuario_id: MOCK_USER_ID })
      mockExecute.mockResolvedValueOnce([{ id: 10 }])
      mockExecuteTakeFirst.mockResolvedValueOnce({ points: 5, amountpaid: '0' })
      const req = createMockRequest({ walletAddress: MOCK_WALLET_ADDRESS, courseId: MOCK_COURSE_ID, guideNumber: '1' })
      const response = await GET(req)
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toEqual({ completed: true, receivedScholarship: false })
    })

    it('should return correct status for a guide with scholarship', async () => {
      mockGetServerSession.mockResolvedValue({ address: MOCK_WALLET_ADDRESS })
      mockExecuteTakeFirst.mockResolvedValueOnce({ usuario_id: MOCK_USER_ID })
      mockExecute.mockResolvedValueOnce([{ id: 10 }])
      mockExecuteTakeFirst.mockResolvedValueOnce({ points: 10, amountpaid: '550000000000000000' })
      const req = createMockRequest({ walletAddress: MOCK_WALLET_ADDRESS, courseId: MOCK_COURSE_ID, guideNumber: '1' })
      const response = await GET(req)
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toEqual({ completed: true, receivedScholarship: true })
    })
  })

