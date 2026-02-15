import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import { usePathname } from 'next/navigation'

import './globals.css'

import RootLayoutClient from './RootLayoutClient'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  weight: ['300', '400', '500'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Learn Through Games',
  description: 'Learn Through Games',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} antialiased`}
    >
      <body>
	<RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  )
}
