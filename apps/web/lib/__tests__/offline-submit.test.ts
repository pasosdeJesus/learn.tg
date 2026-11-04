import { describe, it, expect } from 'vitest'

import { isNetworkFailure, shouldQueueSubmission } from '../offline-submit'

describe('shouldQueueSubmission (F-#295)', () => {
  it('queues the answer when the device reports itself offline', () => {
    expect(shouldQueueSubmission(false, { code: 'ECONNABORTED' })).toBe(true)
    expect(shouldQueueSubmission(false, undefined)).toBe(true)
  })

  it('does not queue a slow server as offline', () => {
    const timeout = { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' }
    expect(isNetworkFailure(timeout)).toBe(false)
    expect(shouldQueueSubmission(true, timeout)).toBe(false)
  })

  it('does not queue a server error (5xx)', () => {
    const serverError = { response: { status: 503 }, message: 'Request failed with status code 503' }
    expect(isNetworkFailure(serverError)).toBe(false)
    expect(shouldQueueSubmission(true, serverError)).toBe(false)
  })

  it('queues a real network failure while online', () => {
    expect(isNetworkFailure({ code: 'ERR_NETWORK' })).toBe(true)
    expect(shouldQueueSubmission(true, { code: 'ERR_NETWORK' })).toBe(true)
    expect(shouldQueueSubmission(true, { code: 'ERR_INTERNET_DISCONNECTED' })).toBe(true)
  })

  it('does not treat a failure with an HTTP response as a lost connection', () => {
    expect(isNetworkFailure({ response: { status: 401 }, code: 'ERR_NETWORK' })).toBe(false)
  })
})
