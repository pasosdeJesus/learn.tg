import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('renders as a button by default', () => {
    render(<Button>Test</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
  })

  it('handles click events', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('applies variant classes', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>)
    const button = container.firstChild
    expect(button).toHaveClass('bg-destructive')
  })

  it('applies size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>)
    const button = container.firstChild
    expect(button).toHaveClass('h-10')
  })

  describe('asChild prop', () => {
    it('renders as child element when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link</a>
        </Button>
      )
      const link = screen.getByRole('link')
      expect(link).toBeInTheDocument()
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', '/test')
    })

    it('passes button props to child element', () => {
      const onClick = vi.fn()
      render(
        <Button asChild onClick={onClick}>
          <div>Child</div>
        </Button>
      )
      const child = screen.getByText('Child')
      fireEvent.click(child)
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })
})