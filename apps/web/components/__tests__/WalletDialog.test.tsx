// @vitest-environment jsdom
// F2 (https://gitlab.com/pasosdeJesus/m/-/work_items/75): el flujo completo vive en
// `@pasosdejesus/m/wallet/next` y se prueba allí. Aquí se fija sólo el contrato de
// learn.tg: qué props recibe el diálogo compartido y qué pasa al firmar o al borrar.
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
}))

vi.mock('@pasosdejesus/m/wallet/next', () => ({
  WalletDialog: (props: Record<string, unknown>) => {
    captured.props = props
    return (
      <div data-testid="shared-wallet-dialog">
        <button
          type="button"
          data-testid="fake-sign-in"
          onClick={() => void (props.signIn as (provider: unknown) => Promise<void>)({ request: vi.fn() })}
        />
        <button
          type="button"
          data-testid="fake-removed"
          onClick={() => void (props.onWalletRemoved as () => Promise<void>)()}
        />
      </div>
    )
  },
}))

const glue = vi.hoisted(() => ({ signInWithInAppWallet: vi.fn(async () => '0xabc') }))
vi.mock('@/lib/in-app-siwe', () => ({ signInWithInAppWallet: glue.signInWithInAppWallet }))

vi.mock('@/lib/rpc-url', () => ({ getRpcUrl: () => 'https://rpc.test' }))

const offline = vi.hoisted(() => ({ clearRestrictedCourseCopies: vi.fn(async () => []) }))
vi.mock('@/lib/offline-course-db', () => ({
  clearRestrictedCourseCopies: offline.clearRestrictedCourseCopies,
}))

import { WalletDialog } from '../WalletDialog'

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

function renderDialog(props: Partial<Parameters<typeof WalletDialog>[0]> = {}) {
  const onOpenChange = vi.fn()
  render(<WalletDialog open onOpenChange={onOpenChange} {...props} />)
  return { onOpenChange, props: captured.props as Record<string, unknown> }
}

beforeEach(() => {
  captured.props = null
  glue.signInWithInAppWallet.mockClear()
  offline.clearRestrictedCourseCopies.mockClear()
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('WalletDialog (envoltorio de learn.tg)', () => {
  it('pasa al diálogo compartido el RPC, la clave heredada, el nombre y la sesión', () => {
    const { props } = renderDialog({ sessionAddress: ADDRESS })

    expect(screen.getByTestId('shared-wallet-dialog')).toBeTruthy()
    expect(props.appName).toBe('learn.tg')
    expect(props.rpcUrl).toBe('https://rpc.test')
    expect(props.sessionAddress).toBe(ADDRESS)
    expect(props.backup).toEqual({ storageKey: 'learn.tg.wallet.backupConfirmed' })
    expect(props.migrationHref).toBe('/en/migration-in-app-wallet')
    expect(props.lang).toBe('en')
    expect(props.logger).toBeTruthy()
  })

  it('en español usa la guía de migración en español', () => {
    const { props } = renderDialog({ lang: 'es' })
    expect(props.lang).toBe('es')
    expect(props.migrationHref).toBe('/es/migracion-billetera-app')
  })

  it('al firmar usa el glue de learn.tg (invitaciones) y cierra el diálogo', async () => {
    const { onOpenChange, props } = renderDialog()

    fireEvent.click(screen.getByTestId('fake-sign-in'))
    await vi.waitFor(() => expect(glue.signInWithInAppWallet).toHaveBeenCalledTimes(1))

    expect(glue.signInWithInAppWallet).toHaveBeenCalledWith(expect.anything(), { lang: 'en' })
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(props.signIn).toBeTypeOf('function')
  })

  it('al borrar la billetera limpia la sesión fría, las copias del dispositivo y cierra', async () => {
    localStorage.setItem('learn.tg.sessionAddress', ADDRESS)
    const { onOpenChange } = renderDialog()

    fireEvent.click(screen.getByTestId('fake-removed'))
    await vi.waitFor(() => expect(offline.clearRestrictedCourseCopies).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))

    expect(localStorage.getItem('learn.tg.sessionAddress')).toBeNull()
  })

  it('el cierre desde el diálogo se propaga al host', () => {
    const { onOpenChange, props } = renderDialog()
    ;(props.onOpenChange as (open: boolean) => void)(false)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
