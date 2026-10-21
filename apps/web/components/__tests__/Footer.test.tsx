import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import Footer from '../Footer'

describe('Footer', () => {
  it('shows Spanish Telegram link when lang="es"', () => {
    render(<Footer lang="es" />)
    expect(screen.getByText('Grupo en Telegram')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Grupo en Telegram' }),
    ).toHaveAttribute('href', 'https://t.me/learn_t_g')
  })

  it('shows English Telegram link when lang="en"', () => {
    render(<Footer lang="en" />)
    expect(screen.getByText('Telegram group')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Telegram group' }),
    ).toHaveAttribute('href', 'https://t.me/learn_t_g')
  })

  it('renders all social icons and links', () => {
    render(<Footer />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('https://twitter.com/pasosdeJesus')
    expect(hrefs).toContain('https://gitlab.com/pasosdeJesus/')
    expect(hrefs).toContain('https://github.com/pasosdeJesus')
  })
})
