import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import '@/test-utils/radix-mocks'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'


describe('ScrollArea', () => {
  it('renders ScrollArea with children', () => {
    render(
      <ScrollArea>
        <div>Scroll area content</div>
      </ScrollArea>
    )

    expect(screen.getByText('Scroll area content')).toBeInTheDocument()
  })

  it('applies custom className to ScrollArea', () => {
    const { container } = render(
      <ScrollArea className="custom-scroll-area">
        Content
      </ScrollArea>
    )

    const scrollArea = container.querySelector('.custom-scroll-area')
    expect(scrollArea).toBeInTheDocument()
  })

  it('renders ScrollBar with vertical orientation by default', () => {
    render(
      <ScrollArea>
        <ScrollBar />
      </ScrollArea>
    )

    const scrollbars = screen.getAllByTestId('scroll-area-scrollbar')
    // Should have at least one scrollbar (default one)
    expect(scrollbars.length).toBeGreaterThan(0)
    const scrollbar = scrollbars[0]
    expect(scrollbar).toHaveAttribute('data-orientation', 'vertical')
  })

  it('renders ScrollBar with horizontal orientation', () => {
    render(
      <ScrollArea>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    )

    const scrollbars = screen.getAllByTestId('scroll-area-scrollbar')
    // Find the horizontal scrollbar (should be the one with orientation="horizontal")
    const horizontalScrollbar = scrollbars.find(
      (element) => element.getAttribute('data-orientation') === 'horizontal'
    )
    expect(horizontalScrollbar).toBeDefined()
    expect(horizontalScrollbar).toHaveAttribute('data-orientation', 'horizontal')
  })

  it('applies custom className to ScrollBar', () => {
    const { container } = render(
      <ScrollArea>
        <ScrollBar className="custom-scrollbar" />
      </ScrollArea>
    )

    const scrollbars = screen.getAllByTestId('scroll-area-scrollbar')
    // Find the scrollbar with custom class (should be the one with className="custom-scrollbar")
    const customScrollbar = scrollbars.find((element) =>
      element.classList.contains('custom-scrollbar')
    )
    expect(customScrollbar).toBeDefined()
    expect(customScrollbar).toHaveClass('custom-scrollbar')
  })
})