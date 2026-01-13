import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('px-2 py-1', 'bg-red-500')
      // Should contain both classes, order not important
      expect(result).toContain('px-2')
      expect(result).toContain('py-1')
      expect(result).toContain('bg-red-500')
      // Should not have duplicates
      const classes = result.split(' ')
      expect(classes).toHaveLength(3)
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const result = cn('base', isActive && 'active', 'other')
      expect(result).toContain('active')
      expect(result).toContain('base')
      expect(result).toContain('other')
    })

    it('should deduplicate conflicting tailwind classes', () => {
      const result = cn('p-2', 'p-4')
      // tailwind-merge should keep p-4 (last wins)
      expect(result).toBe('p-4')
    })

    it('should handle empty inputs', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle arrays and objects', () => {
      const result = cn(['px-2', 'py-1'], { 'bg-blue-500': true })
      expect(result).toContain('px-2')
      expect(result).toContain('py-1')
      expect(result).toContain('bg-blue-500')
    })
  })
})