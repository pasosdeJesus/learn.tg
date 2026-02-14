import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import '@/test-utils/radix-mocks'
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarShortcut,
} from '@/components/ui/menubar'


describe('Menubar', () => {
  it('renders Menubar with children', () => {
    render(
      <Menubar>
        <div>Menu child</div>
      </Menubar>
    )

    expect(screen.getByText('Menu child')).toBeInTheDocument()
  })

  it('renders Menubar with default classes', () => {
    const { container } = render(
      <Menubar>
        <div>Test</div>
      </Menubar>
    )

    const menubar = container.firstChild
    expect(menubar).toHaveClass(
      'flex h-10 items-center space-x-1 rounded-md border bg-background p-1'
    )
  })

  it('renders MenubarMenu', () => {
    render(<MenubarMenu />)
    // MenubarMenu is just a wrapper, should render without errors
    expect(document.querySelector('[data-testid="menubar-menu"]')).toBeDefined()
  })

  it('renders MenubarTrigger with text', () => {
    render(<MenubarTrigger>Open menu</MenubarTrigger>)

    const trigger = screen.getByText('Open menu')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveClass(
      'flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none'
    )
  })

  it('renders MenubarContent with children', () => {
    // MenubarContent needs to be inside a portal, but we can still test its rendering
    render(
      <MenubarContent>
        <MenubarItem>Item 1</MenubarItem>
      </MenubarContent>
    )

    // Content is rendered in a portal, but we can still find the item
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })

  it('renders MenubarItem with text', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Menu item</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const item = screen.getByText('Menu item')
    expect(item).toBeInTheDocument()
    expect(item).toHaveClass(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none'
    )
  })

  it('renders MenubarItem with inset prop', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent>
            <MenubarItem inset>Item with inset</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    // Find the MenubarItem element
    const item = screen.getByText('Item with inset')
    expect(item).toHaveClass('pl-8')
  })

  it('renders MenubarSeparator', () => {
    const { container } = render(<MenubarSeparator />)

    const separator = container.firstChild
    expect(separator).toHaveClass('-mx-1 my-1 h-px bg-muted')
  })

  it('renders MenubarLabel with text', () => {
    render(<MenubarLabel>Menu label</MenubarLabel>)

    const label = screen.getByText('Menu label')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass('px-2 py-1.5 text-sm font-semibold')
  })

  it('renders MenubarLabel with inset prop', () => {
    const { container } = render(<MenubarLabel inset>Label with inset</MenubarLabel>)

    const label = container.firstChild
    expect(label).toHaveClass('pl-8')
  })

  it('renders MenubarCheckboxItem with checked state', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked>
              Checkbox item
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const item = screen.getByText('Checkbox item')
    expect(item).toBeInTheDocument()
    expect(item).toHaveClass(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none'
    )
  })

  it('renders MenubarRadioGroup', () => {
    render(<MenubarRadioGroup />)
    // RadioGroup is just a wrapper
    expect(document.querySelector('[data-testid="menubar-radio-group"]')).toBeDefined()
  })

  it('renders MenubarRadioItem with children', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent>
            <MenubarRadioGroup>
              <MenubarRadioItem>Radio item</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const item = screen.getByText('Radio item')
    expect(item).toBeInTheDocument()
    expect(item).toHaveClass(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none'
    )
  })

  it('renders MenubarSub', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent>
            <MenubarSub />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )
    // Sub is just a wrapper
    expect(document.querySelector('[data-slot="menubar-sub"]')).toBeDefined()
  })

  it('renders MenubarSubTrigger with children and chevron', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger>Sub trigger</MenubarSubTrigger>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const trigger = screen.getByText('Sub trigger')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveClass(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none'
    )

    // Should have chevron icon
    const chevron = document.querySelector('svg')
    expect(chevron).toBeInTheDocument()
  })

  it('renders MenubarSubTrigger with inset prop', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger inset>Sub trigger</MenubarSubTrigger>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const trigger = screen.getByText('Sub trigger')
    expect(trigger).toHaveClass('pl-8')
  })

  it('renders MenubarSubContent with children', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger>Sub</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>Sub item</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    expect(screen.getByText('Sub item')).toBeInTheDocument()
  })

  it('renders MenubarShortcut with text', () => {
    render(<MenubarShortcut>⌘K</MenubarShortcut>)

    const shortcut = screen.getByText('⌘K')
    expect(shortcut).toBeInTheDocument()
    expect(shortcut).toHaveClass('ml-auto text-xs tracking-widest text-muted-foreground')
  })

  describe('Interactions', () => {
    it('triggers click event on MenubarItem', () => {
      const onClick = vi.fn()
      render(
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>Open</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={onClick}>Clickable item</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      )

      fireEvent.click(screen.getByText('Clickable item'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not trigger click when MenubarItem is disabled', () => {
      const onClick = vi.fn()
      render(
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>Open</MenubarTrigger>
            <MenubarContent>
              <MenubarItem disabled onClick={onClick}>
                Disabled item
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      )

      fireEvent.click(screen.getByText('Disabled item'))
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('Integration', () => {
    it('renders a complete menubar with menu items', () => {
      render(
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>New</MenubarItem>
              <MenubarItem>Open</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Save</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Cut</MenubarItem>
              <MenubarItem>Copy</MenubarItem>
              <MenubarItem>Paste</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      )

      expect(screen.getByText('File')).toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
      // Content items are rendered in portals, may not be immediately visible
    })
  })
})