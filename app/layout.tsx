import './globals.css'

import { Inter, Space_Grotesk } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter'
})

const space = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space'
})

export const metadata = {
  title: 'CIC',
  description: 'AI Reply Assistant'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${space.variable}`}
      >
        {children}
      </body>
    </html>
  )
}
