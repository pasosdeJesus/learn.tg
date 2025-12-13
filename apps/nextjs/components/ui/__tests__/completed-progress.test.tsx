'use client'

import { render, screen } from '@testing-library/react'
import { CompletedProgress } from '@/components/ui/completed-progress'
import { describe, it, expect } from 'vitest'

describe('CompletedProgress', () => {
  it('renders the percentage when progress is less than 100', () => {
    render(<CompletedProgress percentageCompleted={50} percentagePaid={10} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('renders the checkmark when progress is 100', () => {
    render(<CompletedProgress percentageCompleted={100} percentagePaid={50} />)
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument()
  })

  it('renders the checkmark when progress is greater than 100', () => {
    render(<CompletedProgress percentageCompleted={110} percentagePaid={100} />)
    expect(screen.queryByText('110%')).not.toBeInTheDocument()
    expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument()
  })

  it('displays the Spanish label for "Progress"', () => {
    render(
      <CompletedProgress percentageCompleted={30} percentagePaid={0} lang="es" />,
    )
    expect(screen.getByText('Avance')).toBeInTheDocument()
  })

  it('displays the English label for "Progress" by default', () => {
    render(<CompletedProgress percentageCompleted={30} percentagePaid={10} />)
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('does not render the percentage text when completed', () => {
    render(<CompletedProgress percentageCompleted={100} percentagePaid={80} />)
    expect(screen.queryByText('%')).toBeNull()
  })

  it('shows a tooltip with the paid percentage', () => {
    const { container } = render(
      <CompletedProgress percentageCompleted={70} percentagePaid={35} />,
    )
    const tooltipElement = container.firstChild as HTMLElement
    expect(tooltipElement).toHaveAttribute(
      'title',
      '35% paid of completed',
    )
  })
})

