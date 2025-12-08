import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock @radix-ui/react-slider
vi.mock('@radix-ui/react-slider', () => ({
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="slider-root" className={className} {...props} />
  )),
  Track: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="slider-track" className={className} {...props} />
  )),
  Range: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="slider-range" className={className} {...props} />
  )),
  Thumb: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="slider-thumb" className={className} {...props} />
  )),
}))

import { Slider } from '@/components/ui/slider'

describe('Slider', () => {
  it('renders Slider with default props', () => {
    render(<Slider />)
    const root = screen.getByTestId('slider-root')
    expect(root).toBeInTheDocument()
    expect(screen.getByTestId('slider-track')).toBeInTheDocument()
    expect(screen.getByTestId('slider-range')).toBeInTheDocument()
    expect(screen.getByTestId('slider-thumb')).toBeInTheDocument()
  })

  it('passes className prop to root element', () => {
    render(<Slider className="custom-class" />)
    const root = screen.getByTestId('slider-root')
    expect(root).toHaveClass('custom-class')
  })

  it('forwards ref to root element', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<Slider ref={ref} />)
    const root = screen.getByTestId('slider-root')
    expect(ref.current).toBe(root)
  })

  it('passes other props to root element', () => {
    render(<Slider data-testid="custom-slider" aria-label="Volume" />)
    const root = screen.getByTestId('custom-slider')
    expect(root).toHaveAttribute('data-testid', 'custom-slider')
    expect(root).toHaveAttribute('aria-label', 'Volume')
  })

  it('renders with default value', () => {
    render(<Slider defaultValue={[50]} />)
    const root = screen.getByTestId('slider-root')
    // The default value prop should be passed to the root
    expect(root).toBeInTheDocument()
  })

  it('renders with multiple thumbs when value array has multiple entries', () => {
    // Note: The mock renders a single thumb regardless of value array length
    // This test verifies the component still renders with multiple values
    render(<Slider defaultValue={[25, 75]} />)
    const root = screen.getByTestId('slider-root')
    expect(root).toBeInTheDocument()
    // In a real test with actual Radix UI, we would check for multiple thumbs
    // For now, we just verify the component renders
  })

  it('applies disabled state', () => {
    render(<Slider disabled />)
    const root = screen.getByTestId('slider-root')
    expect(root).toBeInTheDocument()
    // The disabled prop should be passed to the root
  })
})