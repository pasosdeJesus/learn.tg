import { english, generateMnemonic, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'

export type PrivateKey = `0x${string}`

export function newMnemonic(): string {
  return generateMnemonic(english)
}

export function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, ' ')
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
