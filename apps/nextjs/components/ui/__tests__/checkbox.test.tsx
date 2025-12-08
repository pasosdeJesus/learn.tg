import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock @radix-ui/react-checkbox
vi.mock('@radix-ui/react-checkbox', () => ({
  Root: React.forwardRef(({ className, checked, disabled, ...props }: any, ref: any) => (
    <button
      ref={ref}
      data-testid="checkbox-root"
      className={className}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      {...props}
    />
  )),
  Indicator: ({ className, children }: any) => (
    <div data-testid="checkbox-indicator" className={className}>{children}</div>
  ),
}))

// Mock lucide-react Check icon
vi.mock('lucide-react', () => ({
  Check: ({ className }: any) => <div data-testid="check-icon" className={className}>✓</div>,
}))

import { Checkbox } from '@/components/ui/checkbox'

describe('Checkbox', () => {
  it('renders checkbox root', () => {
    render(<Checkbox />)
    const root = screen.getByTestId('checkbox-root')
    expect(root).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Checkbox className="custom-class" />)
    const root = screen.getByTestId('checkbox-root')
    expect(root).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Checkbox ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current).toHaveAttribute('data-testid', 'checkbox-root')
  })

  it('renders indicator with check icon', () => {
    render(<Checkbox />)
    const indicator = screen.getByTestId('checkbox-indicator')
    expect(indicator).toBeInTheDocument()
    const icon = screen.getByTestId('check-icon')
    expect(icon).toBeInTheDocument()
  })

  it('handles click event', () => {
    const onClick = vi.fn()
    render(<Checkbox onClick={onClick} />)
    const root = screen.getByTestId('checkbox-root')
    fireEvent.click(root)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Checkbox disabled />)
    const root = screen.getByTestId('checkbox-root')
    expect(root).toHaveAttribute('disabled')
  })

  it('applies checked state class when checked', () => {
    render(<Checkbox checked />)
    const root = screen.getByTestId('checkbox-root')
    expect(root).toHaveAttribute('data-state', 'checked')
  })
})