import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock @radix-ui/react-dropdown-menu
vi.mock('@radix-ui/react-dropdown-menu', () => ({
  Root: ({ children }: any) => <div data-testid="dropdown-root">{children}</div>,
  Trigger: React.forwardRef(({ className, children, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-trigger" className={className} {...props}>
      {children}
    </div>
  )),
  Content: React.forwardRef(({ className, children, sideOffset, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-content" className={className} {...props}>
      {children}
    </div>
  )),
  Item: React.forwardRef(({ className, children, inset, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-item" className={className} {...props}>
      {children}
    </div>
  )),
  CheckboxItem: React.forwardRef(({ className, children, checked, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-checkbox-item" className={className} {...props}>
      <span data-testid="dropdown-checkbox-indicator">{checked ? '✓' : ''}</span>
      {children}
    </div>
  )),
  RadioItem: React.forwardRef(({ className, children, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-radio-item" className={className} {...props}>
      <span data-testid="dropdown-radio-indicator">○</span>
      {children}
    </div>
  )),
  Label: React.forwardRef(({ className, children, inset, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-label" className={className} {...props}>
      {children}
    </div>
  )),
  Separator: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-separator" className={className} {...props} />
  )),
  Group: ({ children }: any) => <div data-testid="dropdown-group">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="dropdown-portal">{children}</div>,
  Sub: ({ children }: any) => <div data-testid="dropdown-sub">{children}</div>,
  SubContent: React.forwardRef(({ className, children, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-sub-content" className={className} {...props}>
      {children}
    </div>
  )),
  SubTrigger: React.forwardRef(({ className, children, inset, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-sub-trigger" className={className} {...props}>
      {children}
      <span data-testid="dropdown-sub-trigger-chevron">▶</span>
    </div>
  )),
  RadioGroup: ({ children }: any) => <div data-testid="dropdown-radio-group">{children}</div>,
  ItemIndicator: ({ children }: any) => <div data-testid="dropdown-item-indicator">{children}</div>,
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: ({ className }: any) => <div data-testid="check-icon" className={className}>✓</div>,
  ChevronRight: ({ className }: any) => <div data-testid="chevron-right-icon" className={className}>▶</div>,
  Circle: ({ className }: any) => <div data-testid="circle-icon" className={className}>○</div>,
}))

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from '@/components/ui/dropdown-menu'

describe('DropdownMenu components', () => {
  it('renders DropdownMenuTrigger with children', () => {
    render(<DropdownMenuTrigger className="test-class">Trigger text</DropdownMenuTrigger>)
    const trigger = screen.getByTestId('dropdown-trigger')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveClass('test-class')
    expect(trigger).toHaveTextContent('Trigger text')
  })

  it('renders DropdownMenuItem with children', () => {
    render(<DropdownMenuItem className="item-class">Item 1</DropdownMenuItem>)
    const item = screen.getByTestId('dropdown-item')
    expect(item).toBeInTheDocument()
    expect(item).toHaveClass('item-class')
    expect(item).toHaveTextContent('Item 1')
  })

  it('renders DropdownMenuCheckboxItem with children', () => {
    render(<DropdownMenuCheckboxItem className="checkbox-class" checked={true}>
      Checkbox Item
    </DropdownMenuCheckboxItem>)
    const checkboxItem = screen.getByTestId('dropdown-checkbox-item')
    expect(checkboxItem).toBeInTheDocument()
    expect(checkboxItem).toHaveClass('checkbox-class')
    expect(checkboxItem).toHaveTextContent('Checkbox Item')
    const indicator = screen.getByTestId('dropdown-checkbox-indicator')
    expect(indicator).toHaveTextContent('✓')
  })

  it('renders DropdownMenuRadioItem with children', () => {
    render(<DropdownMenuRadioItem className="radio-class">Radio Item</DropdownMenuRadioItem>)
    const radioItem = screen.getByTestId('dropdown-radio-item')
    expect(radioItem).toBeInTheDocument()
    expect(radioItem).toHaveClass('radio-class')
    expect(radioItem).toHaveTextContent('Radio Item')
    const indicator = screen.getByTestId('dropdown-radio-indicator')
    expect(indicator).toHaveTextContent('○')
  })

  it('renders DropdownMenuLabel', () => {
    render(<DropdownMenuLabel className="label-class">Label</DropdownMenuLabel>)
    const label = screen.getByTestId('dropdown-label')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass('label-class')
  })

  it('renders DropdownMenuSeparator', () => {
    render(<DropdownMenuSeparator className="separator-class" />)
    const separator = screen.getByTestId('dropdown-separator')
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveClass('separator-class')
  })

  it('renders DropdownMenuShortcut', () => {
    render(<DropdownMenuShortcut className="shortcut-class">Ctrl+S</DropdownMenuShortcut>)
    const shortcut = screen.getByText('Ctrl+S')
    expect(shortcut).toBeInTheDocument()
    expect(shortcut).toHaveClass('shortcut-class')
  })

  it('renders DropdownMenuGroup and DropdownMenuContent', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.getByTestId('dropdown-root')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-group')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-item')).toBeInTheDocument()
  })

  it('renders DropdownMenuSub components', () => {
    render(
      <DropdownMenu>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Sub Trigger</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>Sub Content</DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenu>
    )
    expect(screen.getByTestId('dropdown-sub')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-sub-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-sub-content')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-sub-trigger-chevron')).toBeInTheDocument()
  })

  it('renders DropdownMenuRadioGroup', () => {
    render(
      <DropdownMenuRadioGroup>
        <DropdownMenuRadioItem value="1">Option 1</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    )
    expect(screen.getByTestId('dropdown-radio-group')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-radio-item')).toBeInTheDocument()
  })
})