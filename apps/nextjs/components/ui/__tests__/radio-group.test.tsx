import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock @radix-ui/react-radio-group
vi.mock('@radix-ui/react-radio-group', () => ({
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="radio-group-root" className={className} {...props} />
  )),
  Item: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="radio-group-item" className={className} {...props}>
      {props.children}
    </button>
  )),
  Indicator: ({ className, children }: any) => (
    <div data-testid="radio-group-indicator" className={className}>{children}</div>
  ),
}))

// Mock lucide-react Circle icon
vi.mock('lucide-react', () => ({
  Circle: ({ className }: any) => <div data-testid="circle-icon" className={className}>○</div>,
}))

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

describe('RadioGroup', () => {
  it('renders radio group root', () => {
    render(<RadioGroup />)
    const root = screen.getByTestId('radio-group-root')
    expect(root).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<RadioGroup className="custom-class" />)
    const root = screen.getByTestId('radio-group-root')
    expect(root).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<RadioGroup ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current).toHaveAttribute('data-testid', 'radio-group-root')
  })

  it('renders children', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="1" />
        <RadioGroupItem value="2" />
      </RadioGroup>
    )
    const items = screen.getAllByTestId('radio-group-item')
    expect(items).toHaveLength(2)
  })
})

describe('RadioGroupItem', () => {
  it('renders radio group item', () => {
    render(<RadioGroupItem value="test" />)
    const item = screen.getByTestId('radio-group-item')
    expect(item).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<RadioGroupItem className="item-class" value="test" />)
    const item = screen.getByTestId('radio-group-item')
    expect(item).toHaveClass('item-class')
  })

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<RadioGroupItem ref={ref} value="test" />)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current).toHaveAttribute('data-testid', 'radio-group-item')
  })

  it('renders indicator with circle icon', () => {
    render(<RadioGroupItem value="test" />)
    const indicator = screen.getByTestId('radio-group-indicator')
    expect(indicator).toBeInTheDocument()
    const icon = screen.getByTestId('circle-icon')
    expect(icon).toBeInTheDocument()
  })

  it('handles click event', () => {
    const onClick = vi.fn()
    render(<RadioGroupItem onClick={onClick} value="test" />)
    const item = screen.getByTestId('radio-group-item')
    fireEvent.click(item)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<RadioGroupItem disabled value="test" />)
    const item = screen.getByTestId('radio-group-item')
    expect(item).toHaveAttribute('disabled')
  })
})