import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('renders with children', () => {
    render(<Badge>Test Badge</Badge>)
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('renders as a span by default', () => {
    render(<Badge>Test</Badge>)
    const badge = screen.getByText('Test')
    expect(badge.tagName).toBe('SPAN')
  })

  it('applies default variant classes', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('bg-primary')
    expect(badge).toHaveClass('text-primary-foreground')
  })

  it('applies secondary variant classes', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('bg-secondary')
    expect(badge).toHaveClass('text-secondary-foreground')
  })

  it('applies destructive variant classes', () => {
    const { container } = render(<Badge variant="destructive">Destructive</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('bg-destructive')
    expect(badge).toHaveClass('text-white')
  })

  it('applies outline variant classes', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('text-foreground')
  })

  it('renders as child element when asChild is true', () => {
    render(
      <Badge asChild>
        <a href="/test">Link Badge</a>
      </Badge>
    )
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/test')
    // Should have badge classes
    expect(link).toHaveClass('bg-primary')
  })
})