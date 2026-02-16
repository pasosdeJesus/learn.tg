/**
 * Radix UI mocks for testing
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import React from 'react'
import { vi } from 'vitest'

// Mock ResizeObserver globally
if (typeof global !== 'undefined' && !global.ResizeObserver) {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}

/**
 * Mock for @radix-ui/react-portal
 * Renders children directly instead of in a portal
 */
export const portalMock = {
  Portal: ({ children }: { children: React.ReactNode }) => children,
  Root: ({ children }: { children: React.ReactNode }) => children,
}

/**
 * Mock for @radix-ui/react-menubar
 * Provides simplified components that render without complex context
 */
export const menubarMock = {
  Root: React.forwardRef(function Root({ className, ...props }: any, ref: any) {
    return React.createElement('div', { ref, 'data-testid': 'menubar-root', className, ...props })
  }),
  Menu: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="menubar-menu" className={className} {...props} />
  )),
  Trigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="menubar-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  Content: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="menubar-content" className={className} {...props} />
  )),
  Item: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="menubar-item" className={className} {...props}>
      {props.children}
    </button>
  )),
  Separator: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="menubar-separator" className={className} {...props} />
  )),
  Label: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="menubar-label" className={className} {...props}>
      {props.children}
    </div>
  )),
  CheckboxItem: React.forwardRef(({ className, checked, ...props }: any, ref: any) => (
    <button
      ref={ref}
      data-testid="menubar-checkbox-item"
      data-checked={checked}
      className={className}
      {...props}
    >
      {props.children}
    </button>
  )),
  RadioGroup: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="menubar-radio-group" className={className} {...props} />
  )),
  RadioItem: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="menubar-radio-item" className={className} {...props}>
      {props.children}
    </button>
  )),
  Group: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="menubar-group" className={className} {...props} />
  )),
  ItemIndicator: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <span ref={ref} data-testid="menubar-item-indicator" className={className} {...props} />
  )),
  Sub: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="menubar-sub" className={className} {...props} />
  )),
  SubTrigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="menubar-sub-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  SubContent: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="menubar-sub-content" className={className} {...props} />
  )),
  Shortcut: ({ className, ...props }: any) => (
    <span data-testid="menubar-shortcut" className={className} {...props} />
  ),
  Portal: portalMock.Portal,
}

/**
 * Mock for @radix-ui/react-popover
 */
export const popoverMock = {
  Root: React.forwardRef(({ className, defaultOpen = false, ...props }: any, ref: any) => (
    <div
      ref={ref}
      data-testid="popover-root"
      data-state={defaultOpen ? 'open' : 'closed'}
      className={className}
      {...props}
    />
  )),
  Trigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="popover-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  Content: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="popover-content" className={className} {...props} />
  )),
  Portal: portalMock.Portal,
}

/**
 * Mock for @radix-ui/react-dropdown-menu
 */
export const dropdownMenuMock = {
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-menu-root" className={className} {...props} />
  )),
  Trigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="dropdown-menu-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  Content: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-menu-content" className={className} {...props} />
  )),
  Item: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="dropdown-menu-item" className={className} {...props}>
      {props.children}
    </button>
  )),
  Separator: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-menu-separator" className={className} {...props} />
  )),
  Label: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-menu-label" className={className} {...props}>
      {props.children}
    </div>
  )),
  CheckboxItem: React.forwardRef(({ className, checked, ...props }: any, ref: any) => (
    <button
      ref={ref}
      data-testid="dropdown-menu-checkbox-item"
      data-checked={checked}
      className={className}
      {...props}
    >
      {props.children}
    </button>
  )),
  RadioGroup: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-menu-radio-group" className={className} {...props} />
  )),
  RadioItem: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="dropdown-menu-radio-item" className={className} {...props}>
      {props.children}
    </button>
  )),
  Sub: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-menu-sub" className={className} {...props} />
  )),
  SubTrigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="dropdown-menu-sub-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  SubContent: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dropdown-menu-sub-content" className={className} {...props} />
  )),
  Shortcut: ({ className, ...props }: any) => (
    <span data-testid="dropdown-menu-shortcut" className={className} {...props} />
  ),
}

/**
 * Mock for @radix-ui/react-dialog (used by sheet, alert-dialog)
 */
export const dialogMock = {
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dialog-root" className={className} {...props} />
  )),
  Trigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="dialog-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  Content: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dialog-content" className={className} {...props} />
  )),
  Overlay: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dialog-overlay" className={className} {...props} />
  )),
  Title: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dialog-title" className={className} {...props}>
      {props.children}
    </div>
  )),
  Description: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dialog-description" className={className} {...props}>
      {props.children}
    </div>
  )),
  Close: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="dialog-close" className={className} {...props}>
      {props.children}
    </button>
  )),
}

