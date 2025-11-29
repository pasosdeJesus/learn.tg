import { describe, it, expect } from 'vitest'
import * as icons from '../icons'

describe('icons module', () => {
  it('exports Icons object', () => {
    expect(typeof icons.Icons).toBe('object')
    expect(Object.keys(icons.Icons).length).toBeGreaterThan(0)
  })

  it('exports all expected icon keys', () => {
    const expectedKeys = [
      'arrowRight',
      'arrowLeft',
      'check',
      'chevronDown',
      'circle',
      'workflow',
      'close',
      'copy',
      'dark',
      'edit',
      'externalLink',
      'file',
      'help',
      'home',
      'light',
      'loader',
      'mail',
      'messageSquare',
      'plus',
      'plusCircle',
      'search',
      'server',
      'settings',
      'share',
      'shield',
      'spinner',
      'trash',
      'user',
      'piggyBank',
      'phone',
    ]
    expectedKeys.forEach((key) => {
      expect(icons.Icons).toHaveProperty(key)
    })
  })
})
