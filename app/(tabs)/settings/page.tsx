"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check, LogOut, Flame } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useDailyMissionStore } from "@/lib/daily-mission-store"

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [language, setLanguage] = useState<"en" | "ko">("en")

  const streakCount = useDailyMissionStore((s) => s.streakCount)

  const scaafEmail = "marvin@scaaf.day"

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(scaafEmail)
      setCopied(true)
      toast({
        title: "Email copied",
        description: "You can now paste it into your newsletter settings.",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please try again or copy manually.",
        variant: "destructive",
      })
    }
  }

  const handleLogout = () => {
    // TODO: Integrate with real auth when available (clear tokens, session, etc.)
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    })
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6 pb-24">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and app preferences.</p>
        </div>

        {/* Profile Section */}
        <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            M
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Marvin</span>
            <span className="text-xs text-muted-foreground">you@example.com</span>
            <span className="mt-1 text-xs text-muted-foreground">Profile editing will be available later.</span>
          </div>
        </div>

        {/* Scaaf Email Section */}
        <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Your Scaaf email</h2>
            <p className="text-xs text-muted-foreground">
              Forward your newsletters to this address. Scaaf Day will summarize and organize them for you.
            </p>
          </div>

          <div className="rounded-xl bg-muted px-3 py-2 font-mono text-sm">{scaafEmail}</div>

          <button
            type="button"
            onClick={handleCopyEmail}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy email address
              </>
            )}
          </button>
        </div>

        {/* Language Toggle */}
        <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Language</h2>
            <p className="text-xs text-muted-foreground">
              The app currently uses English by default. Korean support will be added later.
            </p>
          </div>

          <div className="inline-flex rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                language === "en"
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage("ko")}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                language === "ko"
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Korean
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Actual multi-language support will be implemented later.
          </p>
        </div>

        {/* Notification Settings */}
        <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            <p className="text-xs text-muted-foreground">
              Configure how you want to be notified about new summaries and Circle activity. (not
              functional yet.)
            </p>
          </div>

          <div className="space-y-1">
            {["Circle messages", "New summaries", "Weekly activity digest"].map((label) => (
              <div key={label} className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">{label}</span>
                {/* Disabled switch UI */}
                <div className="flex h-5 w-10 items-center rounded-full bg-muted px-1 opacity-50">
                  <div className="h-3.5 w-3.5 rounded-full bg-background" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Stats */}
        <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">This week's activity</h2>
            <p className="text-xs text-muted-foreground">
              A quick overview of how you've been using Scaaf Day this week.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Newsletters read", value: "12" },
              { label: "Highlights created", value: "5" },
              { label: "Shared to Circles", value: "3" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <span className="text-lg font-semibold text-foreground">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Streak line */}
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-foreground">
              {streakCount > 0 ? (
                <>
                  <span className="font-semibold">{streakCount}-day streak</span>
                  <span className="text-muted-foreground"> — keep commenting daily!</span>
                </>
              ) : (
                <span className="text-muted-foreground">Start your streak by leaving a comment today</span>
              )}
            </span>
          </div>
        </div>

        {/* Account Section */}
        <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Account</h2>
            <p className="text-xs text-muted-foreground">Manage your account settings and sign out.</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
