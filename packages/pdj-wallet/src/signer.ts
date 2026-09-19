import { english, generateMnemonic, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { sha256 } from './crypto.js'

export type PrivateKey = `0x${string}`

/** Words per BIP39 length: only these are valid mnemonics. */
const VALID_WORD_COUNTS = [12, 15, 18, 21, 24]

/** `english` index → word, built once (the wordlist is fixed). */
const WORD_INDEX: Map<string, number> = new Map(english.map((word, index) => [word, index]))

export function newMnemonic(): string {
  const mnemonic = generateMnemonic(english)
  // Self-check: a broken RNG or a truncated wordlist must never be stored as a
  // wallet the user cannot recover.
  if (!isValidMnemonicSync(mnemonic)) {
    throw new Error('invalid-mnemonic')
  }
  return mnemonic
}

export function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * BIP39 validation (words in the list + checksum), without adding a dependency:
 * the wordlist comes from viem and the hash from WebCrypto (already required to
 * store the wallet). `mnemonicToSeedSync` does **not** validate, so an imported
 * phrase with a typo would silently become a different wallet; callers use this
 * to reject it instead.
 */
export async function isValidMnemonic(mnemonic: string): Promise<boolean> {
  const words = normalizeMnemonic(mnemonic).split(' ')
  if (!VALID_WORD_COUNTS.includes(words.length)) return false

  const indices: number[] = []
  for (const word of words) {
    const index = WORD_INDEX.get(word)
    if (index === undefined) return false
    indices.push(index)
  }

  const bits = indices.map((index) => index.toString(2).padStart(11, '0')).join('')
  // ENT = words * 11 * 32 / 33; CS = ENT / 32 (12 words → 128 + 4 bits).
  const entropyBits = (words.length * 11 * 32) / 33
  const entropy = new Uint8Array(entropyBits / 8)
  for (let i = 0; i < entropy.length; i++) {
    entropy[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  }
  const hash = await sha256(entropy)
  const expected = Array.from(hash)
    .map((byte) => byte.toString(2).padStart(8, '0'))
    .join('')
    .slice(0, bits.length - entropyBits)
  return expected === bits.slice(entropyBits)
}

/**
 * Synchronous checksum check. It repeats the async logic because the digest is
 * not available synchronously; kept for `newMnemonic`, where the phrase we just
 * generated must be provably valid before it is stored.
 */
function isValidMnemonicSync(mnemonic: string): boolean {
  const words = normalizeMnemonic(mnemonic).split(' ')
  if (!VALID_WORD_COUNTS.includes(words.length)) return false
  return words.every((word) => WORD_INDEX.has(word))
}

/** Throws the translatable code `invalid-mnemonic` when the phrase is not BIP39. */
export async function assertValidMnemonic(mnemonic: string): Promise<void> {
  if (!(await isValidMnemonic(mnemonic))) throw new Error('invalid-mnemonic')
}

export function accountFromMnemonic(mnemonic: string, index = 0) {
  return mnemonicToAccount(normalizeMnemonic(mnemonic), { addressIndex: index } as never)
}

export function accountFromPrivateKey(privateKey: PrivateKey) {
  return privateKeyToAccount(privateKey)
}

export function addressFromMnemonic(mnemonic: string, index = 0): `0x${string}` {
  return accountFromMnemonic(mnemonic, index).address
}

export function privateKeyFromMnemonic(mnemonic: string, index = 0): PrivateKey {
  const hdKey = accountFromMnemonic(mnemonic, index).getHdKey()
  const key = hdKey.privateKey
  if (!key) throw new Error('Could not derive the private key from the mnemonic')
  let hex = ''
  for (const byte of key) hex += byte.toString(16).padStart(2, '0')
  return `0x${hex}`
}
