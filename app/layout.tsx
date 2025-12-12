import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const telma = localFont({
  src: [
    { path: "/fonts/Telma-Regular.otf", weight: "400", style: "normal" },
    { path: "/fonts/Telma-Medium.otf", weight: "500", style: "normal" },
    { path: "/fonts/Telma-Bold.otf", weight: "700", style: "normal" },
    { path: "/fonts/Telma-Light.otf", weight: "300", style: "normal" },
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
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${telma.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
