import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CourseStatistics } from '../CourseStatistics'
import React from 'react'

describe('CourseStatistics', () => {
  const defaultProps = {
    lang: 'en',
    full: false,
    address: '0x123',
    totalGuides: 10,
    scholarshipPerGuide: 1,
    profileScore: 68,
    canSubmit: true,
    completedGuides: 0,
    paidGuides: 0,
    percentagePaid: 0,
    percentageCompleted: 0,
    scholarshipPaid: 0,
  }

  it('calculates scholarship correctly for profile score 68 and base 1 USDT', () => {
    render(<CourseStatistics {...defaultProps} />)
    
    // The bug: (1 * 100) / 68 = 1.47
    // The fix: (1 * 68) / 100 = 0.68
    expect(screen.getByText(/Scholarship of 0.68 USDT per guide/i)).toBeInTheDocument()
  })

  it('calculates scholarship correctly for profile score 100 and base 1 USDT', () => {
    render(<CourseStatistics {...defaultProps} profileScore={100} />)
    expect(screen.getByText(/Scholarship of 1.00 USDT per guide/i)).toBeInTheDocument()
  })

  it('calculates scholarship correctly for profile score 50 and base 1 USDT', () => {
    render(<CourseStatistics {...defaultProps} profileScore={50} />)
    expect(screen.getByText(/Scholarship of 0.50 USDT per guide/i)).toBeInTheDocument()
  })

  it('shows base scholarship when not logged in (no address)', () => {
    render(<CourseStatistics {...defaultProps} address={undefined} scholarshipPerGuide={5} />)
    expect(screen.getByText(/Scholarship of up to 5 USDT/i)).toBeInTheDocument()
  })
})
