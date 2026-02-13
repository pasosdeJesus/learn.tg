import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

describe('Alert', () => {
  it('renders alert with default variant', () => {
    render(<Alert>Alert message</Alert>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Alert message')).toBeInTheDocument()
  })

  it('renders alert with destructive variant', () => {
    render(<Alert variant="destructive">Destructive alert</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveClass('border-destructive/50')
    expect(screen.getByText('Destructive alert')).toBeInTheDocument()
  })

  it('renders alert with title and description', () => {
    render(
      <Alert>
        <AlertTitle>Alert Title</AlertTitle>
        <AlertDescription>Alert description text.</AlertDescription>
      </Alert>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Alert Title')).toBeInTheDocument()
    expect(screen.getByText('Alert description text.')).toBeInTheDocument()
  })

  it('alert title is heading level 5', () => {
    render(
      <Alert>
        <AlertTitle>Title</AlertTitle>
      </Alert>
    )
    const title = screen.getByText('Title')
    expect(title.tagName).toBe('H5')
  })

  it('alert description is div', () => {
    render(
      <Alert>
        <AlertDescription>Description</AlertDescription>
      </Alert>
    )
    const desc = screen.getByText('Description')
    expect(desc.tagName).toBe('DIV')
  })
})