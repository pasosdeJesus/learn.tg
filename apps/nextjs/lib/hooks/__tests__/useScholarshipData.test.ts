// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { apiAuthMocks } from '@pasosdejesus/m/test-utils/rainbowkit-mocks'

const { mocks } = apiAuthMocks
apiAuthMocks.setupMocks()

import { useScholarshipData } from '../useScholarshipData'

describe('useScholarshipData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetCsrfToken.mockResolvedValue('mock-csrf-token')
    mocks.mockAxiosGet.mockResolvedValue({
      data: {
        vaultCreated: true,
        vaultBalance: 100,
        amountPerGuide: 10,
        canSubmit: true,
        percentageCompleted: 50,
        completedGuides: 3,
        paidGuides: 2,
        totalGuides: 6,
        percentagePaid: 33.33,
        amountScholarship: 20,
        profileScore: 75,
      },
    })
  })

  it('initializes with null values', () => {
    const { result } = renderHook(() => useScholarshipData({ courseId: undefined, address: undefined }))
    expect(result.current.vaultCreated).toBeNull()
    expect(result.current.vaultBalance).toBeNull()
    expect(result.current.scholarshipPerGuide).toBeNull()
  })

  it('does not fetch when courseId is missing', async () => {
    renderHook(() => useScholarshipData({ courseId: undefined, address: '0x123' }))
    // fetchScholarship won't be called because courseId is undefined
    // We just verify no errors
    await new Promise(r => setTimeout(r, 10))
    expect(mocks.mockAxiosGet).not.toHaveBeenCalled()
  })

  it('does not fetch when address is missing', async () => {
    renderHook(() => useScholarshipData({ courseId: 1, address: undefined }))
    await new Promise(r => setTimeout(r, 10))
    expect(mocks.mockAxiosGet).not.toHaveBeenCalled()
  })

  it('fetches and returns scholarship data when courseId and address are provided', async () => {
    const { result } = renderHook(() => useScholarshipData({ courseId: 1, address: '0xabc' }))

    // Hook only defines fetchScholarship; caller must invoke it
    await act(async () => { result.current.fetchScholarship() })

    await waitFor(() => {
      expect(result.current.vaultCreated).toBe(true)
    })

    expect(result.current.vaultBalance).toBe(100)
    expect(result.current.scholarshipPerGuide).toBe(10)
    expect(result.current.canSubmit).toBe(true)
    expect(result.current.percentageCompleted).toBe(50)
    expect(result.current.completedGuides).toBe(3)
    expect(result.current.paidGuides).toBe(2)
    expect(result.current.totalGuides).toBe(6)
    expect(result.current.percentagePaid).toBe(33.33)
    expect(result.current.scholarshipPaid).toBe(20)
    expect(result.current.profileScore).toBe(75)

    expect(mocks.mockAxiosGet).toHaveBeenCalledWith(
      '/api/scholarship?courseId=1&walletAddress=0xabc&token=mock-csrf-token'
    )
  })

  it('handles null response fields gracefully', async () => {
    mocks.mockAxiosGet.mockResolvedValue({
      data: {
        vaultCreated: null,
        vaultBalance: null,
        amountPerGuide: null,
        canSubmit: null,
        percentageCompleted: null,
        completedGuides: null,
        paidGuides: null,
        totalGuides: null,
        percentagePaid: null,
        amountScholarship: null,
        profileScore: null,
      },
    })

    const { result } = renderHook(() => useScholarshipData({ courseId: 1, address: '0xabc' }))

    await act(async () => { result.current.fetchScholarship() })

    await waitFor(() => {
      expect(result.current.vaultCreated).toBeNull()
    })
    expect(result.current.vaultBalance).toBeNull()
  })

  it('does not throw when API call fails', async () => {
    mocks.mockAxiosGet.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useScholarshipData({ courseId: 1, address: '0xabc' }))

    await act(async () => { result.current.fetchScholarship() })

    await new Promise(r => setTimeout(r, 50))
    // Should not throw, just log error
    expect(result.current.vaultCreated).toBeNull()
  })
})
