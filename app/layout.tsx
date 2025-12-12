import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import "./fonts/telma.css" // ← Base64 → woff2 폰트 정의 파일
import { Toaster } from "@/components/ui/toaster"

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
      {/* Telma를 기본 폰트로 지정 */}
      <body className="font-sans antialiased" style={{ fontFamily: "Telma, sans-serif" }}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
