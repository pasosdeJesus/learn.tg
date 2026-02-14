import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { Progress } from '@/components/ui/progress'

// Mock ResizeObserver which is used by Radix UI Progress
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('Progress', () => {
  it('renders progress bar with default classes', () => {
    const { container } = render(<Progress />)

    const progress = container.firstChild
    expect(progress).toBeInTheDocument()
    expect(progress).toHaveClass(
      'relative h-4 w-full overflow-hidden rounded-full bg-secondary'
    )
  })

  it('applies custom className', () => {
    const { container } = render(<Progress className="my-custom-class" />)

    const progress = container.firstChild
    expect(progress).toHaveClass('my-custom-class')
    expect(progress).toHaveClass('relative h-4 w-full overflow-hidden rounded-full bg-secondary')
  })

  it('renders progress indicator with 0% value by default', () => {
    const { container } = render(<Progress />)

    const root = container.firstChild
    expect(root).toBeInTheDocument()
    const indicator = root?.firstChild
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveClass('h-full w-full flex-1 bg-primary transition-all')
    expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' })
  })

  it('renders progress indicator with 50% value', () => {
    const { container } = render(<Progress value={50} />)

    const root = container.firstChild
    const indicator = root?.firstChild
    expect(indicator).toHaveStyle({ transform: 'translateX(-50%)' })
  })

  it('renders progress indicator with 100% value', () => {
    const { container } = render(<Progress value={100} />)

    const root = container.firstChild
    const indicator = root?.firstChild
    // Accept either "translateX(0%)" or "translateX(-0%)"
    expect(indicator).toHaveStyle({ transform: 'translateX(-0%)' })
  })

  it('handles undefined value (defaults to 0)', () => {
    const { container } = render(<Progress value={undefined} />)

    const root = container.firstChild
    const indicator = root?.firstChild
    expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' })
  })

  it('forwards ref to underlying element', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<Progress ref={ref} />)

    // The ref should be forwarded to the Radix Progress root
    expect(ref.current).not.toBeNull()
  })

  it('passes additional props to root element', () => {
    const { container } = render(<Progress aria-label="Loading progress" />)

    const progress = container.firstChild
    expect(progress).toHaveAttribute('aria-label', 'Loading progress')
  })
})