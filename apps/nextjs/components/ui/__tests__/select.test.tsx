import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock @radix-ui/react-select
vi.mock('@radix-ui/react-select', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div data-testid="select-root">{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div data-testid="select-group">{children}</div>,
  Value: ({ children }: { children: React.ReactNode }) => <div data-testid="select-value">{children}</div>,
  Trigger: React.forwardRef(({ className, children, ...props }: { className: string, children: React.ReactNode }, ref: React.Ref<HTMLDivElement>) => {
    const Trigger = (
        <div ref={ref} data-testid="select-trigger" className={className} {...props}>
        {children}
        <div data-testid="select-icon">icon</div>
        </div>
    );
    Trigger.displayName = 'Trigger';
    return Trigger;
  }),
  Icon: ({ asChild, children }: { asChild: boolean, children: React.ReactNode }) => asChild ? children : <div data-testid="select-icon">{children}</div>,
  Portal: ({ children }: { children: React.ReactNode }) => <div data-testid="select-portal">{children}</div>,
  Content: React.forwardRef(({ className, children, ...props }: { className: string, children: React.ReactNode }, ref: React.Ref<HTMLDivElement>) => {
    const Content = (
        <div ref={ref} data-testid="select-content" className={className} {...props}>
        {children}
        </div>
    );
    Content.displayName = 'Content';
    return Content;
  }),
  Viewport: ({ className, children }: { className: string, children: React.ReactNode }) => <div data-testid="select-viewport" className={className}>{children}</div>,
  Label: React.forwardRef(({ className, ...props }: { className: string }, ref: React.Ref<HTMLDivElement>) => {
    const Label = (
        <div ref={ref} data-testid="select-label" className={className} {...props} />
    );
    Label.displayName = 'Label';
    return Label;
  }),
  Item: React.forwardRef(({ className, children, ...props }: { className: string, children: React.ReactNode }, ref: React.Ref<HTMLDivElement>) => {
    const Item = (
        <div ref={ref} data-testid="select-item" className={className} {...props}>
        {children}
        </div>
    );
    Item.displayName = 'Item';
    return Item;
  }),
  ItemIndicator: ({ children }: { children: React.ReactNode }) => <div data-testid="select-item-indicator">{children}</div>,
  ItemText: ({ children }: { children: React.ReactNode }) => <div data-testid="select-item-text">{children}</div>,
  Separator: React.forwardRef(({ className, ...props }: { className: string }, ref: React.Ref<HTMLDivElement>) => {
    const Separator = (
        <div ref={ref} data-testid="select-separator" className={className} {...props} />
    );
    Separator.displayName = 'Separator';
    return Separator;
  }),
  ScrollUpButton: React.forwardRef(({ className, ...props }: { className: string }, ref: React.Ref<HTMLDivElement>) => {
    const ScrollUpButton = (
        <div ref={ref} data-testid="select-scroll-up" className={className} {...props} />
    );
    ScrollUpButton.displayName = 'ScrollUpButton';
    return ScrollUpButton;
  }),
  ScrollDownButton: React.forwardRef(({ className, ...props }: { className: string }, ref: React.Ref<HTMLDivElement>) => {
    const ScrollDownButton = (
        <div ref={ref} data-testid="select-scroll-down" className={className} {...props} />
    );
    ScrollDownButton.displayName = 'ScrollDownButton';
    return ScrollDownButton;
  }),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: ({ className }: { className: string }) => <div data-testid="check-icon" className={className}>✓</div>,
  ChevronDown: ({ className }: { className: string }) => <div data-testid="chevron-down-icon" className={className}>▼</div>,
  ChevronUp: ({ className }: { className: string }) => <div data-testid="chevron-up-icon" className={className}>▲</div>,
}))

import {
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from '@/components/ui/select'

describe('Select components', () => {
  it('renders SelectTrigger with children', () => {
    render(<SelectTrigger className="test-class">Trigger text</SelectTrigger>)
    const trigger = screen.getByTestId('select-trigger')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveClass('test-class')
    expect(trigger).toHaveTextContent('Trigger text')
  })

  it('renders SelectItem with children', () => {
    render(<SelectItem className="item-class" value="option1">Option 1</SelectItem>)
    const item = screen.getByTestId('select-item')
    expect(item).toBeInTheDocument()
    expect(item).toHaveClass('item-class')
    expect(item).toHaveTextContent('Option 1')
  })

  it('renders SelectLabel', () => {
    render(<SelectLabel className="label-class">Label</SelectLabel>)
    const label = screen.getByTestId('select-label')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass('label-class')
  })

  it('renders SelectSeparator', () => {
    render(<SelectSeparator className="separator-class" />)
    const separator = screen.getByTestId('select-separator')
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveClass('separator-class')
  })

  it('renders SelectScrollUpButton', () => {
    render(<SelectScrollUpButton className="up-class" />)
    const up = screen.getByTestId('select-scroll-up')
    expect(up).toBeInTheDocument()
    expect(up).toHaveClass('up-class')
  })

  it('renders SelectScrollDownButton', () => {
    render(<SelectScrollDownButton className="down-class" />)
    const down = screen.getByTestId('select-scroll-down')
    expect(down).toBeInTheDocument()
    expect(down).toHaveClass('down-class')
  })

  it('renders SelectGroup and SelectValue', () => {
    render(
      <SelectGroup data-testid="group">
        <SelectValue>Selected value</SelectValue>
      </SelectGroup>
    )
    const group = screen.getByTestId('select-group')
    const value = screen.getByTestId('select-value')
    expect(group).toBeInTheDocument()
    expect(value).toHaveTextContent('Selected value')
  })

  it('renders SelectContent with children', () => {
    render(
      <SelectContent className="content-class">
        <SelectItem value="item">Item</SelectItem>
      </SelectContent>
    )
    const content = screen.getByTestId('select-content')
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass('content-class')
    expect(screen.getByTestId('select-item')).toBeInTheDocument()
  })
})
