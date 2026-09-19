'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { getAddress } from 'viem'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Input } from '@pasosdejesus/m/shadcn-components/ui/input'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { createComponentT } from '@/lib/hooks/useTranslation'
import {
  TOKEN_DECIMALS,
  explorerAddressBase,
  explorerApiNftsUrl,
  explorerTxUrl,
  formatTokenAmount,
  parseTokenAmount,
  validateSend,
  type SendToken,
} from '@/lib/wallet-amounts'

interface WalletPanelProps {
  lang?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dirección de la billetera de la aplicación (la del registro). */
  address: string
  /** Desconectar la billetera y cerrar la sesión, como el ✕ de la cabecera. */
  onLock?: () => void
}

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'boolean' }],
  },
] as const

const TOKENS: SendToken[] = ['CELO', 'USDT', 'SLEARN']
/** CELO that must stay in the wallet to pay the network fee (0.01 CELO). */
const GAS_RESERVE_WEI = 10_000_000_000_000_000n

const NETWORK = process.env.NEXT_PUBLIC_NETWORK

// Se leen al usarlas, no al cargar el módulo: así el panel respeta el entorno real
// (y se puede probar cambiando la variable sin recargar el módulo).
function usdtAddress(): `0x${string}` | undefined {
  return process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}` | undefined
}

function slearnAddress(): `0x${string}` | undefined {
  return process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}` | undefined
}

function tokenAddress(token: SendToken): `0x${string}` | undefined {
  if (token === 'USDT') return usdtAddress()
  if (token === 'SLEARN') return slearnAddress()
  return undefined
}

/** `getAddress` throws on a malformed address; the panel must not crash. */
function checksummed(address: string): string {
  try {
    return getAddress(address)
  } catch {
    return address
  }
}

interface Nft {
  name?: string
  image?: string
  collection?: string
}

/**
 * Panel de la billetera de la aplicación (R-#249): saldos, copiar la dirección,
 * recibir (QR), enviar CELO/USDT/SLEARN y coleccionables de Celo. La píldora de la
 * cabecera lo abre cuando la billetera está desbloqueada; bloqueada, primero se
 * abre el diálogo de desbloqueo.
 */
