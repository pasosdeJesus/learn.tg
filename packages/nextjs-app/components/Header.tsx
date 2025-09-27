"use client"

import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useConnect } from "wagmi"
import { injected } from "wagmi/connectors"

export default function Header({ lang = "en" }) {
  const [hideConnectBtn, setHideConnectBtn] = useState(false)
  const { connect } = useConnect()
  const { address, isConnected } = useAccount()
  const { data: session } = useSession()

  useEffect(() => {
    if (window.ethereum && window.ethereum.isMiniPay) {
      setHideConnectBtn(true)
      connect({ connector: injected({ target: "metaMask" }) })
    }
  }, [connect])

  return (
    <header
      className="sticky top-0 z-40 shadow-sm"
      style={{ background: "linear-gradient(90deg,var(--color-primary-200),var(--color-primary-100))" }}
    >
      <div className="container mx-auto flex items-center h-16 gap-4 px-4">
        {/* Logo + Nombre */}
        <a href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center">
            <img src="/logo-learntg.png" alt="logo" className="h-8 w-8 rounded-full" />
          </div>
          <span className="text-white font-semibold">
            {lang === "es" ? "Aprender mediante juegos" : "Learn through games"}
          </span>
        </a>

        {/* Zona derecha */}
        <div className="ml-auto flex items-center gap-4">
          {isConnected && address && session && session.address &&
            session.address == address && (
              <div className="flex h-16 content-center justify-end items-center mr-4">
                <div className="relative">
                  <a href={`/${lang == "es" ? "es" : "en"}/profile`}
                  className="btn px-4 py-2 bg-secondary text-white rounded hover:bg-secondary-200"
              >
                    {lang == "es" ? "Perfil" : "Profile"}
                  </a>
                </div>
              </div>
          )}
         {/* 
            <div className="hidden md:block w-64 relative">
              <input
                className="w-full rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                placeholder={lang === "es" ? "Buscar cursos..." : "Search courses..."}
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                {lang === "es" ? "Buscar" : "Search"}
              </button>
            </div>
            */} 
          {/* Botón de conexión Wallet */}
          {!hideConnectBtn && (
            <ConnectButton
              showBalance={{ smallScreen: false, largeScreen: false }}
            />
          )}
        </div>
      </div>
    </header>
  )
}
