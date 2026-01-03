import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Exolar QA",
  description: "Exolar QA: The Intelligent Horizon for Agentic Testing",
  generator: "v0.app",
  icons: {
    icon: "/branding/favicon.png",
    apple: "/branding/logo-icon.png",
  },
  openGraph: {
    images: [
      {
        url: "/branding/og-image.png",
        width: 1200,
        height: 630,
        alt: "Exolar QA Dashboard",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
