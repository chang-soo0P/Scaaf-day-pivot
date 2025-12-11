import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const telma = localFont({
  src: [
    {
      path: "../../public/fonts/Telma-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Telma-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/Telma-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/Telma-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-telma",
})

export const metadata: Metadata = {
  title: "Scaaf Day",
  description: "Your private newsletter inbox with AI summaries and circle discussions",
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fafaf9",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${telma.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
