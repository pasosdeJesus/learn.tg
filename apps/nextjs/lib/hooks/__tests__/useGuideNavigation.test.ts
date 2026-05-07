import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGuideNavigation } from '../useGuideNavigation'
import type { Guide } from '../useGuideData'

const mockGuides: Guide[] = [
  { titulo: 'Guide 1', sufijoRuta: 'guide1' },
  { titulo: 'Guide 2', sufijoRuta: 'guide2' },
  { titulo: 'Guide 3', sufijoRuta: 'guide3' },
]

describe('useGuideNavigation', () => {
  it('returns empty state when no currentSuffix', () => {
    const { result } = renderHook(() =>
      useGuideNavigation({ guides: mockGuides, currentSuffix: undefined, lang: 'en', pathPrefix: 'course' })
    )
    expect(result.current.myGuide).toBeNull()
    expect(result.current.guideNumber).toBe(0)
    expect(result.current.nextGuidePath).toBe('')
    expect(result.current.previousGuidePath).toBe('')
    expect(result.current.coursePath).toBe('/en/course')
  })

  it('returns empty state when guides is empty', () => {
    const { result } = renderHook(() =>
      useGuideNavigation({ guides: [], currentSuffix: 'guide1', lang: 'en', pathPrefix: 'course' })
    )
    expect(result.current.myGuide).toBeNull()
    expect(result.current.guideNumber).toBe(0)
  })

  it('returns empty state when suffix not found', () => {
    const { result } = renderHook(() =>
      useGuideNavigation({ guides: mockGuides, currentSuffix: 'nonexistent', lang: 'en', pathPrefix: 'course' })
    )
    expect(result.current.myGuide).toBeNull()
    expect(result.current.guideNumber).toBe(0)
  })

  it('navigates first guide correctly (no previous)', () => {
    const { result } = renderHook(() =>
      useGuideNavigation({ guides: mockGuides, currentSuffix: 'guide1', lang: 'en', pathPrefix: 'course' })
    )
    expect(result.current.myGuide?.titulo).toBe('Guide 1')
    expect(result.current.guideNumber).toBe(1)
    expect(result.current.previousGuidePath).toBe('')
    expect(result.current.nextGuidePath).toBe('/en/course/guide2')
  })

  it('navigates middle guide correctly (both prev and next)', () => {
    const { result } = renderHook(() =>
      useGuideNavigation({ guides: mockGuides, currentSuffix: 'guide2', lang: 'es', pathPrefix: 'curso' })
    )
    expect(result.current.myGuide?.titulo).toBe('Guide 2')
    expect(result.current.guideNumber).toBe(2)
    expect(result.current.previousGuidePath).toBe('/es/curso/guide1')
    expect(result.current.nextGuidePath).toBe('/es/curso/guide3')
  })

  it('navigates last guide correctly (no next)', () => {
    const { result } = renderHook(() =>
      useGuideNavigation({ guides: mockGuides, currentSuffix: 'guide3', lang: 'en', pathPrefix: 'course' })
    )
    expect(result.current.myGuide?.titulo).toBe('Guide 3')
    expect(result.current.guideNumber).toBe(3)
    expect(result.current.nextGuidePath).toBe('')
    expect(result.current.previousGuidePath).toBe('/en/course/guide2')
  })
})
