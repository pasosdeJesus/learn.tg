import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock @radix-ui/react-switch
vi.mock('@radix-ui/react-switch', () => ({
  Root: React.forwardRef(({ className, checked, disabled, ...props }: any, ref: any) => (
    <button
      ref={ref}
      data-testid="switch-root"
      className={className}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      {...props}
    />
  )),
  Thumb: ({ className, ...props }: any) => (
    <span data-testid="switch-thumb" className={className} {...props} />
  ),
}))

import { Switch } from '@/components/ui/switch'

describe('Switch', () => {
  it('renders switch root', () => {
    render(<Switch />)
    const root = screen.getByTestId('switch-root')
    expect(root).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Switch className="custom-class" />)
    const root = screen.getByTestId('switch-root')
    expect(root).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Switch ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current).toHaveAttribute('data-testid', 'switch-root')
  })

  it('renders thumb', () => {
    render(<Switch />)
    const thumb = screen.getByTestId('switch-thumb')
    expect(thumb).toBeInTheDocument()
  })

  it('handles click event', () => {
    const onClick = vi.fn()
    render(<Switch onClick={onClick} />)
    const root = screen.getByTestId('switch-root')
    fireEvent.click(root)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Switch disabled />)
    const root = screen.getByTestId('switch-root')
    expect(root).toBeDisabled()
  })

  it('applies checked state class when checked', () => {
    render(<Switch checked />)
    const root = screen.getByTestId('switch-root')
    expect(root).toHaveAttribute('data-state', 'checked')
  })

  it('applies unchecked state class when unchecked', () => {
    render(<Switch checked={false} />)
    const root = screen.getByTestId('switch-root')
    expect(root).toHaveAttribute('data-state', 'unchecked')
  })
})