/**
 * Mock for @radix-ui/react-toast
 */
export const toastMock = {
  Provider: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="toast-provider" className={className} {...props} />
  )),
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="toast-root" className={className} {...props} />
  )),
  Title: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="toast-title" className={className} {...props}>
      {props.children}
    </div>
  )),
  Description: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="toast-description" className={className} {...props}>
      {props.children}
    </div>
  )),
  Action: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="toast-action" className={className} {...props}>
      {props.children}
    </button>
  )),
  Close: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="toast-close" className={className} {...props}>
      {props.children}
    </button>
  )),
  Viewport: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="toast-viewport" className={className} {...props} />
  )),
}

/**
 * Mock for @radix-ui/react-tooltip
 */
export const tooltipMock = {
  Provider: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="tooltip-provider" className={className} {...props} />
  )),
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="tooltip-root" className={className} {...props} />
  )),
  Trigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="tooltip-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  Content: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="tooltip-content" className={className} {...props} />
  )),
  Arrow: ({ className, ...props }: any) => (
    <div data-testid="tooltip-arrow" className={className} {...props} />
  ),
}

/**
 * Common Radix UI component mocks
 */
export const commonRadixMocks = {
  Slot: ({ children, ...props }: any) => React.cloneElement(React.Children.only(children), props),
  Label: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <label ref={ref} data-testid="radix-label" className={className} {...props} />
  )),
  Separator: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="radix-separator" className={className} {...props} />
  )),
}

// Radix UI mocks configuration
vi.mock('@radix-ui/react-portal', () => portalMock)
vi.mock('@radix-ui/react-menubar', () => menubarMock)
vi.mock('@radix-ui/react-popover', () => popoverMock)
vi.mock('@radix-ui/react-dropdown-menu', () => dropdownMenuMock)
vi.mock('@radix-ui/react-dialog', () => dialogMock)
vi.mock('@radix-ui/react-toast', () => toastMock)
vi.mock('@radix-ui/react-tooltip', () => tooltipMock)
vi.mock('@radix-ui/react-slot', () => ({ Slot: commonRadixMocks.Slot }))
vi.mock('@radix-ui/react-label', () => ({ Root: commonRadixMocks.Label }))
vi.mock('@radix-ui/react-separator', () => ({ Root: commonRadixMocks.Separator }))

// Additional common Radix UI packages
vi.mock('@radix-ui/react-accordion', () => ({
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="accordion-root" className={className} {...props} />
  )),
  Item: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="accordion-item" className={className} {...props} />
  )),
  Trigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="accordion-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  Content: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="accordion-content" className={className} {...props} />
  )),
}))

vi.mock('@radix-ui/react-scroll-area', () => ({
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="scroll-area-root" className={className} {...props} />
  )),
  Viewport: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="scroll-area-viewport" className={className} {...props} />
  )),
  Scrollbar: React.forwardRef(({ className, orientation = 'vertical', ...props }: any, ref: any) => (
    <div
      ref={ref}
      data-testid="scroll-area-scrollbar"
      data-orientation={orientation}
      className={className}
      {...props}
    />
  )),
  Thumb: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="scroll-area-thumb" className={className} {...props} />
  )),
  ScrollAreaScrollbar: React.forwardRef(({ className, orientation = 'vertical', ...props }: any, ref: any) => (
    <div
      ref={ref}
      data-testid="scroll-area-scrollbar"
      data-orientation={orientation}
      className={className}
      {...props}
    />
  )),
  Corner: ({ className, ...props }: any) => (
    <div data-testid="scroll-area-corner" className={className} {...props} />
  ),
  ScrollAreaThumb: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="scroll-area-thumb" className={className} {...props} />
  )),
  ScrollAreaViewport: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="scroll-area-viewport" className={className} {...props} />
  )),
  ScrollAreaCorner: ({ className, ...props }: any) => (
    <div data-testid="scroll-area-corner" className={className} {...props} />
  ),
  ScrollAreaRoot: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="scroll-area-root" className={className} {...props} />
  )),
}))

vi.mock('@radix-ui/react-tabs', () => ({
  Root: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="tabs-root" className={className} {...props} />
  )),
  List: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="tabs-list" className={className} {...props} />
  )),
  Trigger: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <button ref={ref} data-testid="tabs-trigger" className={className} {...props}>
      {props.children}
    </button>
  )),
  Content: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="tabs-content" className={className} {...props} />
  )),
}))

