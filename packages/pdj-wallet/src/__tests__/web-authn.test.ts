import { afterEach, describe, expect, it, vi } from 'vitest'
import { isUserCancelledError, signalUnknownCredential } from '../web-authn'

describe('isUserCancelledError (R-#246 §14 item 4)', () => {
  it('accepts the WebAuthn cancellations by name', () => {
    expect(isUserCancelledError(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toBe(true)
    expect(isUserCancelledError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true)
  })

  it('accepts a message that says the user cancelled', () => {
    expect(isUserCancelledError(new Error('The operation was cancelled'))).toBe(true)
    expect(isUserCancelledError(new Error('user aborted the request'))).toBe(true)
    expect(isUserCancelledError('notallowederror')).toBe(true)
  })

  it('rejects other failures', () => {
    expect(isUserCancelledError(new Error('no-prf'))).toBe(false)
    expect(isUserCancelledError(new Error('auth-failed'))).toBe(false)
    expect(isUserCancelledError(undefined)).toBe(false)
  })
})

describe('signalUnknownCredential (R-#246 §14 item 1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when the browser does not expose the API', async () => {
    await expect(signalUnknownCredential('cred-1')).resolves.toBeUndefined()
  })

  it('tells the authenticator the passkey is gone', async () => {
    const signal = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('PublicKeyCredential', { signalUnknownCredential: signal })
    vi.stubGlobal('location', { hostname: 'learn.tg' })
    await signalUnknownCredential('cred-2')
    expect(signal).toHaveBeenCalledWith({ rpId: 'learn.tg', credentialId: 'cred-2' })
  })

  it('never throws when the browser rejects the call', async () => {
    const signal = vi.fn().mockRejectedValue(new Error('NotSupportedError'))
    vi.stubGlobal('PublicKeyCredential', { signalUnknownCredential: signal })
    await expect(signalUnknownCredential('cred-3')).resolves.toBeUndefined()
  })

  it('ignores an empty credential id', async () => {
    const signal = vi.fn()
    vi.stubGlobal('PublicKeyCredential', { signalUnknownCredential: signal })
    await signalUnknownCredential('')
    expect(signal).not.toHaveBeenCalled()
  })
})
