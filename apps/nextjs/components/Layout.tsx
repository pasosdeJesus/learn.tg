'use client'

import * as React from 'react'
import { FC, ReactNode } from 'react'
import Footer from './Footer'
import Header from './Header'

interface Props {
  children: ReactNode
}
const Layout: FC<Props> = ({ children }) => {
  let lang = 'en'
  if (typeof window !== 'undefined') {
    const purl = window.location.href.split('/')
    lang = purl.length > 3 ? purl[3] : 'en'
  }
  return (
    <>
      <div className="bg-gypsum overflow-hidden flex flex-col min-h-screen">
        <Header lang={lang} />
        <main role="main">{children}</main>
        <Footer lang={lang} />
      </div>
    </>
  )
}

export default Layout
