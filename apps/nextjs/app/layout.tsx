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
      <head>
        <meta name="talentapp:project_verification" content="c14dfa236e1c988ed306bf6b45d21e62e8eebfd25a926b942edbd0ff8111ddfefd7f3c9b7c9e35f4988e8d4d5185e4ff783e51f9fefb850ba9900a1fe1fc9bb0"/>
      </head>
      <body>
	<RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  )
}
