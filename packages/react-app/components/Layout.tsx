"use client"

import { FC, ReactNode } from "react";

import Footer from "./Footer";
import Header from "./Header";

interface Props {
      children: ReactNode;
}
const Layout: FC<Props> = ({ children }) => {

  let idioma = "en"
  if (typeof window !== "undefined") {
    let phref = window.location.href.split("/")
    let ruta = phref.length > 2 && phref[phref.length - 1] == "" ?
      phref[phref.length - 2] : phref[phref.length - 1]
    idioma = phref.length > 2 && phref[phref.length - 1] == "" ?
      phref[phref.length - 3] : phref[phref.length - 2]
  }

  return (
    <>
     <div className="bg-gypsum overflow-hidden flex flex-col min-h-screen">
       <Header lang={idioma} />
       <div>
         {children}
       </div>
       <Footer lang={idioma} />
    </div>
    </>
  );
};

export default Layout
