import { signMessage } from './wallet'

export async function signSIWE(message: string): Promise<`0x${string}`> {
  return signMessage(message)
}
