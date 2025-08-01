"use client"

import React, { FC, ReactNode } from "react"
import Footer from "./Footer"
import Header from "./Header"

interface Props {
  children: ReactNode
}
const Layout: FC<Props> = ({ children }) => {

  let lang = "en"
  if (typeof window !== "undefined") {
    let purl = window.location.href.split("/")
    lang = purl.length > 3 ? purl[3] : "en"
  }
  return (
    <>
      <div className="bg-gypsum overflow-hidden flex flex-col min-h-screen">
        <Header lang={lang} />
        <div className="mt-8">{children}</div>
        <Footer lang={lang} />
      </div>
    </>
  );
};

export default Layout
