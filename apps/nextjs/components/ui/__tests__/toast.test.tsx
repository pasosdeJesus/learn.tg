import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
// Import radix mocks to ensure they're registered before component imports
import '@pasosdejesus/m/test-utils/radix-mocks'
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from '@/components/ui/toast'

describe('Toast', () => {
  it('renders toast with title and description', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Toast Title</ToastTitle>
          <ToastDescription>Toast description text.</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    // With Radix mocks, toast content may be rendered
    expect(screen.getByText('Toast Title')).toBeInTheDocument()
    expect(screen.getByText('Toast description text.')).toBeInTheDocument()
  })

  it('renders toast with action button', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Title</ToastTitle>
          <ToastAction altText="Action">Action</ToastAction>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
    const action = screen.getByText('Action')
    expect(action.tagName).toBe('BUTTON')
  })

  it('renders toast close button', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Title</ToastTitle>
          <ToastClose>Close</ToastClose>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    // Close button is rendered with data-testid
    const close = screen.getByTestId('toast-close')
    expect(close).toBeInTheDocument()
  })

  it('applies custom className to Toast', () => {
    render(
      <ToastProvider>
        <Toast className="custom-toast">
          <ToastTitle>Title</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    const toast = screen.getByTestId('toast-root')
    expect(toast).toHaveClass('custom-toast')
  })

  it('applies custom className to ToastTitle', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle className="custom-title">Title</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    const title = screen.getByTestId('toast-title')
    expect(title).toHaveClass('custom-title')
  })

  it('applies custom className to ToastDescription', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Title</ToastTitle>
          <ToastDescription className="custom-description">
            Description
          </ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    const description = screen.getByTestId('toast-description')
    expect(description).toHaveClass('custom-description')
  })

  it('renders toast with destructive variant', () => {
    render(
      <ToastProvider>
        <Toast variant="destructive">
          <ToastTitle>Destructive Toast</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    const toast = screen.getByTestId('toast-root')
    // Variant may affect classes, but we can at least verify it renders
    expect(toast).toBeInTheDocument()
  })

  it('toast viewport renders', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Title</ToastTitle>
        </Toast>
        <ToastViewport data-testid="viewport" />
      </ToastProvider>
    )

    const viewport = screen.getByTestId('viewport')
    expect(viewport).toBeInTheDocument()
  })
})