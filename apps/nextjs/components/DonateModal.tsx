'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { type Address, formatUnits } from 'viem'
import axios from 'axios'
import { erc20Abi, parseUserAmountSafe, formatDisplay, safeParseFloat } from '@learn-tg/rewards/lib/donate-utils'
import { useGasEstimation } from '@/lib/hooks/useGasEstimation'
import { useContractPayment } from '@/lib/hooks/useContractPayment'
import { TransactionStatus } from '@/components/ui/TransactionStatus'
import { GasInsufficientPanel } from '@/components/GasInsufficientPanel'
// donation-target vive en el motor gdcluster (https://gitlab.com/pasosdeJesus/m/-/work_items/35 Fase 3); los componentes
// client aún lo importan desde allí (puente de migración, Fase 4).
import {
  type PaymentTarget,
  type CourseDonation,
  type DistributionItem,
  getTargetCopy,
  getTargetRecipient,
  getTargetEndpoint,
  getDistributionFromResponse,
  getCampaignConfig,
  getCampaignDonationToken,
  getCampaignDonationTokenKeys,
} from '@learn-tg/gdcluster/lib/donation-target'
import { getTokenUsdPrice } from '@learn-tg/gdcluster/lib/token-prices'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'

const SLEARN_DECIMALS = 2
const SLEARN_RATE = 22 // 1 USDT = 22 SLEARN

export interface DonateModalProps {
  courseId?: number | null
  target?: PaymentTarget
  isOpen: boolean
  onClose: () => void
  onSuccess?: (data: { increment?: number; usdtHash?: string; slearnHash?: string }) => void
  lang?: string
}

