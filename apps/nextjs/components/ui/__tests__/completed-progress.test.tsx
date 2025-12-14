'use client'

import { render, screen } from '@testing-library/react'
import { CompletedProgress } from '@/components/ui/completed-progress'
import { describe, it, expect } from 'vitest'

const SIZE = 70
const STROKE_WIDTH = 7
const RADIUS = (SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

describe('CompletedProgress', () => {
  it('renders the percentage and labels for progress < 100%', () => {
    render(<CompletedProgress percentageCompleted={50} percentagePaid={10} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('renders with Spanish labels when lang="es" is provided', () => {
    render(
      <CompletedProgress percentageCompleted={30} percentagePaid={10} lang="es" />,
    )
    expect(screen.getByText('Avance')).toBeInTheDocument()
  })

  it('renders the checkmark icon when progress is >= 100%', () => {
    render(<CompletedProgress percentageCompleted={100} percentagePaid={50} />)
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument()
  })

  describe('SVG Arc Calculations', () => {
    it('should render only the gray background for 0% progress', () => {
      const { container } = render(
        <CompletedProgress percentageCompleted={0} percentagePaid={0} />,
      )
      const circles = container.querySelectorAll('circle')
      const yellowCircle = circles[1]
      const greenCircle = circles[2]

      expect(yellowCircle.getAttribute('stroke-dashoffset')).toBe(
        `${CIRCUMFERENCE}`,
      )
      expect(greenCircle.getAttribute('stroke-dashoffset')).toBe(
        `${CIRCUMFERENCE}`,
      )
    })

    it('should render 50% yellow and 50% gray for 50% completed and 0% paid', () => {
      const { container } = render(
        <CompletedProgress percentageCompleted={50} percentagePaid={0} />,
      )
      const circles = container.querySelectorAll('circle')
      const yellowCircle = circles[1]
      const greenCircle = circles[2]

      const expectedYellowOffset = CIRCUMFERENCE - (50 / 100) * CIRCUMFERENCE
      const expectedGreenOffset = CIRCUMFERENCE

      expect(yellowCircle.getAttribute('stroke-dashoffset')).toBe(
        `${expectedYellowOffset}`,
      )
      expect(greenCircle.getAttribute('stroke-dashoffset')).toBe(
        `${expectedGreenOffset}`,
      )
    })

    it('should render 25% green, 50% yellow, and 25% gray', () => {
      const { container } = render(
        <CompletedProgress percentageCompleted={75} percentagePaid={25} />,
      )
      const circles = container.querySelectorAll('circle')
      const yellowCircle = circles[1]
      const greenCircle = circles[2]

      const expectedYellowOffset = CIRCUMFERENCE - (75 / 100) * CIRCUMFERENCE
      const expectedGreenOffset = CIRCUMFERENCE - (25 / 100) * CIRCUMFERENCE

      expect(yellowCircle.getAttribute('stroke-dashoffset')).toBe(
        `${expectedYellowOffset}`,
      )
      expect(greenCircle.getAttribute('stroke-dashoffset')).toBe(
        `${expectedGreenOffset}`,
      )
    })

    it('should render 100% green when fully completed and paid', () => {
        render(
            <CompletedProgress percentageCompleted={100} percentagePaid={100} />,
        )
        expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument()
    })

    it('should clamp paid percentage to completed percentage if paid > completed', () => {
      const { container } = render(
        <CompletedProgress percentageCompleted={50} percentagePaid={80} />,
      )
      const circles = container.querySelectorAll('circle')
      const yellowCircle = circles[1]
      const greenCircle = circles[2]

      // Both should be at 50% as paid is clamped to completed
      const expectedOffset = CIRCUMFERENCE - (50 / 100) * CIRCUMFERENCE

      expect(yellowCircle.getAttribute('stroke-dashoffset')).toBe(
        `${expectedOffset}`,
      )
      expect(greenCircle.getAttribute('stroke-dashoffset')).toBe(
        `${expectedOffset}`,
      )
    })
  })
})

