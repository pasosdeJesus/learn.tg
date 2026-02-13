import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock @radix-ui/react-avatar
vi.mock('@radix-ui/react-avatar', () => ({
  Root: React.forwardRef(({ className, children, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="avatar-root" className={className} {...props}>
      {children}
    </div>
  )),
  Image: React.forwardRef(({ src, alt, className, ...props }: any, ref: any) => (
    <img
      ref={ref}
      data-testid="avatar-image"
      src={src}
      alt={alt}
      className={className}
      {...props}
    />
  )),
  Fallback: React.forwardRef(({ className, children, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="avatar-fallback" className={className} {...props}>
      {children}
    </div>
  )),
}))

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

describe('Avatar', () => {
  it('renders avatar root', () => {
    render(<Avatar>Avatar</Avatar>)
    const avatar = screen.getByTestId('avatar-root')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveTextContent('Avatar')
  })

  it('renders avatar with image', () => {
    render(
      <Avatar>
        <AvatarImage src="/test.jpg" alt="Test Avatar" />
      </Avatar>
    )
    const image = screen.getByTestId('avatar-image')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', '/test.jpg')
    expect(image).toHaveAttribute('alt', 'Test Avatar')
  })

  it('renders avatar with fallback', () => {
    render(
      <Avatar>
        <AvatarFallback>FB</AvatarFallback>
      </Avatar>
    )
    const fallback = screen.getByTestId('avatar-fallback')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveTextContent('FB')
  })

  it('renders avatar with image and fallback', () => {
    render(
      <Avatar>
        <AvatarImage src="/test.jpg" alt="Test Avatar" />
        <AvatarFallback>FB</AvatarFallback>
      </Avatar>
    )
    const image = screen.getByTestId('avatar-image')
    const fallback = screen.getByTestId('avatar-fallback')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', '/test.jpg')
    expect(image).toHaveAttribute('alt', 'Test Avatar')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveTextContent('FB')
  })
})