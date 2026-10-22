'use client'

/**
 * `WalletPanel` — vista **genérica completa** de la billetera ([REQ/50](https://gitlab.com/pasosdeJesus/m/-/work_items/50) V, D9):
 * la **cuenta y sus N billeteras** + **saldos**, **recibir** (QR), **enviar** (nativo/ERC20)
 * y **coleccionables** (NFT). Portada casi literal de learn.tg `WalletPanel.tsx` (R-#249),
 * con la **config inyectada** (tokens, red/explorer, clientes viem, fuente de NFT) para no
 * acoplarla a learn.tg.
 *
 * **Deshabilitable:** `features` apaga secciones; un consumidor auth-only simplemente no
 * usa este componente (importa `WalletConnect`). **Sobrecargable** (D10): `renderWallet`.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { getAddress, type PublicClient, type WalletClient } from 'viem'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Badge } from '@pasosdejesus/m/shadcn-components/ui/badge'
import { Input } from '@pasosdejesus/m/shadcn-components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pasosdejesus/m/shadcn-components/ui/tabs'
import { logger } from '@pasosdejesus/m/debug'
import type { WalletLang } from './WalletConnect.js'
import {
  checksummed, explorerAddressUrl, explorerApiNftsUrl, explorerTxUrl,
  formatTokenAmount, normalizeNftImage, parseTokenAmount, shortAddress, validateSend,
} from '../wallet-amounts.js'

const ERC20_ABI = [
  {
    name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'boolean' }],
  },
] as const

/** CELO que debe quedar para pagar la comisión (0.01 CELO). */
const GAS_RESERVE_WEI = 10_000_000_000_000_000n

/** Etiqueta de los diagnósticos en la DebugConsole (`NEXT_PUBLIC_M_DEBUGGER_CONSOLE=1`). */
const TAG = 'wallet-panel'

export interface WalletToken {
  symbol: string
  decimals: number
  /** Contrato ERC20; ausente = moneda nativa. */
  address?: `0x${string}`
}

export interface WalletNft {
  name?: string
  image?: string
  collection?: string
}

/** Billetera de la **cuenta** (pestaña "Cuenta"). */
export interface WalletPanelWallet {
  address: string
  linkedAt?: string | null
  isConnected?: boolean
  isInApp?: boolean
}

/** Qué secciones mostrar (por defecto, todas las que tengan datos). */
export interface WalletPanelFeatures {
  accounts?: boolean
  balances?: boolean
  receive?: boolean
  send?: boolean
  collectibles?: boolean
}

export interface WalletPanelMessages {
  title: string
  address: string
  copy: string
  copied: string
  accounts: string
  connected: string
  disconnect: string
  unlink: string
  lastHint: string
  empty: string
  balances: string
  receive: string
  receiveHint: string
  send: string
  collectibles: string
  token: string
  destination: string
  amount: string
  max: string
  sendNow: string
  sending: string
  done: string
  viewTx: string
  retryNfts: string
  noNfts: string
  nftsError: string
  close: string
  needWallet: string
  unlock: string
  errAddress: string
  errAmount: string
  errInsufficient: string
  errSelf: string
  errNoGas: string
  errCancelled: string
  errGeneric: string
  unknownBalance: string
  refresh: string
}

