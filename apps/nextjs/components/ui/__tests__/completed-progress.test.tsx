'use client'

import { render, screen } from '@testing-library/react'
import { CompletedProgress } from '@/components/ui/completed-progress'
import { describe, it, expect } from 'vitest'

describe('CompletedProgress', () => {
  it('renders the percentage when progress is less than 100', () => {
    render(<CompletedProgress progress={50} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders the checkmark when progress is 100', () => {
    render(<CompletedProgress progress={100} />)
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument()
  })

  it('renders the checkmark when progress is greater than 100', () => {
    render(<CompletedProgress progress={110} />)
    expect(screen.queryByText('110%')).not.toBeInTheDocument()
    expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument()
  })

  it('displays the Spanish label for "Completed"', () => {
    render(<CompletedProgress progress={30} lang="es" />)
    expect(screen.getByText('Completado')).toBeInTheDocument()
  })

  it('displays the English label for "Completed" by default', () => {
    render(<CompletedProgress progress={30} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('does not render the percentage text when completed', () => {
    render(<CompletedProgress progress={100} />)
    expect(screen.queryByText('%')).toBeNull()
  })
})