export function WalletPanel({ lang = 'en', open, onOpenChange, address, onLock }: WalletPanelProps) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { status } = useInAppWallet()

  const [balances, setBalances] = useState<Record<SendToken, bigint | null>>({
    CELO: null,
    USDT: null,
    SLEARN: null,
  })
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [token, setToken] = useState<SendToken>('CELO')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [nfLoading, setNfLoading] = useState(false)
  const [nfts, setNfts] = useState<Nft[] | null>(null)
  const [nftsError, setNftsError] = useState(false)

  const t = useMemo(
    () =>
      createComponentT(lang, {
        en: {
          title: 'Your in-app wallet',
          address: 'Address',
          copy: 'Copy',
          copied: 'Copied',
          balances: 'Balances',
          receive: 'Receive',
          hideQr: 'Hide QR',
          receiveHint: 'Scan this code or share your address to receive funds on Celo.',
          send: 'Send',
          token: 'Token',
          destination: 'Destination address',
          amount: 'Amount',
          max: 'Max',
          sendNow: 'Send',
          sending: 'Sending…',
          done: 'Sent',
          viewTx: 'View transaction',
          nfts: 'Collectibles (Celo)',
          loadNfts: 'Show my collectibles',
          noNfts: 'No collectibles found for this wallet.',
          nftsError: 'Collectibles are not available right now.',
          lockNow: 'Disconnect and lock',
          close: 'Close',
          needWallet: 'Unlock your in-app wallet to send funds.',
          errAddress: 'That address is not valid.',
          errAmount: 'Enter an amount greater than zero.',
          errInsufficient: 'Not enough funds for that amount.',
          errSelf: 'That is this wallet address.',
          errNoGas: 'Set aside some CELO for the network fee.',
          errCancelled: 'The confirmation was cancelled.',
          errGeneric: 'The transaction could not be sent.',
        },
        es: {
          title: 'Tu billetera de la aplicación',
          address: 'Dirección',
          copy: 'Copiar',
          copied: 'Copiada',
          balances: 'Saldos',
          receive: 'Recibir',
          hideQr: 'Ocultar QR',
          receiveHint: 'Escanea este código o comparte tu dirección para recibir fondos en Celo.',
          send: 'Enviar',
          token: 'Token',
          destination: 'Dirección destino',
          amount: 'Monto',
          max: 'Máximo',
          sendNow: 'Enviar',
          sending: 'Enviando…',
          done: 'Enviado',
          viewTx: 'Ver transacción',
          nfts: 'Coleccionables (Celo)',
          loadNfts: 'Ver mis coleccionables',
          noNfts: 'No se encontraron coleccionables para esta billetera.',
          nftsError: 'Los coleccionables no están disponibles ahora.',
          lockNow: 'Desconectar y bloquear',
          close: 'Cerrar',
          needWallet: 'Desbloquea tu billetera para enviar fondos.',
          errAddress: 'Esa dirección no es válida.',
          errAmount: 'Escribe un monto mayor que cero.',
          errInsufficient: 'No hay fondos suficientes para ese monto.',
          errSelf: 'Esa es la dirección de esta billetera.',
          errNoGas: 'Deja algo de CELO para la comisión de red.',
          errCancelled: 'Se canceló la confirmación.',
          errGeneric: 'No se pudo enviar la transacción.',
        },
      }),
    [lang],
  )

  const loadBalances = useCallback(async () => {
    if (!publicClient || !address) return
    setLoadingBalances(true)
    try {
      const owner = address as `0x${string}`
      // Los tres en paralelo y con `allSettled`: una lectura caída no puede borrar
      // las otras dos ni mostrar NaN (R-#249).
      const [celo, usdt, slearn] = await Promise.allSettled([
        publicClient.getBalance({ address: owner }),
        usdtAddress()
          ? publicClient.readContract({
              address: usdtAddress()!,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [owner],
            })
          : Promise.resolve(null),
        slearnAddress()
          ? publicClient.readContract({
              address: slearnAddress()!,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [owner],
            })
          : Promise.resolve(null),
      ])
      setBalances({
        CELO: celo.status === 'fulfilled' ? (celo.value as bigint) : null,
        USDT: usdt.status === 'fulfilled' ? ((usdt.value as bigint | null) ?? null) : null,
        SLEARN: slearn.status === 'fulfilled' ? ((slearn.value as bigint | null) ?? null) : null,
      })
    } finally {
      setLoadingBalances(false)
    }
  }, [address, publicClient])

  useEffect(() => {
    if (!open) return
    void loadBalances()
    setTxHash(null)
    setSendError(null)
    setNfts(null)
    setNftsError(false)
  }, [open, loadBalances])

  const loadNfts = useCallback(async () => {
    if (!address) return
    setNfLoading(true)
    try {
      const response = await fetch(explorerApiNftsUrl(address, NETWORK))
      if (!response.ok) throw new Error(String(response.status))
      const json = (await response.json()) as {
        items?: { metadata?: { name?: string; image?: string }; token?: { name?: string } }[]
      }
      setNfts(
        (json.items || []).map((item) => ({
          name: item.metadata?.name,
          image: item.metadata?.image,
          collection: item.token?.name,
        })),
      )
    } catch {
      // Degrada en silencio: la sección falla, los saldos no.
      setNfts([])
      setNftsError(true)
    } finally {
      setNfLoading(false)
    }
  }, [address])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(checksummed(address))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [address])

  const decimals = TOKEN_DECIMALS[token]
  const parsedAmount = parseTokenAmount(amount, decimals)
  const isNative = token === 'CELO'
  const validationError = validateSend({
    to,
    amount: parsedAmount,
    balance: balances[token],
    isNative,
    selfAddress: address,
    gasCost: isNative ? GAS_RESERVE_WEI : 0n,
  })

  const errorText = useMemo(() => {
    if (!validationError) return null
    if (validationError === 'invalid-address') return t('errAddress')
    if (validationError === 'invalid-amount') return t('errAmount')
    if (validationError === 'insufficient') return t('errInsufficient')
    if (validationError === 'self') return t('errSelf')
    if (validationError === 'no-gas') return t('errNoGas')
    return t('errGeneric')
  }, [t, validationError])

  const handleMax = useCallback(() => {
    const balance = balances[token]
    if (balance === null) return
    const usable = isNative && balance > GAS_RESERVE_WEI ? balance - GAS_RESERVE_WEI : balance
    setAmount(formatTokenAmount(usable, decimals, decimals))
  }, [balances, decimals, isNative, token])

  const handleSend = useCallback(async () => {
    if (!walletClient || validationError || parsedAmount === null) return
    setSending(true)
    setSendError(null)
    try {
      const destination = getAddress(to.trim()) as `0x${string}`
      let hash: `0x${string}`
      if (isNative) {
        hash = await walletClient.sendTransaction({ to: destination, value: parsedAmount })
      } else {
        const contract = tokenAddress(token)
        if (!contract) throw new Error('missing token address')
        hash = await walletClient.writeContract({
          address: contract,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [destination, parsedAmount],
        })
      }
      setTxHash(hash)
      setAmount('')
      setTo('')
      await loadBalances()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const code = (e as { code?: number })?.code
      if (code === 4001 || /rejected/i.test(message)) setSendError(t('errCancelled'))
      else setSendError(t('errGeneric'))
    } finally {
      setSending(false)
    }
  }, [isNative, loadBalances, parsedAmount, t, to, token, validationError, walletClient])

  const locked = status !== 'unlocked'
  const canSend = !locked && !sending && !validationError && !!walletClient

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="wallet-panel" className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('balances')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded border bg-gray-50 p-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{t('address')}</p>
              <p className="font-mono text-sm break-all" data-testid="wallet-panel-address">
                {checksummed(address)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              data-testid="wallet-panel-copy"
              onClick={() => { void handleCopy() }}
            >
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">{t('balances')}</p>
            <ul className="divide-y rounded border" data-testid="wallet-panel-balances">
              {TOKENS.map((item) => (
                <li key={item} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{item}</span>
                  <span className="font-mono" data-testid={`wallet-panel-balance-${item}`}>
                    {loadingBalances && balances[item] === null
                      ? '…'
                      : formatTokenAmount(balances[item], TOKEN_DECIMALS[item])}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-gray-500">
              <a
                href={`${explorerAddressBase(NETWORK)}/address/${checksummed(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Blockscout
              </a>
            </p>
          </div>

          <div>
            <Button
              variant="outline"
              size="sm"
              data-testid="wallet-panel-receive"
              onClick={() => setShowReceive((value) => !value)}
            >
              {showReceive ? t('hideQr') : t('receive')}
            </Button>
            {showReceive && (
              <div className="mt-2 space-y-2 text-center" data-testid="wallet-panel-qr">
                <div className="inline-block rounded bg-white p-3">
                  <QRCodeSVG value={checksummed(address)} size={148} />
                </div>
                <p className="text-xs text-gray-500">{t('receiveHint')}</p>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded border p-3">
            <p className="text-sm font-medium">{t('send')}</p>
            {locked && <p className="text-sm text-amber-700">{t('needWallet')}</p>}
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">{t('token')}</span>
              <select
                data-testid="wallet-panel-token"
                className="w-full rounded border px-2 py-1 text-sm"
                value={token}
                onChange={(event) => setToken(event.target.value as SendToken)}
              >
                {TOKENS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">{t('destination')}</span>
              <Input
                data-testid="wallet-panel-to"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="0x…"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">{t('amount')}</span>
              <div className="flex gap-2">
                <Input
                  data-testid="wallet-panel-amount"
                  value={amount}
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                />
                <Button variant="outline" size="sm" data-testid="wallet-panel-max" onClick={handleMax}>
                  {t('max')}
                </Button>
              </div>
            </label>

            {errorText && (
              <p className="text-sm text-amber-700" data-testid="wallet-panel-error">
                {errorText}
              </p>
            )}
            {sendError && (
              <p className="text-sm text-red-700" data-testid="wallet-panel-send-error">
                {sendError}
              </p>
            )}
            {txHash && (
              <p className="text-sm text-green-700" data-testid="wallet-panel-sent">
                {t('done')}:{' '}
                <a
                  className="underline"
                  href={explorerTxUrl(txHash, NETWORK)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('viewTx')}
                </a>
              </p>
            )}

            <Button data-testid="wallet-panel-send" onClick={() => { void handleSend() }} disabled={!canSend}>
              {sending ? t('sending') : t('sendNow')}
            </Button>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">{t('nfts')}</p>
            {nfts === null && !nfLoading && (
              <Button
                variant="outline"
                size="sm"
                data-testid="wallet-panel-load-nfts"
                onClick={() => { void loadNfts() }}
              >
                {t('loadNfts')}
              </Button>
            )}
            {nfLoading && <p className="text-sm text-gray-500">…</p>}
            {nfts !== null && nfts.length === 0 && (
              <p className="text-sm text-gray-500" data-testid="wallet-panel-no-nfts">
                {nftsError ? t('nftsError') : t('noNfts')}
              </p>
            )}
            {nfts !== null && nfts.length > 0 && (
              <ul className="grid grid-cols-3 gap-2" data-testid="wallet-panel-nfts">
                {nfts.map((nft, index) => (
                  <li key={`${nft.name || 'nft'}-${index}`} className="text-center text-xs">
                    {nft.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={nft.image}
                        alt={nft.name || ''}
                        className="mx-auto h-16 w-16 rounded object-cover"
                      />
                    )}
                    <span className="block truncate">{nft.name || nft.collection || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-2 flex justify-between gap-2">
          {onLock && (
            <Button variant="ghost" size="sm" data-testid="wallet-panel-lock" onClick={onLock}>
              {t('lockNow')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
