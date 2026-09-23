'use client'

import * as React from 'react'
import { FC, ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Footer from './Footer'
import Header from './Header'
import { OfflineBanner } from './OfflineBanner'
import { InstallPrompt } from './InstallPrompt'
import { OfflineLibrarySync } from './OfflineDownloadAll'
import { OfflineQueueSync } from './OfflineQueueSync'

interface Props {
  children: ReactNode
}
const Layout: FC<Props> = ({ children }) => {
  // R-#218: lang desde useParams (idéntico server/client). El parseo previo de
  // window.location daba lang distinto en hidratación → footer/header con
  // hrefs inconsistentes (//privacy-policy) y mismatch de hidratación.
  const params = useParams<{ lang?: string }>()
  const lang = (params?.lang as string) || 'en'
  return (
    <>
      <OfflineBanner lang={lang} />
      {/* R-#256: con conexión, guarda en el dispositivo todos los cursos
          accesibles (gratuitos y comprados por esta billetera) para poder leer
          cualquier guía sin conexión, no solo la última visitada. */}
      <OfflineLibrarySync lang={lang} />
      {/* R-#242: drena la cola sin conexión en cualquier página y avisa el
          resultado (antes solo se drenaba dentro de la página del crucigrama). */}
      <OfflineQueueSync lang={lang} />
      <InstallPrompt lang={lang} />
      <div className="bg-gypsum overflow-hidden flex flex-col min-h-screen">
        <Header lang={lang} />
        <main role="main">{children}</main>
        <Footer lang={lang} />
      </div>
    </>
  )
}

export default Layout
