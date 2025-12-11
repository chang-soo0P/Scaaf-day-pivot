"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Newspaper, Inbox, Users } from "lucide-react"

const tabs = [
  { name: "Topics", href: "/topics", icon: Newspaper },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Circles", href: "/circles", icon: Users },
]

function ProfileButton() {
  return (
    <Link
      href="/settings"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
    >
      M
    </Link>
  )
}

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          {/* Left spacer for balance */}
          <div className="w-9" />

          <h1 className="text-lg font-semibold tracking-tight text-foreground">Scaaf Day</h1>

          {/* Right: Profile/Settings button */}
          <ProfileButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-lg flex-1 pb-20">{children}</main>

      {/* Bottom Tab Bar - unchanged */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                <tab.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
                <span className={`text-xs ${isActive ? "font-medium" : "font-normal"}`}>{tab.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
