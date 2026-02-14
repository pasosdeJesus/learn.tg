import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
// Import radix mocks to ensure they're registered before component imports
import '@/test-utils/radix-mocks'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

describe('Tooltip', () => {
  it('renders tooltip with trigger and content', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    expect(screen.getByText('Hover me')).toBeInTheDocument()
    // Tooltip content may be hidden initially (Radix behavior)
    // With mocks, content might be rendered
    expect(screen.getByText('Tooltip content')).toBeInTheDocument()
  })

  it('tooltip trigger is a button', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    const trigger = screen.getByText('Trigger')
    expect(trigger.tagName).toBe('BUTTON')
  })

  it('applies custom className to TooltipContent', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent className="custom-content">
            Content
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    const content = screen.getByTestId('tooltip-content')
    expect(content).toHaveClass('custom-content')
  })

  it('tooltip provider renders', () => {
    const { container } = render(
      <TooltipProvider>
        <div>Child</div>
      </TooltipProvider>
    )

    expect(container).toBeInTheDocument()
  })

  it('tooltip content can have sideOffset prop', () => {
    // sideOffset is passed to TooltipPrimitive.Content
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent sideOffset={10}>
            Content
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    const content = screen.getByTestId('tooltip-content')
    expect(content).toBeInTheDocument()
  })

  it('tooltip trigger can be disabled', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger disabled>Trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    const trigger = screen.getByText('Trigger')
    expect(trigger).toBeDisabled()
  })
})