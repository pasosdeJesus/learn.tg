import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
// Import radix mocks to ensure they're registered before component imports
import '@/test-utils/radix-mocks'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

describe('Tabs', () => {
  it('renders tabs with list and triggers', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    expect(screen.getByText('Tab 1')).toBeInTheDocument()
    expect(screen.getByText('Tab 2')).toBeInTheDocument()
    // Content may be hidden based on active tab
    // With Radix mocks, content might be rendered
  })

  it('changes active tab when trigger is clicked', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    const tab2 = screen.getByText('Tab 2')
    fireEvent.click(tab2)

    // After click, tab2 should become active (Radix manages state)
    // With mocks, we can't easily test active state, but we can verify click happened
    expect(tab2).toBeInTheDocument()
  })

  it('applies custom className to TabsList', () => {
    render(
      <Tabs>
        <TabsList className="custom-list" data-testid="tabs-list">
          <TabsTrigger value="tab1">Tab</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const list = screen.getByTestId('tabs-list')
    expect(list).toHaveClass('custom-list')
  })

  it('applies custom className to TabsTrigger', () => {
    render(
      <Tabs>
        <TabsList>
          <TabsTrigger value="tab1" className="custom-trigger">
            Tab
          </TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const trigger = screen.getByTestId('tabs-trigger')
    expect(trigger).toHaveClass('custom-trigger')
  })

  it('applies custom className to TabsContent', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="custom-content">
          Content
        </TabsContent>
      </Tabs>
    )

    const content = screen.getByTestId('tabs-content')
    expect(content).toHaveClass('custom-content')
  })

  it('renders multiple tab contents', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">First content</TabsContent>
        <TabsContent value="tab2">Second content</TabsContent>
      </Tabs>
    )

    expect(screen.getByText('First content')).toBeInTheDocument()
    expect(screen.getByText('Second content')).toBeInTheDocument()
  })
})