import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import { CourseProgressCircles } from '../CourseProgressCircles'

const props = {
  lang: 'en',
  totalGuides: 4,
  completedGuides: 0,
  paidGuidesUSDT: 0,
  paidGuidesSLEARN: 0,
  vaultBalance: null as number | null,
  vaultBalanceSlearn: null as number | null,
  amountPerGuide: null as number | null,
  amountPerGuideSlearn: null as number | null,
}

describe('CourseProgressCircles', () => {
  it('renders the three signals with their icons', () => {
    render(<CourseProgressCircles {...props} completedGuides={1} />)

    expect(screen.getByTestId('progress-circle-check')).toBeInTheDocument()
    expect(screen.getByTestId('progress-circle-usdt')).toBeInTheDocument()
    expect(screen.getByTestId('progress-circle-slearn')).toBeInTheDocument()

    expect(screen.getByTestId('progress-icon-check')).toBeInTheDocument()
    expect(screen.getByTestId('progress-icon-usdt')).toBeInTheDocument()
    expect(screen.getByTestId('progress-icon-slearn')).toBeInTheDocument()
  })

  it('draws one solid ring per signal (no partial arcs)', () => {
    render(
      <CourseProgressCircles
        {...props}
        completedGuides={2}
        paidGuidesUSDT={1}
        paidGuidesSLEARN={1}
        vaultBalance={4}
        vaultBalanceSlearn={4}
        amountPerGuide={1}
        amountPerGuideSlearn={1}
      />,
    )

    expect(screen.getByTestId('progress-ring-check')).toBeInTheDocument()
    expect(screen.getByTestId('progress-ring-usdt')).toBeInTheDocument()
    expect(screen.getByTestId('progress-ring-slearn')).toBeInTheDocument()

    expect(screen.queryByTestId('progress-arc-check')).toBeNull()
    expect(screen.queryByTestId('progress-arc-usdt')).toBeNull()
    expect(screen.queryByTestId('progress-arc-slearn')).toBeNull()
  })

  it('colours the check circle green at 100% and yellow otherwise', () => {
    const { rerender } = render(<CourseProgressCircles {...props} completedGuides={2} />)
    expect(screen.getByTestId('progress-circle-check')).toHaveAttribute('data-color', 'yellow')

    rerender(<CourseProgressCircles {...props} completedGuides={4} />)
    expect(screen.getByTestId('progress-circle-check')).toHaveAttribute('data-color', 'green')
  })

  it('colours USDT yellow when the vault can pay and gray when it cannot', () => {
    const { rerender } = render(
      <CourseProgressCircles {...props} paidGuidesUSDT={1} vaultBalance={4} amountPerGuide={1} />,
    )
    expect(screen.getByTestId('progress-circle-usdt')).toHaveAttribute('data-color', 'yellow')

    rerender(
      <CourseProgressCircles {...props} paidGuidesUSDT={1} vaultBalance={0} amountPerGuide={1} />,
    )
    expect(screen.getByTestId('progress-circle-usdt')).toHaveAttribute('data-color', 'gray')
  })

  it('offline never shows yellow for USDT or SLEARN', () => {
    render(
      <CourseProgressCircles
        {...props}
        completedGuides={1}
        paidGuidesUSDT={1}
        paidGuidesSLEARN={1}
        vaultBalance={4}
        vaultBalanceSlearn={4}
        amountPerGuide={1}
        amountPerGuideSlearn={1}
        offline
      />,
    )

    expect(screen.getByTestId('progress-circle-check')).toHaveAttribute('data-color', 'yellow')
    expect(screen.getByTestId('progress-circle-usdt')).toHaveAttribute('data-color', 'gray')
    expect(screen.getByTestId('progress-circle-slearn')).toHaveAttribute('data-color', 'gray')
  })

  it('labels each circle for screen readers', () => {
    render(<CourseProgressCircles {...props} lang="es" completedGuides={1} />)
    expect(screen.getByTestId('progress-circle-check')).toHaveAccessibleName(
      '1 de 4 guías completadas',
    )
  })
})
