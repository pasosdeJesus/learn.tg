import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page'
import React from 'react'

describe('Privacy Policy page', () => {
  it('should render without errors', () => {
    expect(() => {
      render(<Page />)
    }).not.toThrow()
  })

  it('should display the main heading', () => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: /Privacy Policy/i })).toBeInTheDocument()
  })

  it('should display the privacy policy points', () => {
    render(<Page />)
    // Check for key phrases in the list items
    expect(screen.getByText(/We will not sell neither share the personal information you provide/i)).toBeInTheDocument()
    expect(screen.getByText(/To remove your personal information as presented by this app/i)).toBeInTheDocument()
    expect(screen.getByText(/We cannot remove from our internal records neither from logs your onchain transaction/i)).toBeInTheDocument()
  })

  it('should render as an unordered list', () => {
    render(<Page />)
    const list = screen.getByRole('list')
    expect(list).toBeInTheDocument()
    const listItems = screen.getAllByRole('listitem')
    expect(listItems.length).toBe(3)
  })
})