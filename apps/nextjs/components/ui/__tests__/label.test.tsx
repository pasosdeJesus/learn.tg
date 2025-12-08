import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { Label } from '@/components/ui/label'

describe('Label', () => {
  it('renders a label element', () => {
    render(<Label>My Label</Label>)
    const label = screen.getByText('My Label')
    expect(label).toBeInTheDocument()
    expect(label.tagName).toBe('LABEL')
  })

  it('applies custom className', () => {
    const { container } = render(<Label className="custom-class">Test</Label>)
    const label = container.firstChild
    expect(label).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = React.createRef<HTMLLabelElement>()
    render(<Label ref={ref}>Ref test</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
    expect(ref.current?.textContent).toBe('Ref test')
  })

  it('has htmlFor attribute', () => {
    render(<Label htmlFor="input-id">Label for input</Label>)
    const label = screen.getByText('Label for input')
    expect(label).toHaveAttribute('for', 'input-id')
  })

  it('applies variant classes', () => {
    const { container } = render(<Label>Default</Label>)
    const label = container.firstChild
    expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none')
  })
})