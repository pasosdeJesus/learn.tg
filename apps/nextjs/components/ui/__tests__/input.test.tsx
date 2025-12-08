import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { Input } from '@/components/ui/input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('applies custom className', () => {
    const { container } = render(<Input className="custom-class" />)
    const input = container.firstChild
    expect(input).toHaveClass('custom-class')
  })

  it('handles type prop', () => {
    const { container } = render(<Input type="password" />)
    const input = container.firstChild
    expect(input).toHaveAttribute('type', 'password')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled />)
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('shows placeholder', () => {
    render(<Input placeholder="Enter text" />)
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
  })

  it('handles onChange event', () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('passes additional props to input', () => {
    render(<Input data-testid="my-input" aria-label="Test input" />)
    const input = screen.getByTestId('my-input')
    expect(input).toHaveAttribute('aria-label', 'Test input')
  })
})