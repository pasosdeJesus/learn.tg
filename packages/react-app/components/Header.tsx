"use client"

/**
 * Based on Header of Celo Composer
 */
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useEffect, useState } from "react"
import { useConnect } from "wagmi"
import { injected } from "wagmi/connectors"

export default function Header() {
  const [hideConnectBtn, setHideConnectBtn] = useState(false)
  const { connect } = useConnect()

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
                    <span style={{ fontFamily: "DM Serif Display" }} className="text-secondary font-bold">Aprender mediante juegos</span>
                  </h6>
                </div>
              </a>
            </div>
            {!hideConnectBtn && (
              <div className="flex h-16 content-center justify-end">
                <ConnectButton
                  showBalance={{
                    smallScreen: false,
                    largeScreen: true,
                  }}
                />
              </div>
            )}
          </div>
        </>
  )
}
