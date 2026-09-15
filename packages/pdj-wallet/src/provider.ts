import { getUnlockedAccount, getUnlockedInfo, signMessage, signTransaction, signTypedData } from './wallet'
import { CHAIN_IDS, type Eip1193Provider, type Eip1193RequestArgs } from './types'

export interface ProviderOptions {
  rpcUrl?: string
}

function utf8ToHex(value: string): `0x${string}` {
  let hex = ''
  for (const byte of new TextEncoder().encode(value)) hex += byte.toString(16).padStart(2, '0')
  return `0x${hex}`
}

export function getInAppWalletProvider(options: ProviderOptions = {}): Eip1193Provider | null {
  const account = getUnlockedAccount()
  const info = getUnlockedInfo()
  if (!account || !info) return null

  const provider: Eip1193Provider = {
    isPdJWallet: true,

    async request({ method, params }: Eip1193RequestArgs): Promise<unknown> {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account.address]

        case 'eth_chainId':
          return `0x${CHAIN_IDS[info.chain].toString(16)}`

        case 'net_version':
          return String(CHAIN_IDS[info.chain])

        case 'wallet_switchEthereumChain':
          return null

        case 'personal_sign': {
          const [data] = (params ?? []) as [string, string]
          if (typeof data !== 'string') throw new Error('personal_sign expects a data string')
          return signMessage({ raw: data.startsWith('0x') ? (data as `0x${string}`) : utf8ToHex(data) })
        }

        case 'eth_signTypedData_v4': {
          const [, json] = (params ?? []) as [string, string]
          return signTypedData(JSON.parse(json) as never)
        }

        case 'eth_signTransaction': {
          const [tx] = (params ?? []) as [Record<string, unknown>]
          return signTransaction(tx as never)
        }

        case 'eth_sendTransaction': {
          const [tx] = (params ?? []) as [Record<string, unknown>]
          if (!options.rpcUrl) {
            throw new Error('eth_sendTransaction requires the provider to be created with an rpcUrl')
          }
          const raw = await signTransaction(tx as never)
          const response = await fetch(options.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'eth_sendRawTransaction',
              params: [raw],
            }),
          })
          const json = (await response.json()) as { result?: string; error?: { message?: string } }
          if (json.error) throw new Error(json.error.message ?? 'eth_sendRawTransaction failed')
          return json.result
        }

        case 'wallet_getCapabilities':
          return {}

        default:
          throw new Error(`Unsupported method: ${method}`)
      }
    },

    on(): void {},

    removeListener(): void {},
  }

  return provider
}