const DEFAULT_MESSAGES: Record<WalletLang, WalletPanelMessages> = {
  en: {
    title: 'Your wallet', address: 'Address', copy: 'Copy', copied: 'Copied',
    accounts: 'Accounts', connected: 'Connected', disconnect: 'Disconnect', unlink: 'Unlink',
    lastHint: 'The last wallet cannot be unlinked', empty: 'No wallets linked.',
    balances: 'Balances', receive: 'Receive',
    receiveHint: 'Scan this code or share your address to receive funds.',
    send: 'Send', collectibles: 'Collectibles', token: 'Token', destination: 'Destination address',
    amount: 'Amount', max: 'Max', sendNow: 'Send', sending: 'Sending…', done: 'Sent',
    viewTx: 'View transaction', retryNfts: 'Try again',
    noNfts: 'No collectibles found for this wallet.', nftsError: 'Collectibles are not available right now.',
    close: 'Close', needWallet: 'Unlock the wallet to send funds.',
    unlock: 'Unlock wallet',
    errAddress: 'That address is not valid.', errAmount: 'Enter an amount greater than zero.',
    errInsufficient: 'Not enough funds for that amount.', errSelf: 'That is this wallet address.',
    errNoGas: 'Set aside some native token for the network fee.',
    errCancelled: 'The confirmation was cancelled.', errGeneric: 'The transaction could not be sent.',
    unknownBalance: 'Balance not available yet.', refresh: 'Refresh balance',
  },
  es: {
    title: 'Tu billetera', address: 'Dirección', copy: 'Copiar', copied: 'Copiada',
    accounts: 'Cuentas', connected: 'Conectada', disconnect: 'Desconectar', unlink: 'Desvincular',
    lastHint: 'La última billetera no se puede desvincular', empty: 'No hay billeteras vinculadas.',
    balances: 'Saldos', receive: 'Recibir',
    receiveHint: 'Escanea este código o comparte tu dirección para recibir fondos.',
    send: 'Enviar', collectibles: 'Coleccionables', token: 'Token', destination: 'Dirección destino',
    amount: 'Monto', max: 'Máximo', sendNow: 'Enviar', sending: 'Enviando…', done: 'Enviado',
    viewTx: 'Ver transacción', retryNfts: 'Reintentar',
    noNfts: 'No se encontraron coleccionables para esta billetera.', nftsError: 'Los coleccionables no están disponibles ahora.',
    close: 'Cerrar', needWallet: 'Desbloquea la billetera para enviar fondos.',
    unlock: 'Desbloquear billetera',
    errAddress: 'Esa dirección no es válida.', errAmount: 'Escribe un monto mayor que cero.',
    errInsufficient: 'No hay fondos suficientes para ese monto.', errSelf: 'Esa es la dirección de esta billetera.',
    errNoGas: 'Deja algo de token nativo para la comisión de red.',
    errCancelled: 'Se canceló la confirmación.', errGeneric: 'No se pudo enviar la transacción.',
    unknownBalance: 'El saldo aún no está disponible.', refresh: 'Actualizar saldo',
  },
}

export type WalletPanelTab = 'accounts' | 'balances' | 'receive' | 'send' | 'collectibles'

const DEFAULT_TAB_ORDER: WalletPanelTab[] = ['accounts', 'balances', 'receive', 'send', 'collectibles']

export interface WalletPanelProps {
  lang?: WalletLang
  messages?: Partial<WalletPanelMessages>
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dirección de la billetera conectada (la que firma); necesaria para saldos/enviar. */
  address?: string
  /** Billeteras de la cuenta (pestaña "Cuenta"). */
  wallets?: WalletPanelWallet[]
  onDisconnect?: () => void | Promise<void>
  onUnlink?: (address: string) => void | Promise<void>
  /** Tokens a mostrar/enviar (el primero es el inicial). Nativo si no tiene `address`. */
  tokens?: WalletToken[]
  publicClient?: PublicClient | null
  walletClient?: WalletClient | null
  network?: string
  explorerBase?: string
  gasReserveWei?: bigint
  /** Fuente de NFT; por defecto el explorer Blockscout (Celo). */
  fetchNfts?: (address: string) => Promise<WalletNft[]>
  features?: WalletPanelFeatures
  /** Sobrecarga la fila de una billetera de la cuenta. */
  renderWallet?: (wallet: WalletPanelWallet) => ReactNode
  /**
   * Orden de las pestañas visibles (las que falten van al final, en el orden por
   * defecto). Por defecto: cuentas primero. Un consumidor que quiera la cuenta al
   * final pasa `['balances','receive','send','accounts','collectibles']`.
   */
  tabOrder?: WalletPanelTab[]
  /** Contenido extra al final de la pestaña "Cuentas" (vincular, invitar…). */
  accountsActions?: ReactNode
  /**
   * Desbloquear la billetera desde la pestaña Enviar. Sin esto, una billetera
   * bloqueada solo explica el motivo y el usuario tiene que buscarlo en Cuentas.
   */
  onRequestUnlock?: () => void
}