export function DonateModal({ courseId, target, isOpen, onClose, onSuccess, lang }: DonateModalProps) {
  // Derive effective target: explicit target or wrap legacy courseId
  const effectiveTarget: PaymentTarget | null = target || (courseId != null && courseId > 0
    ? { type: 'course-donation', courseId } as CourseDonation
    : null)

  const isCampaign = effectiveTarget?.type === 'campaign-donation'
  const [receiveCashback, setReceiveCashback] = useState(true)
  const [pdjSharePct, setPdjSharePct] = useState(0)
  const [comment, setComment] = useState('')
  const [payTokenKey, setPayTokenKey] = useState('usdt')
  const [payPrice, setPayPrice] = useState<number | null>(1)
  const tCopy = effectiveTarget
    ? getTargetCopy(lang || 'en', effectiveTarget, isCampaign ? { receiveCashback, pdjSharePct } : {})
    : null
  const rewardPct = tCopy?.rewardPct ?? 0
  const recipientAddress = (effectiveTarget
    ? getTargetRecipient(effectiveTarget)
    : process.env.NEXT_PUBLIC_ADDRESS || '') as Address | undefined

  const { address: rawAddress } = useAuthAddress()
  const address = rawAddress as Address | undefined
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [usdtDecimals, setUsdtDecimals] = useState<number>(+(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6))
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n)
  const [slearnBalance, setSlearnBalance] = useState<bigint>(0n)
  const [celoBalance, setCeloBalance] = useState<bigint>(0n)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [amount, setAmount] = useState('')
  const [slearnAmount, setSlearnAmount] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [resultTxHash, setResultTxHash] = useState<string | null>(null)
  const [resultCashback, setResultCashback] = useState(0)
  const [resultDistribution, setResultDistribution] = useState<DistributionItem[]>([])

  const envUsdtAddress = (process.env.NEXT_PUBLIC_USDT_ADDRESS as Address) || undefined
  const slearnAddress = (process.env.NEXT_PUBLIC_SLEARN_ADDRESS as Address) || undefined
  const cId = effectiveTarget?.type === 'course-donation' ? effectiveTarget.courseId : null

  // Tokens de pago de un destino `campaign` (REQ/223): mainnet = cfg.donationTokens
  // (USDT/USDC/XAUt0), testnet = cfg.testnet (USDT Mock). La dirección/decimals
  // se resuelve del registro (con override NEXT_PUBLIC_USDT_ADDRESS en USDT).
  const campaignCfg = isCampaign && effectiveTarget?.type === 'campaign-donation'
    ? getCampaignConfig(effectiveTarget.slug)
    : undefined
  const payKeys = (campaignCfg ? getCampaignDonationTokenKeys(campaignCfg, IS_PRODUCTION) : [])
    // CELO nativo: el pago del modal es ERC-20; la recepción de CELO funciona
    // vía el backend (verify por valor) pero la UI nativa queda pendiente.
    .filter((k) => k !== 'celo')
  const activePayKey = campaignCfg && payKeys.includes(payTokenKey) ? payTokenKey : (payKeys[0] ?? 'usdt')
  const activeToken = campaignCfg ? getCampaignDonationToken(campaignCfg, activePayKey, IS_PRODUCTION) : undefined
  const usdtAddress = campaignCfg ? (activeToken?.address as Address | undefined) : envUsdtAddress

  const usdtNum = safeParseFloat(amount)
  const slearnNum = safeParseFloat(slearnAmount)
  // Valor en USD: tokens pegados = cantidad; XAUt0 = cantidad × precio (CoinGecko)
  const totalUSDTValue = campaignCfg ? usdtNum * (payPrice ?? 0) : usdtNum + (slearnNum / SLEARN_RATE)
  const estimatedReward = totalUSDTValue * (rewardPct / 100) * SLEARN_RATE

  // Precio USD del token activo en campañas (solo los no pegados consultan API)
  useEffect(() => {
    let cancelled = false
    if (!campaignCfg || !activeToken || activeToken.peggedUsd) {
      setPayPrice(1)
      return () => { cancelled = true }
    }
    getTokenUsdPrice({ key: activeToken.key, peggedUsd: activeToken.peggedUsd, coingeckoId: activeToken.coingeckoId })
      .then((p) => { if (!cancelled) setPayPrice(p) })
      .catch(() => { if (!cancelled) setPayPrice(null) })
    return () => { cancelled = true }
  }, [campaignCfg, activeToken, activePayKey])

  const { gasState, estimating, diag } = useGasEstimation({
    amount, slearnAmount, usdtDecimals,
    address, walletClient, publicClient,
    backendWalletAddress: recipientAddress, usdtAddress, slearnAddress,
    courseId: cId, celoBalance,
    balanceLoaded: dataLoaded,
  })
  // Diagnóstico de gas visible en el panel con ?diag=1 (depuración dev site)
  const gasDiagMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('diag')

  const {
    state: paymentState,
    error: paymentError,
    needsApproval,
    execute: executePayment,
    reset: resetPayment,
  } = useContractPayment({
    amount, slearnAmount, usdtDecimals, slearnDecimals: SLEARN_DECIMALS,
    address, walletClient, publicClient,
    backendWalletAddress: recipientAddress, usdtAddress, slearnAddress,
    courseId: cId, usdtBalance, slearnBalance, lang,
    onBackendCallback: async (params) => {
      const endpoint = effectiveTarget ? getTargetEndpoint(effectiveTarget) : '/api/add-donation'
      const payload: Record<string, unknown> = {
        walletAddress: params.walletAddress, token: params.token,
        donationAmountUSD: params.donationAmountUSD,
        slearnDonationAmount: params.slearnDonationAmount,
        usdtHash: params.usdtHash, slearnHash: params.slearnHash,
      }
      if (effectiveTarget?.type === 'course-donation') {
        payload.courseId = params.courseId
      }
      if (effectiveTarget?.type === 'cluster-donation') {
        payload.clusterWallet = effectiveTarget.clusterWallet
      }
      if (effectiveTarget?.type === 'country-donation') {
        payload.countryCode = effectiveTarget.countryCode
      }
      if (effectiveTarget?.type === 'campaign-donation') {
        payload.campaign = effectiveTarget.slug
        payload.payToken = activePayKey
        payload.receiveCashback = receiveCashback
        payload.pdjSharePct = pdjSharePct
        if (comment.trim()) payload.comment = comment.trim()
      }
      const { data } = await axios.post(endpoint, payload)
      return data
    },
    onSuccess: (data) => {
      if (data?.slearnHash) setResultTxHash(data.slearnHash)
      else if (data?.usdtHash) setResultTxHash(data.usdtHash)
      if (data?.increment && data.increment > 0) setResultCashback(data.increment)
      if (data?.distribution) {
        setResultDistribution(getDistributionFromResponse(data, lang || 'en'))
      }
      setShowResult(true)
    },
  })

  const reset = useCallback(() => {
    setAmount('')
    setSlearnAmount('')
    setShowResult(false)
    setResultTxHash(null)
    setResultCashback(0)
    setReceiveCashback(true)
    setPdjSharePct(0)
    setComment('')
    resetPayment()
  }, [resetPayment])

  // On success → show result screen instead of toast
  const handleResultOk = useCallback(() => {
    onSuccess?.({ increment: resultCashback, usdtHash: resultTxHash || undefined, slearnHash: resultTxHash || undefined })
    reset()
    onClose()
  }, [onSuccess, resultCashback, resultTxHash, reset, onClose])

  const closeAll = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const loadData = useCallback(async () => {
    if (!isOpen || !address || !publicClient || !usdtAddress || !recipientAddress) return
    setDataLoaded(false)
    // forno falla intermitentemente (igual que eth_estimateGas): reintentar una
    // vez y cargar saldos parciales (allSettled) — un fallo de getBalance no
    // debe tumbar la carga ni provocar un falso "no-gas" (celo=0 sin cargar).
    const attemptLoad = async () => {
      const promises: Promise<any>[] = [
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'decimals' }).catch(() => BigInt(usdtDecimals)),
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        publicClient.getBalance({ address }),
      ]
      if (slearnAddress) {
        promises.push(
          publicClient.readContract({ address: slearnAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        )
      }
      const results = await Promise.allSettled(promises)
      const val = (i: number) => results[i]?.status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<any>).value : null
      const decimals = val(0)
      const usdtBal = val(1)
      const celoBal = val(2)
      const slearnBal = slearnAddress ? val(3) : null
      if (decimals != null) setUsdtDecimals(Number(decimals))
      if (usdtBal != null) setUsdtBalance(usdtBal)
      if (celoBal != null) setCeloBalance(celoBal)
      if (slearnBal != null) setSlearnBalance(slearnBal)
      // dataLoaded solo cuando el saldo CELO se leyó: la estimación de gas
      // requiere un saldo real (celoBalance=0 por fallo RPC → falso no-gas).
      if (celoBal != null) setDataLoaded(true)
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[DonateModal] balance read #${i} failed:`, (r as PromiseRejectedResult).reason?.message || r.reason)
        }
      })
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await attemptLoad()
        return
      } catch (e: any) {
        console.error('[DonateModal] loadData failed:', e?.message || String(e))
        if (attempt === 0) await new Promise((r) => setTimeout(r, 600))
      }
    }
  }, [isOpen, address, publicClient, usdtAddress, recipientAddress, usdtDecimals, slearnAddress])

  useEffect(() => { loadData() }, [loadData])

  if (!isOpen || !effectiveTarget) return null

  const t = createComponentT(lang || 'en', {
    en: {
      connectSign: 'Connect and sign with your wallet to donate',
      yourBalance: 'Your USDT Balance',
      yourSlearnBalance: 'Your SLEARN Balance',
      yourCelo: 'Your CELO (gas)',
      enoughGas: 'Enough gas estimated',
      noGas: 'Not enough gas for transaction',
      noGasHint: 'From guide 3 of the Web3 & UBI course you can request Learn.tg-UBI paid in CELO to cover gas costs.',
      gasWarn: 'Gas estimation failed, proceed at your own risk',
      estimating: 'estimating...',
      amountLabel: 'Amount (USDT)',
      slearnAmountLabel: 'Amount (SLEARN)',
      enterAmount: 'Enter amount',
      max: 'Max',
      clear: 'Clear',
      cancel: 'Cancel',
      processing: 'Processing...',
      donate: 'Donate',
      missingContract: 'Missing contract env vars',
      estimatedReward: 'Estimated SLEARN reward',
      estimatedRewardValue: '~{{0}} SLEARN',
      campaignOptionsTitle: 'Donation options (this campaign)',
      campaignCashbackLabel: 'Receive 10% back as SLEARN cashback',
      campaignToPdJLabel: 'Also donate a percentage to pdJ',
      campaignCustomPct: 'Custom %',
      commentLabel: 'Comment (optional)',
      commentPlaceholder: 'e.g. provenance of the funds (cash collected)',
      payWith: 'Pay with',
      balanceOfToken: 'Your {{0}} balance',
      amountLabelToken: 'Amount ({{0}})',
      tokenRate: '1 {{0}} ≈ ${{1}}',
      priceUnavailable: 'Price unavailable — cannot compute the USD value. Try again later.',
      donateToCourse: 'Donate to course',
      resultTitle: '🎉 Donation completed!',
      resultCashback: '+{{0}} SLEARN cashback',
      resultTx: 'View transaction',
      resultOk: 'OK',
    },
    es: {
      connectSign: 'Conecta y firma con tu billetera para donar',
      yourBalance: 'Tu saldo USDT',
      yourSlearnBalance: 'Tu saldo SLEARN',
      yourCelo: 'Tu CELO (gas)',
      enoughGas: 'Gas suficiente estimado',
      noGas: 'Gas insuficiente para la transaccion',
      noGasHint: 'Desde la guia 3 del curso Web3 & UBI puedes pedir Learn.tg-UBI que se paga en CELO y te permite cubrir costos de gas.',
      gasWarn: 'Fallo al estimar gas, continue bajo su propio riesgo',
      estimating: 'estimando...',
      amountLabel: 'Monto (USDT)',
      slearnAmountLabel: 'Monto (SLEARN)',
      enterAmount: 'Ingresa monto',
      max: 'Todo',
      clear: 'Limpiar',
      cancel: 'Cancelar',
      processing: 'Procesando...',
      donate: 'Donar',
      missingContract: 'Faltan variables de entorno del contrato',
      estimatedReward: 'Recompensa SLEARN estimada',
      estimatedRewardValue: '~{{0}} SLEARN',
      campaignOptionsTitle: 'Opciones de la donación (esta campaña)',
      campaignCashbackLabel: 'Recibir 10% de vuelta como cashback en SLEARN',
      campaignToPdJLabel: 'Donar además un porcentaje a pdJ',
      campaignCustomPct: '% personalizado',
      commentLabel: 'Comentario (opcional)',
      commentPlaceholder: 'p. ej. procedencia de los fondos (efectivo recibido)',
      payWith: 'Pagar con',
      balanceOfToken: 'Tu saldo de {{0}}',
      amountLabelToken: 'Monto ({{0}})',
      tokenRate: '1 {{0}} ≈ ${{1}}',
      priceUnavailable: 'Precio no disponible — no se puede calcular el valor USD. Intenta más tarde.',
      donateToCourse: 'Donar al curso',
      resultTitle: '🎉 ¡Donación completada!',
      resultCashback: '+{{0}} SLEARN de cashback',
      resultTx: 'Ver transacción',
      resultOk: 'OK',
    },
  })

  const usdtBalFmt = formatDisplay(usdtBalance, usdtDecimals)
  const slearnBalFmt = formatDisplay(slearnBalance, SLEARN_DECIMALS)
  const celoBalFmt = formatDisplay(celoBalance, 18)
  // Sin CELO (menos de 0.01): el modal muestra la guía de inmediato
  const noCelo = celoBalance < 10_000_000_000_000_000n
  const hasAnyAmount = usdtNum > 0 || slearnNum > 0
  const isSubmitting = paymentState === 'approving' || paymentState === 'paying' || paymentState === 'confirming'
  const donateDisabled = isSubmitting || !hasAnyAmount ||
    parseUserAmountSafe(amount, usdtDecimals) > usdtBalance ||
    parseUserAmountSafe(slearnAmount, SLEARN_DECIMALS) > slearnBalance ||
    (isCampaign && payPrice == null && usdtNum > 0) ||
    (hasAnyAmount && gasState === 'no-gas')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto mx-4">
        {showResult ? (
          <div className="text-center py-6">
            <button onClick={handleResultOk} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            <h2 className="text-xl font-semibold mb-4">{t('resultTitle')}</h2>
            {resultCashback > 0 && (
              <p className="text-lg text-green-700 font-medium mb-4">{t('resultCashback', resultCashback.toFixed(2))}</p>
            )}
            {/* Distribution breakdown from actual on-chain data */}
            {resultDistribution.length > 0 && (
              <div className="text-left text-sm space-y-1 mb-4 bg-gray-50 rounded-lg p-3">
                {resultDistribution.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-700">{item.destination}</span>
                    <span className="font-mono font-medium">{Number(item.amount).toFixed?.(2) ?? item.amount} {item.crypto.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
            {resultTxHash && (() => {
              const explorerBase = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'https://celo.blockscout.com' : 'https://celo-sepolia.blockscout.com'
              const txLink = `${explorerBase}/tx/${resultTxHash}`
              return (
                <a href={txLink} target="_blank" rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 underline break-all mb-6">
                  {t('resultTx')}
                </a>
              )
            })()}
            <button onClick={handleResultOk}
              className="mt-4 w-full rounded px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
              {t('resultOk')}
            </button>
          </div>
        ) : address && walletClient && dataLoaded && (gasState === 'no-gas' || noCelo) ? (
          <GasInsufficientPanel lang={lang || 'en'} onClose={closeAll} diag={gasDiagMode ? diag : null} />
        ) : (
          <>
            <button onClick={closeAll} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            <h2 className="text-xl font-semibold mb-4">{tCopy?.title || t('donateToCourse')}</h2>

        {(!address || !walletClient) && (
          <div className="text-sm text-red-600 mb-4">{t('connectSign')}</div>
        )}
        {(!recipientAddress || !usdtAddress) && (
          <div className="text-sm text-red-600 mb-4">{t('missingContract')}</div>
        )}

        <div className="space-y-2 text-sm">
          <div>{isCampaign && activeToken ? t('balanceOfToken', activeToken.symbol) : t('yourBalance')}: <span className="font-mono">{usdtBalFmt}</span></div>
          {!isCampaign && slearnAddress && (
            <div>{t('yourSlearnBalance')}: <span className="font-mono">{slearnBalFmt}</span></div>
          )}
          <div>{t('yourCelo')}: <span className="font-mono">{celoBalFmt}</span></div>
          {hasAnyAmount && (
            <>
              <div className={gasState === 'ok' ? 'text-green-600' : gasState === 'no-gas' ? 'text-red-600' : gasState === 'warn' ? 'text-yellow-600' : 'text-gray-500'}>
                {gasState === 'ok' && t('enoughGas')}
                {gasState === 'no-gas' && t('noGas')}
                {gasState === 'warn' && t('gasWarn')}
                {estimating && <span className="ml-2 animate-pulse">{t('estimating')}</span>}
              </div>
              {gasState === 'no-gas' && (
                <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded p-2">
                  {t('noGasHint')}
                </div>
              )}
            </>
          )}
        </div>

        {isCampaign && payKeys.length > 1 && campaignCfg && (
          <div className="mt-4 text-sm">
            <div className="mb-1 font-medium">{t('payWith')}</div>
            <div className="flex flex-wrap items-center gap-2">
              {payKeys.map((k) => {
                const tk = getCampaignDonationToken(campaignCfg, k, IS_PRODUCTION)
                if (!tk) return null
                return (
                  <button key={k} type="button" onClick={() => { setPayTokenKey(k); setAmount('') }}
                    className={`px-3 py-1.5 rounded-full border text-xs ${activePayKey === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                    {tk.symbol}
                  </button>
                )
              })}
            </div>
            {activeToken && !activeToken.peggedUsd && (
              <p className={`mt-1 text-xs ${payPrice == null ? 'text-red-600' : 'text-gray-500'}`}>
                {payPrice == null ? t('priceUnavailable') : t('tokenRate', activeToken.symbol, payPrice.toFixed(2))}
              </p>
            )}
          </div>
        )}

        {isCampaign && (
          <div className="mt-4 space-y-3 border border-gray-200 rounded-lg p-3 text-sm">
            <div className="font-medium">{t('campaignOptionsTitle')}</div>
            <div>
              <label htmlFor="donate-comment" className="block text-xs mb-1 text-gray-600">{t('commentLabel')}</label>
              <input id="donate-comment" type="text" maxLength={200}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('commentPlaceholder')}
                className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring focus:border-gray-400" />
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={receiveCashback} onChange={(e) => setReceiveCashback(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600" />
              <span>{t('campaignCashbackLabel')}</span>
            </label>
            <div>
              <div className="mb-1">{t('campaignToPdJLabel')}</div>
              <div className="flex flex-wrap items-center gap-2">
                {[0, 5, 10, 20, 50].map((p) => (
                  <button key={p} type="button" onClick={() => setPdjSharePct(p)}
                    className={`px-2 py-1 rounded border text-xs ${pdjSharePct === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                    {p === 0 ? '0%' : `${p}%`}
                  </button>
                ))}
                <input type="number" min={0} max={100} step={1} value={pdjSharePct}
                  onChange={(e) => setPdjSharePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-20 border rounded px-2 py-1 text-xs" placeholder={t('campaignCustomPct')} />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
          </div>
        )}

        {tCopy?.splitInfo && (
          <div className="mt-4 text-xs bg-yellow-50 border border-yellow-200 rounded p-3">{tCopy.splitInfo}</div>
        )}

        {hasAnyAmount && rewardPct > 0 && totalUSDTValue > 0 && (
          <div className="mt-3 text-xs bg-green-50 border border-green-200 rounded p-3">
            <strong>{tCopy?.rewardLabel || t('estimatedReward')}:</strong> {t('estimatedRewardValue', estimatedReward.toFixed(2))}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="donate-amount" className="block text-sm mb-1">{isCampaign && activeToken ? t('amountLabelToken', activeToken.symbol) : t('amountLabel')}</label>
          <input id="donate-amount" type="number" min="0" step={1 / 10 ** Math.min(usdtDecimals, 6)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-gray-400"
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('enterAmount')} />
          <div className="flex justify-end mt-1 space-x-2 text-xs">
            <button onClick={() => setAmount(Number(formatUnits(usdtBalance, usdtDecimals)).toString())} className="text-blue-600 hover:underline">{t('max')}</button>
            <button onClick={() => setAmount('')} className="text-gray-500 hover:underline">{t('clear')}</button>
          </div>
        </div>

        {!isCampaign && (
        <div className="mt-3">
          <label htmlFor="donate-slearn-amount" className="block text-sm mb-1">{t('slearnAmountLabel')}</label>
          <input id="donate-slearn-amount" type="number" min="0" step={1 / 10 ** SLEARN_DECIMALS}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-gray-400"
            value={slearnAmount} onChange={(e) => setSlearnAmount(e.target.value)} placeholder={t('enterAmount')} />
          <div className="flex justify-end mt-1 space-x-2 text-xs">
            <button onClick={() => setSlearnAmount(Number(formatUnits(slearnBalance, SLEARN_DECIMALS)).toString())} className="text-blue-600 hover:underline">{t('max')}</button>
            <button onClick={() => setSlearnAmount('')} className="text-gray-500 hover:underline">{t('clear')}</button>
          </div>
        </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={closeAll} className="flex-1 border rounded px-4 py-2 text-sm hover:bg-gray-50">{t('cancel')}</button>
          <button onClick={executePayment} disabled={donateDisabled}
            className={`flex-1 rounded px-4 py-2 text-sm font-medium text-white ${donateDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isSubmitting ? t('processing') : t('donate')}
          </button>
        </div>

        {paymentError && (
          <div className="mt-3 text-sm">
            <div className="bg-red-50 border border-red-300 rounded p-3">
              <p className="font-semibold text-red-700 mb-1">{lang === 'es' ? 'Error' : 'Error'}</p>
              <pre className="whitespace-pre-wrap text-red-600 text-xs max-h-32 overflow-y-auto">{paymentError}</pre>
              <button onClick={() => navigator.clipboard.writeText(paymentError)}
                className="mt-1 text-xs text-red-500 underline hover:text-red-700">
                {lang === 'es' ? 'Copiar error' : 'Copy error'}
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}

export default DonateModal
