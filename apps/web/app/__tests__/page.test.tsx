import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Home from '../page'
import React from 'react'

describe('Home page', () => {
  it('should render without errors', () => {
    expect(() => {
      render(<Home />)
    }).not.toThrow()
  })

  it('should display the main heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /Learn Through Games/i })).toBeInTheDocument()
  })

  it('should display the subtitle', () => {
    render(<Home />)
    expect(screen.getByText(/Blockchain-powered education with real rewards/i)).toBeInTheDocument()
  })

  it('should display language selection section', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /Choose Your Language/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /English/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Español/i })).toBeInTheDocument()
  })

  it('should have English link pointing to /en', () => {
    render(<Home />)
    const englishLink = screen.getByRole('link', { name: /English/i })
    expect(englishLink).toHaveAttribute('href', '/en')
  })

  it('should have Spanish link pointing to /es', () => {
    render(<Home />)
    const spanishLink = screen.getByRole('link', { name: /Español/i })
    expect(spanishLink).toHaveAttribute('href', '/es')
  })

  it('should display key features', () => {
    render(<Home />)
    expect(screen.getByText(/Interactive Courses/i)).toBeInTheDocument()
    expect(screen.getByText(/Earn Rewards/i)).toBeInTheDocument()
    expect(screen.getByText(/Blockchain Secured/i)).toBeInTheDocument()
  })
})