export function WalletPanel({
  lang = 'en',
  messages,
  open,
  onOpenChange,
  address,
  wallets = [],
  onDisconnect,
  onUnlink,
  tokens = [],
  publicClient = null,
  walletClient = null,
  network,
  explorerBase,
  gasReserveWei = GAS_RESERVE_WEI,
  fetchNfts,
  features,
  renderWallet,
  tabOrder,
  accountsActions,
  onRequestUnlock,
}: WalletPanelProps) {
  const text = { ...DEFAULT_MESSAGES[lang], ...messages }
  const [copied, setCopied] = useState(false)
  const [balances, setBalances] = useState<Record<string, bigint | null>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [token, setToken] = useState<string>(tokens[0]?.symbol ?? '')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [nfts, setNfts] = useState<WalletNft[] | null>(null)
  const [nftsError, setNftsError] = useState(false)
  const [nfLoading, setNfLoading] = useState(false)

  const showAccounts = features?.accounts !== false && wallets.length > 0
  const showBalances = features?.balances !== false && !!address && tokens.length > 0
  const showReceive = features?.receive !== false && !!address
  const showSend = features?.send !== false && !!address && tokens.length > 0
  const showCollectibles = features?.collectibles !== false && !!address
  const visibleTabs = [
    showAccounts && 'accounts',
    showBalances && 'balances',
    showReceive && 'receive',
    showSend && 'send',
    showCollectibles && 'collectibles',
  ].filter(Boolean) as WalletPanelTab[]
  const tabs = (tabOrder ?? DEFAULT_TAB_ORDER).filter((item) => visibleTabs.includes(item))
  for (const item of DEFAULT_TAB_ORDER) {
    if (visibleTabs.includes(item) && !tabs.includes(item)) tabs.push(item)
  }
  const [tab, setTab] = useState<string>(tabs[0] ?? '')

  const selected = tokens.find((item) => item.symbol === token) ?? tokens[0]
  const decimals = selected?.decimals ?? 18
  const isNative = !selected?.address

  const loadBalances = useCallback(async () => {
    if (!publicClient || !address) {
      logger.info(`balances skipped: publicClient=${publicClient ? 'yes' : 'NO'} address=${address ? 'yes' : 'NO'}`, TAG)
      return
    }
    setLoadingBalances(true)
    try {
      const owner = address as `0x${string}`
      const results = await Promise.allSettled(
        tokens.map((item) =>
          item.address
            ? publicClient.readContract({ address: item.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner] } as never)
            : publicClient.getBalance({ address: owner }),
        ),
      )
      const next: Record<string, bigint | null> = {}
      tokens.forEach((item, index) => {
        const result = results[index]
        next[item.symbol] = result.status === 'fulfilled' ? ((result.value as bigint | null) ?? null) : null
      })
      const failures = results
        .map((result, index) => result.status === 'rejected'
          ? `${tokens[index]?.symbol ?? `token#${index}`}: ${String(result.reason)}`
          : null)
        .filter((item): item is string => item !== null)
      if (failures.length > 0) logger.error(`balance read failed — ${failures.join(' | ')}`, TAG)
      setBalances(next)
    } finally {
      setLoadingBalances(false)
    }
  }, [address, publicClient, tokens])

  const loadNfts = useCallback(async () => {
    if (!address) return
    setNfLoading(true)
    setNftsError(false)
    try {
      if (fetchNfts) {
        setNfts(await fetchNfts(address))
        return
      }
      const response = await fetch(explorerApiNftsUrl(address, network, explorerBase))
      if (!response.ok) throw new Error(String(response.status))
      const json = (await response.json()) as {
        items?: { metadata?: { name?: string; image?: string }; token?: { name?: string } }[]
      }
      setNfts((json.items || []).map((item) => ({
        name: item.metadata?.name,
        image: normalizeNftImage(item.metadata?.image),
        collection: item.token?.name,
      })))
    } catch (error) {
      logger.error(`collectibles failed: ${String(error)}`, TAG)
      setNfts([])
      setNftsError(true)
    } finally {
      setNfLoading(false)
    }
  }, [address, explorerBase, fetchNfts, network])

  useEffect(() => {
    if (!open) return
    setBalances({})
    setTxHash(null)
    setSendError(null)
    setNfts(null)
    setNftsError(false)
    setTab(tabs[0] ?? '')
    logger.info(`open: address=${address ? shortAddress(address) : 'none'} tokens=${tokens.map((item) => item.symbol).join(',') || 'none'}`, TAG)
    void loadBalances()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Diagnóstico del estado que explica por qué Enviar no responde: sin firmante
  // la pestaña está bloqueada (needWallet), con firmante el motivo lo da
  // `validateSend`. Aparece en la DebugConsole de la PWA/MiniPay.
  useEffect(() => {
    if (!open) return
    logger.info(`signer ${walletClient ? 'available' : 'MISSING (locked or no provider)'} for ${address ? shortAddress(address) : 'no address'}`, TAG)
  }, [open, walletClient, address])

  const handleTabChange = useCallback((value: string) => {
    setTab(value)
    if (value === 'collectibles' && nfts === null && !nfLoading) void loadNfts()
  }, [loadNfts, nfLoading, nfts])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(checksummed(address ?? ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [address])

  const locked = !walletClient
  const parsedAmount = parseTokenAmount(amount, decimals)
  const validationError = validateSend({
    to, amount: parsedAmount, balance: balances[token] ?? null, isNative, selfAddress: address,
    gasCost: isNative ? gasReserveWei : 0n,
  })
  const errorText = useMemo(() => {
    // Bloqueada: el motivo real es `needWallet`, no un campo a medio llenar.
    if (locked || !validationError) return null
    if (validationError === 'invalid-address') return text.errAddress
    if (validationError === 'invalid-amount') return text.errAmount
    if (validationError === 'insufficient') return text.errInsufficient
    if (validationError === 'unknown-balance') return text.unknownBalance
    if (validationError === 'self') return text.errSelf
    if (validationError === 'no-gas') return text.errNoGas
    return text.errGeneric
  }, [locked, text, validationError])

  const handleMax = useCallback(() => {
    const balance = balances[token]
    if (balance === null || balance === undefined) {
      logger.info(`max blocked: balance unknown for ${token}`, TAG)
      return
    }
    // Saldo ≤ reserva de gas: no hay monto utilizable (V9).
    if (isNative && balance <= gasReserveWei) {
      logger.info(`max blocked: ${balance.toString()} wei <= gas reserve ${gasReserveWei.toString()}`, TAG)
      return
    }
    const usable = isNative ? balance - gasReserveWei : balance
    setAmount(formatTokenAmount(usable, decimals, decimals))
  }, [balances, decimals, gasReserveWei, isNative, token])

  const handleSend = useCallback(async () => {
    if (!walletClient || validationError || parsedAmount === null) {
      logger.info(
        `send blocked: signer=${walletClient ? 'yes' : 'NO'} validation=${validationError ?? 'none'} amount=${parsedAmount === null ? 'null' : parsedAmount.toString()} token=${selected?.symbol ?? '?'}`, TAG,
      )
      return
    }
    logger.info(
      `send start: token=${selected?.symbol ?? '?'} native=${isNative} to=${to.trim()} amount=${parsedAmount.toString()}`, TAG,
    )
    setSending(true)
    setSendError(null)
    try {
      const destination = getAddress(to.trim()) as `0x${string}`
      const hash = isNative
        ? await walletClient.sendTransaction({ to: destination, value: parsedAmount, account: address as `0x${string}` } as never)
        : await walletClient.writeContract({
            address: selected!.address!, abi: ERC20_ABI, functionName: 'transfer',
            args: [destination, parsedAmount], account: address as `0x${string}`,
          } as never)
      setTxHash(hash)
      setAmount('')
      setTo('')
      await loadBalances()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = (error as { code?: number })?.code
      logger.error(`send failed: code=${code ?? 'none'} message=${message}`, TAG)
      setSendError(code === 4001 || /rejected/i.test(message) ? text.errCancelled : text.errGeneric)
    } finally {
      setSending(false)
    }
  }, [address, isNative, loadBalances, parsedAmount, selected, text, to, validationError, walletClient])

  const canSend = !locked && !sending && !validationError && parsedAmount !== null
  const canUnlink = wallets.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="wallet-panel" className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription className="sr-only">{text.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {address && (
            <div className="flex items-center justify-between gap-2 rounded border p-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{text.address}</p>
                <p className="font-mono text-sm break-all" data-testid="wallet-panel-address">{checksummed(address)}</p>
              </div>
              <Button variant="outline" size="sm" data-testid="wallet-panel-copy" onClick={() => { void handleCopy() }}>
                {copied ? text.copied : text.copy}
              </Button>
            </div>
          )}

          <Tabs value={tab} onValueChange={handleTabChange}>
            {/*
              Pestañas de ancho natural según su título (no todas iguales) que pasan a
              otra fila cuando no caben: así se evita el scrollbar horizontal y que unas
              se monten sobre otras. `h-auto min-h-10` deja crecer la barra; `shrink-0`
              evita que una etiqueta larga se comprima.
            */}
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
              {tabs.map((value) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
                  data-testid={`wallet-panel-tab-${value}`}
                >
                  {text[value]}
                </TabsTrigger>
              ))}
            </TabsList>

            {showAccounts && (
              <TabsContent value="accounts">
                <ul className="space-y-3">
                  {wallets.map((wallet) => (
                    <li key={wallet.address} data-testid={`wallet-${wallet.address}`} className="rounded-md border p-3">
                      {renderWallet ? renderWallet(wallet) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-mono break-all">{shortAddress(wallet.address)}</span>
                            <div className="flex items-center gap-1">
                              {wallet.isConnected && <Badge variant="secondary" className="text-[10px]">{text.connected}</Badge>}
                              {wallet.isInApp && <Badge variant="outline" className="text-[10px]">in-app</Badge>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {wallet.isConnected && onDisconnect && (
                              <Button variant="outline" size="sm" data-testid={`disconnect-${wallet.address}`}
                                onClick={() => void onDisconnect()}>{text.disconnect}</Button>
                            )}
                            {onUnlink && (
                              <Button variant="outline" size="sm" disabled={!canUnlink}
                                title={canUnlink ? undefined : text.lastHint} data-testid={`unlink-${wallet.address}`}
                                onClick={() => canUnlink && void onUnlink(wallet.address)}>{text.unlink}</Button>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {accountsActions && (
                  <div className="mt-3 space-y-2" data-testid="wallet-panel-accounts-actions">
                    {accountsActions}
                  </div>
                )}
              </TabsContent>
            )}

            {showBalances && (
              <TabsContent value="balances">
                <ul className="divide-y rounded border" data-testid="wallet-panel-balances">
                  {tokens.map((item) => (
                    <li key={item.symbol} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{item.symbol}</span>
                      <span className="font-mono" data-testid={`wallet-panel-balance-${item.symbol}`}>
                        {loadingBalances && !balances[item.symbol] ? '…' : formatTokenAmount(balances[item.symbol] ?? null, item.decimals)}
                      </span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            )}

            {showReceive && (
              <TabsContent value="receive" className="space-y-2 text-center">
                <div className="inline-block rounded bg-white p-3" data-testid="wallet-panel-qr">
                  <QRCodeSVG value={checksummed(address!)} size={148} />
                </div>
                <p className="text-xs text-muted-foreground">{text.receiveHint}</p>
              </TabsContent>
            )}

            {showSend && (
              <TabsContent value="send" className="space-y-2 rounded border p-3">
                {locked && (
                  <div className="space-y-2">
                    <p className="text-sm text-amber-700" data-testid="wallet-panel-locked">{text.needWallet}</p>
                    {onRequestUnlock && (
                      <Button variant="outline" size="sm" data-testid="wallet-panel-unlock" onClick={onRequestUnlock}>
                        {text.unlock}
                      </Button>
                    )}
                  </div>
                )}
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{text.token}</span>
                  <select data-testid="wallet-panel-token" className="w-full rounded border px-2 py-1 text-sm"
                    value={token} onChange={(event) => setToken(event.target.value)}>
                    {tokens.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{text.destination}</span>
                  <Input data-testid="wallet-panel-to" value={to} onChange={(event) => setTo(event.target.value)} placeholder="0x…" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{text.amount}</span>
                  <div className="flex gap-2">
                    <Input data-testid="wallet-panel-amount" value={amount} inputMode="decimal"
                      onChange={(event) => setAmount(event.target.value)} />
                    <Button variant="outline" size="sm" data-testid="wallet-panel-max" onClick={handleMax}>{text.max}</Button>
                  </div>
                </label>
                {errorText && <p className="text-sm text-amber-700" data-testid="wallet-panel-error">{errorText}</p>}
                {validationError === 'unknown-balance' && (
                  <Button variant="outline" size="sm" data-testid="wallet-panel-refresh" onClick={() => { void loadBalances() }}>
                    {text.refresh}
                  </Button>
                )}
                {sendError && <p className="text-sm text-red-700" data-testid="wallet-panel-send-error">{sendError}</p>}
                {txHash && (
                  <p className="text-sm text-green-700" data-testid="wallet-panel-sent">
                    {text.done}:{' '}
                    <a className="underline" href={explorerTxUrl(txHash, network, explorerBase)} target="_blank" rel="noopener noreferrer">{text.viewTx}</a>
                  </p>
                )}
                <Button data-testid="wallet-panel-send" onClick={() => { void handleSend() }} disabled={!canSend}>
                  {sending ? text.sending : text.sendNow}
                </Button>
              </TabsContent>
            )}

            {showCollectibles && (
              <TabsContent value="collectibles" className="space-y-2">
                {nfLoading && <p className="text-sm text-muted-foreground">…</p>}
                {nfts !== null && nfts.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground" data-testid="wallet-panel-no-nfts">
                      {nftsError ? text.nftsError : text.noNfts}
                    </p>
                    {nftsError && (
                      <Button variant="outline" size="sm" data-testid="wallet-panel-load-nfts" onClick={() => { void loadNfts() }}>
                        {text.retryNfts}
                      </Button>
                    )}
                  </div>
                )}
                {nfts !== null && nfts.length > 0 && (
                  <ul className="grid grid-cols-3 gap-2" data-testid="wallet-panel-nfts">
                    {nfts.map((nft, index) => (
                      <li key={`${nft.name || 'nft'}-${index}`} className="text-center text-xs">
                        {nft.image && <img src={nft.image} alt={nft.name || ''} referrerPolicy="no-referrer" loading="lazy" className="mx-auto h-16 w-16 rounded object-cover" />}
                        <span className="block truncate">{nft.name || nft.collection || '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {address && (
                  <a className="text-xs underline text-muted-foreground" href={explorerAddressUrl(address, network, explorerBase)}
                    target="_blank" rel="noopener noreferrer">Explorer</a>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{text.close}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
