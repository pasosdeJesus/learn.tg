import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('applies custom className', () => {
    const { container } = render(<Textarea className="custom-class" />)
    const textarea = container.firstChild
    expect(textarea).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = React.createRef<HTMLTextAreaElement>()
    render(<Textarea ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('handles onChange event', () => {
    const onChange = vi.fn()
    render(<Textarea onChange={onChange} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Textarea disabled />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('shows placeholder', () => {
    render(<Textarea placeholder="Enter text here" />)
    const textarea = screen.getByPlaceholderText('Enter text here')
    expect(textarea).toBeInTheDocument()
  })

  it('passes additional props', () => {
    render(<Textarea rows={5} data-testid="my-textarea" />)
    const textarea = screen.getByTestId('my-textarea')
    expect(textarea).toHaveAttribute('rows', '5')
  })
})