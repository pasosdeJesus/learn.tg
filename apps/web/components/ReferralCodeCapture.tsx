'use client'

// Captura global de ?ref=CODE en cualquier página (https://github.com/pasosdeJesus/learn.tg/issues/163 §2.3): si el
// enlace de invitación incluye el código como query param (p.ej. los enlaces
// al curso Web3 & UBI desde /ref, o un enlace compartido), lo valida y lo
// guarda en localStorage como pendiente — así sobrevive al cambio de
// navegador (navegador normal → navegador de la billetera web3, que tienen
// localStorage distintos) y el claim ocurre al conectar (ConnectWalletButton).
import { useEffect } from 'react'
import axios from 'axios'

export function ReferralCodeCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (!ref) return
      const normalized = String(ref).toUpperCase()
      // No pisa un código ya pendiente (p.ej. llegó antes por /ref/{CODE})
      if (localStorage.getItem('learn.tg.pendingReferralCode')) return
      axios.get(`/api/referral/lookup?code=${encodeURIComponent(normalized)}`)
        .then((res) => {
          if (res.data?.valid) localStorage.setItem('learn.tg.pendingReferralCode', normalized)
        })
        .catch(() => { /* código inválido: no guardar */ })
    } catch { /* ignore */ }
  }, [])

  return null
}
