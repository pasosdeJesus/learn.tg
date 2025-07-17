"use client"

import React, { useEffect, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useConnect } from "wagmi"
import { injected } from "wagmi/connectors"
import ProfileEdit from './ProfileEdit';

export default function Header({lang = "en"}) {
  const [hideConnectBtn, setHideConnectBtn] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const { connect } = useConnect()
  const { address, isConnected } = useAccount()

  useEffect(() => {
    if (window.ethereum && window.ethereum.isMiniPay) {
      setHideConnectBtn(true)
      connect({ connector: injected({ target: "metaMask" }) })
    }
  }, [])

  const handleEditProfile = () => {
    setShowMenu(false)
    // Optionally, trigger ProfileEdit modal or navigation here
    // For now, ProfileEdit is always rendered below
  }

  const handleLogout = () => {
    setShowMenu(false)
    // Implement logout logic here if needed
    // For RainbowKit, disconnect is handled elsewhere
  }

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
        {isConnected && address ? (
          <div className="flex h-16 content-center justify-end items-center mr-4">
            <div className="relative">
              <button
                className="px-4 py-2 bg-secondary-100 text-white rounded hover:bg-secondary-200"
                onClick={() => setShowMenu((v) => !v)}
              >
                Menu
              </button>
              {showMenu && (
                <ul className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-50">
                  <li>
                    <button
                      className="block w-full text-left px-4 py-2 hover:bg-primary-100"
                      onClick={handleEditProfile}
                    >
                      Edit Profile
                    </button>
                  </li>
                  <li>
                    <button
                      className="block w-full text-left px-4 py-2 hover:bg-primary-100"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </li>
                  {/* Add more menu options here */}
                </ul>
              )}
            </div>
          </div>
        ) : (
          !hideConnectBtn && (
            <div className="flex h-16 content-center justify-end">
              <ConnectButton
                showBalance={{
                  smallScreen: false,
                  largeScreen: true,
                }}
              />
            </div>
          )
        )}
      </div>
      <ProfileEdit />
    </>
  )
}
