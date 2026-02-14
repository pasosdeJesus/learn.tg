import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { Skeleton } from '@/components/ui/skeleton'

describe('Skeleton', () => {
  it('renders skeleton with default classes', () => {
    const { container } = render(<Skeleton />)

    const skeleton = container.firstChild
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted')
    expect(skeleton?.tagName).toBe('DIV')
  })

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="my-custom-class" />)

    const skeleton = container.firstChild
    expect(skeleton).toHaveClass('my-custom-class')
    expect(skeleton).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted')
  })

  it('forwards additional props to div', () => {
    const { container } = render(
      <Skeleton aria-label="Loading" data-testid="skeleton" />
    )

    const skeleton = container.firstChild
    expect(skeleton).toHaveAttribute('aria-label', 'Loading')
    expect(skeleton).toHaveAttribute('data-testid', 'skeleton')
  })

  it('renders with children (though not typical)', () => {
    const { container } = render(<Skeleton>Loading content</Skeleton>)

    const skeleton = container.firstChild
    expect(skeleton).toHaveTextContent('Loading content')
  })

  it('has correct display name', () => {
    expect(Skeleton.displayName).toBeUndefined() // It's a function component, no display name
  })
})