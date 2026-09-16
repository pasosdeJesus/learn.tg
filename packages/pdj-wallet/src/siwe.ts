import { signMessage } from './wallet.js'

export async function signSIWE(message: string): Promise<`0x${string}`> {
  return signMessage(message)
}
