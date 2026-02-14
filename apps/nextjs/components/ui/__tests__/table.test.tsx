import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table'

describe('Table', () => {
  it('renders a basic table', () => {
    render(
      <Table>
        <TableCaption>Test Caption</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Header 1</TableHead>
            <TableHead>Header 2</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Cell 1</TableCell>
            <TableCell>Cell 2</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    expect(screen.getByText('Test Caption')).toBeInTheDocument()
    expect(screen.getByText('Header 1')).toBeInTheDocument()
    expect(screen.getByText('Header 2')).toBeInTheDocument()
    expect(screen.getByText('Cell 1')).toBeInTheDocument()
    expect(screen.getByText('Cell 2')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('applies custom className to table', () => {
    const { container } = render(
      <Table className="custom-table">
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    const table = container.querySelector('table')
    expect(table).toHaveClass('custom-table')
  })

  it('renders table header with proper styling', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="custom-head">Head</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    )

    const head = screen.getByText('Head')
    expect(head).toBeInTheDocument()
    expect(head.tagName).toBe('TH')
  })

  it('renders table body with rows', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Row 1 Cell</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Row 2 Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(screen.getByText('Row 1 Cell')).toBeInTheDocument()
    expect(screen.getByText('Row 2 Cell')).toBeInTheDocument()
  })

  it('renders table footer', () => {
    render(
      <Table>
        <TableFooter>
          <TableRow>
            <TableCell>Footer Cell</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    expect(screen.getByText('Footer Cell')).toBeInTheDocument()
    const footer = screen.getByText('Footer Cell').closest('tfoot')
    expect(footer).toBeInTheDocument()
  })

  it('table row accepts custom className', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow className="highlighted">
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    const row = container.querySelector('tr')
    expect(row).toHaveClass('highlighted')
  })

  it('table cell accepts custom className', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="custom-cell">Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    const cell = container.querySelector('td')
    expect(cell).toHaveClass('custom-cell')
  })
})