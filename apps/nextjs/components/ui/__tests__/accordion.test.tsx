import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

describe('Accordion', () => {
  it('renders accordion with items', () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Trigger 2</AccordionTrigger>
          <AccordionContent>Content 2</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    expect(screen.getByText('Trigger 1')).toBeInTheDocument()
    expect(screen.getByText('Trigger 2')).toBeInTheDocument()

    // Accordion content regions should be present but hidden
    const regions = screen.getAllByRole('region', { hidden: true })
    expect(regions).toHaveLength(2)
    regions.forEach(region => {
      expect(region).toHaveAttribute('data-state', 'closed')
      expect(region).toHaveAttribute('hidden')
    })
  })

  it('accordion trigger has button role', () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByRole('button')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('Trigger')
  })

  it('accordion content is initially hidden', () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    // The content should be present but hidden (Radix uses data-state)
    const content = container.querySelector('[data-state="closed"]')
    expect(content).toBeInTheDocument()
  })
})