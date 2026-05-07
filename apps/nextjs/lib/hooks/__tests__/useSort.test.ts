import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSort } from '../useSort'

describe('useSort', () => {
  it('returns default sort values', () => {
    const { result } = renderHook(() => useSort('learningpoints', 'desc'))
    expect(result.current.sortBy).toBe('learningpoints')
    expect(result.current.sortOrder).toBe('desc')
  })

  it('uses desc as default sort order when not provided', () => {
    const { result } = renderHook(() => useSort('name'))
    expect(result.current.sortOrder).toBe('desc')
  })

  it('toggles sort order when same field is sorted again', () => {
    const { result } = renderHook(() => useSort('name', 'desc'))
    act(() => result.current.handleSort('name'))
    expect(result.current.sortBy).toBe('name')
    expect(result.current.sortOrder).toBe('asc')
  })

  it('toggles back on second toggle', () => {
    const { result } = renderHook(() => useSort('name', 'desc'))
    act(() => result.current.handleSort('name'))
    expect(result.current.sortOrder).toBe('asc')
    act(() => result.current.handleSort('name'))
    expect(result.current.sortOrder).toBe('desc')
  })

  it('resets to desc when sorting by a new field', () => {
    const { result } = renderHook(() => useSort<string>('name', 'asc'))
    act(() => result.current.handleSort('score'))
    expect(result.current.sortBy).toBe('score')
    expect(result.current.sortOrder).toBe('desc')
  })

  it('setSort overrides both values', () => {
    const { result } = renderHook(() => useSort<string>('name', 'desc'))
    act(() => result.current.setSort('points', 'asc'))
    expect(result.current.sortBy).toBe('points')
    expect(result.current.sortOrder).toBe('asc')
  })
})
