"use client"

import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useConnect } from "wagmi"
import { injected } from "wagmi/connectors"

import ProfileEdit from './ProfileEdit';

export default function Header({lang = "en"}) {
  const [hideConnectBtn, setHideConnectBtn] = useState(false)
  const { connect } = useConnect()
  const { address, isConnected } = useAccount()
  const { data: session } = useSession()

  useEffect(() => {
    if (window.ethereum && window.ethereum.isMiniPay) {
      setHideConnectBtn(true)
      connect({ connector: injected({ target: "metaMask" }) })
    }
  }, [])

  return (
    <>
      <div className="fixed top-0 left-0 w-full bg-primary-200 z-20 flex items-center">
        <div className="container flex items-center justify-between h-25">
          <a href="/" className="ml-2" active-class="active">
            <div className="relative z-30 flex flex-col items-center gap-1 mb-1 lg:mb-0">
              <img src="/logo-learntg.png" className="rounded-full h-14 w-14 flex items-center justify-center" alt="imglogo" />
              <h6 className="circular-text text-secondary-100 font-bold">
                <span className="text-secondary font-bold">
                  { lang == "es" ? 
                    "Aprender mediante juegos" :
                    "Learn through games"
                  }
                </span>
              </h6>
            </div>
          </a>
        </div>
        {isConnected && address && session && session.address &&
         session.address == address && (
          <div className="flex h-16 content-center justify-end items-center mr-4">
            <div className="relative">
              <a href={`/${lang}/profile`}
                className="btn px-4 py-2 bg-secondary-100 text-white rounded hover:bg-secondary-200"
              >
                Profile
              </a>
            </div>
          </div>
        )}
        { !hideConnectBtn && (
            <div className="flex h-16 content-center justify-end">
              <ConnectButton
                showBalance={{
                  smallScreen: false,
                  largeScreen: false,
                }}
              />
            </div>
        )}
      </div>
    </>
  )
}
