// When a failed POST is kept for later (R-#241/R-#242) and when it is shown as
// an error.
//
// The queue used to take *any* failure without a `response`, so a server that
// took too long was reported as "you are offline" and the answer was stored
// again although the server had already credited the guide
// (https://github.com/pasosdeJesus/learn.tg/issues/295 §3.2). Only a device that
// reports itself offline, or a failure that never reached the server, belongs in
// the queue; a timeout or a 4xx/5xx answer is an error the student must see and
// be able to retry.

/** Shape of the errors axios throws (the page only needs these fields). */
export interface SubmitFailure {
  response?: unknown
  code?: string
  message?: string
}

/** Codes emitted when the request could not reach the server at all. */
const NETWORK_FAILURE_CODES = ['ERR_NETWORK', 'ERR_INTERNET_DISCONNECTED']

/**
 * `true` when the request never reached the server. A timeout (`ECONNABORTED`)
 * is deliberately **not** a network failure: the server may have processed it.
 */
export function isNetworkFailure(error: SubmitFailure | null | undefined): boolean {
  if (!error || error.response) return false
  return NETWORK_FAILURE_CODES.includes(String(error.code ?? ''))
}

/**
 * `true` when the submission should be stored in the offline queue instead of
 * being reported as an error.
 */
export function shouldQueueSubmission(
  online: boolean,
  error: SubmitFailure | null | undefined,
): boolean {
  if (!online) return true
  return isNetworkFailure(error)
}
