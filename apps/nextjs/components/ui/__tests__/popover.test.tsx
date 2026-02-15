import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { popoverMock } from '@/test-utils/common/radix-mocks'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'


describe('Popover', () => {
  it('renders Popover with children', () => {
    render(
      <Popover>
        <div>Popover child</div>
      </Popover>
    )

    expect(screen.getByText('Popover child')).toBeInTheDocument()
  })

  it('renders PopoverTrigger with text', () => {
    render(
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
      </Popover>
    )

    const trigger = screen.getByText('Open popover')
    expect(trigger).toBeInTheDocument()
  })

  it('renders PopoverContent with children when popover is open', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>
          <div>Popover content</div>
        </PopoverContent>
      </Popover>
    )

    // Content should be rendered (portal mock)
    expect(screen.getByText('Popover content')).toBeInTheDocument()
  })

  it('applies custom className to PopoverContent when open', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent className="custom-class">
          Content
        </PopoverContent>
      </Popover>
    )

    // Find the element with custom-class
    const content = document.querySelector('.custom-class')
    expect(content).toBeInTheDocument()
  })
})