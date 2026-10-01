export type ProgressSignal = 'check' | 'usdt' | 'slearn'

export type ProgressState = 'done' | 'available' | 'blocked'

export type ProgressColor = 'green' | 'yellow' | 'gray'

export interface ProgressSignalInput {
  totalGuides: number
  completedGuides: number
  paidGuidesUSDT: number
  paidGuidesSLEARN: number
  vaultBalance: number | null
  vaultBalanceSlearn: number | null
  amountPerGuide: number | null
  amountPerGuideSlearn: number | null
  offline?: boolean
}

export interface SignalProgress {
  key: ProgressSignal
  ratio: number
  state: ProgressState
  color: ProgressColor
  colorClass: string
}

const COLOR_CLASS: Record<ProgressColor, string> = {
  green: 'text-green-500',
  yellow: 'text-yellow-400',
  gray: 'text-gray-300',
}

const STATE_COLOR: Record<ProgressState, ProgressColor> = {
  done: 'green',
  available: 'yellow',
  blocked: 'gray',
}

export function availableGuides(
  balance: number | null | undefined,
  perGuide: number | null | undefined,
  remaining: number,
): number {
  if (balance == null || perGuide == null) return 0
  if (!Number.isFinite(balance) || !Number.isFinite(perGuide)) return 0
  if (perGuide <= 0 || remaining <= 0) return 0
  return Math.max(0, Math.min(Math.floor(balance / perGuide), remaining))
}

function toRatio(value: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(value) || value <= 0) return 0
  return Math.min(1, value / total)
}

function build(key: ProgressSignal, ratio: number, state: ProgressState): SignalProgress {
  const color = STATE_COLOR[state]
  return { key, ratio, state, color, colorClass: COLOR_CLASS[color] }
}

export function checkSignal(input: ProgressSignalInput): SignalProgress {
  const { totalGuides, completedGuides } = input
  const done = totalGuides > 0 && completedGuides >= totalGuides
  const state: ProgressState = totalGuides <= 0 ? 'blocked' : done ? 'done' : 'available'
  return build('check', toRatio(completedGuides, totalGuides), state)
}

function tokenSignal(
  key: 'usdt' | 'slearn',
  paid: number,
  balance: number | null | undefined,
  perGuide: number | null | undefined,
  input: ProgressSignalInput,
): SignalProgress {
  const total = input.totalGuides
  const remaining = Math.max(0, total - paid)
  const done = total > 0 && paid >= total
  let state: ProgressState
  if (total <= 0) state = 'blocked'
  else if (done) state = 'done'
  else if (input.offline) state = 'blocked'
  else if (availableGuides(balance, perGuide, remaining) > 0) state = 'available'
  else state = 'blocked'
  return build(key, toRatio(paid, total), state)
}

export function courseProgress(input: ProgressSignalInput): SignalProgress[] {
  return [
    checkSignal(input),
    tokenSignal('usdt', input.paidGuidesUSDT, input.vaultBalance, input.amountPerGuide, input),
    tokenSignal('slearn', input.paidGuidesSLEARN, input.vaultBalanceSlearn, input.amountPerGuideSlearn, input),
  ]
}
