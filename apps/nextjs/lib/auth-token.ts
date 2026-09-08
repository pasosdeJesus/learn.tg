'use client'

// R-#227: fuente única del token de API del navegador.
//
// Tras un login SIWE, el token de API es el DEDICADO (256 bits) que
// `authorize()` guarda en `billetera_usuario.token` y que el cliente obtiene
// de `GET /api/auth/token` (session cookie) en `ConnectWalletButton`. El CSRF
// de NextAuth NO es una credencial de API: solo queda como respaldo legacy
// (p. ej. si el endpoint /api/auth/token no está disponible en un despliegue
// antiguo).
import { getCsrfToken } from 'next-auth/react'

const AUTH_TOKEN_KEY = 'learn.tg.authToken'

export function getStoredApiToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

/** Token de API dedicado si existe; si no, CSRF legacy. */
export async function getApiToken(): Promise<string | null> {
  return getStoredApiToken() || (await getCsrfToken()) || null
}

/** Devuelve la query string "&walletAddress=X&token=Y" para llamadas API. */
export function apiAuthQuery(address: string, token: string): string {
  return `&walletAddress=${encodeURIComponent(address)}&token=${encodeURIComponent(token)}`
}
