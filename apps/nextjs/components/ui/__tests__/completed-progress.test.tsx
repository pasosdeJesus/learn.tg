'use client'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CompletedProgress } from '@/components/ui/completed-progress'

describe('CombinedCircularProgress', () => {
  it('renders the background and completed progress circles', () => {
    render(<CompletedProgress percentageCompleted={50} />)
    expect(screen.getByTestId('background-circle')).toBeInTheDocument()
    expect(screen.getByTestId('completed-circle')).toBeInTheDocument()
    expect(screen.queryByTestId('paid-circle')).not.toBeInTheDocument()
  })

  it('renders the paid progress circle when percentagePaid is greater than 0', () => {
    render(<CompletedProgress percentageCompleted={50} percentagePaid={25} />)
    expect(screen.getByTestId('background-circle')).toBeInTheDocument()
    expect(screen.getByTestId('completed-circle')).toBeInTheDocument()
    expect(screen.getByTestId('paid-circle')).toBeInTheDocument()
  })

  it('does not render the paid progress circle when percentagePaid is 0', () => {
    render(<CompletedProgress percentageCompleted={50} percentagePaid={0} />)
    expect(screen.getByTestId('background-circle')).toBeInTheDocument()
    expect(screen.getByTestId('completed-circle')).toBeInTheDocument()
    expect(screen.queryByTestId('paid-circle')).not.toBeInTheDocument()
  })

  it('displays the percentage and progress text when not completed', () => {
    render(<CompletedProgress percentageCompleted={80} />)
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('displays the checkmark icon when completed', () => {
    render(<CompletedProgress percentageCompleted={100} />)
    expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })

  it('displays text in Spanish when lang is set to es', () => {
    render(<CompletedProgress percentageCompleted={50} lang="es" />)
    expect(screen.getByText('Avance')).toBeInTheDocument()
  })
})
