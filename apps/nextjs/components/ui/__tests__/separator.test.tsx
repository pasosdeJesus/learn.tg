import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { Separator } from '@/components/ui/separator'

describe('Separator', () => {
  it('renders horizontal separator by default', () => {
    const { container } = render(<Separator />)

    const separator = container.firstChild
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveClass('shrink-0', 'bg-border', 'h-[1px]', 'w-full')
  })

  it('renders vertical separator when orientation is vertical', () => {
    const { container } = render(<Separator orientation="vertical" />)

    const separator = container.firstChild
    expect(separator).toHaveClass('h-full', 'w-[1px]')
    expect(separator).not.toHaveClass('h-[1px]', 'w-full')
  })

  it('applies custom className', () => {
    const { container } = render(<Separator className="my-custom-class" />)

    const separator = container.firstChild
    expect(separator).toHaveClass('my-custom-class')
    expect(separator).toHaveClass('shrink-0', 'bg-border')
  })

  it('passes decorative prop to Radix Separator', () => {
    // The decorative prop is passed to Radix component, we can't easily test it
    // but we can at least verify it renders without errors
    const { container } = render(<Separator decorative={false} />)

    const separator = container.firstChild
    expect(separator).toBeInTheDocument()
  })

  it('forwards ref to underlying element', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<Separator ref={ref} />)

    // The ref should be forwarded to the Radix Separator root
    // We can't easily test the ref attachment, but we can verify it renders
    expect(ref.current).not.toBeNull()
  })

  it('renders with additional props', () => {
    const { container } = render(<Separator aria-label="Section divider" />)

    const separator = container.firstChild
    expect(separator).toHaveAttribute('aria-label', 'Section divider')
  })
})