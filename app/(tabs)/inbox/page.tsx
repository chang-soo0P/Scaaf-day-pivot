"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { emailDetailHref } from "@/lib/email-href"
import { cn } from "@/lib/utils"
import { Mail, RefreshCw } from "lucide-react"
import { TodayMissionCard } from "@/components/today-mission-card"
import { useDailyMission } from "@/hooks/use-daily-mission"

type InboxEmailRow = {
  id: string
  from_address: string | null
  subject: string | null
  received_at: string | null
}

type ApiInboxListResponse = { ok: true; items: InboxEmailRow[] } | { ok: false; error?: string }

async function safeReadJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` } as unknown as T
  }
}

function extractNameFromEmail(addr: string) {
  const emailMatch = addr.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const email = emailMatch?.[0] ?? addr
  const name = email.split("@")[0]
  return name || email
}

function formatTime(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleString()
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
      <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
      <div className="mt-2 h-3 w-64 animate-pulse rounded bg-secondary" />
      <div className="mt-3 h-3 w-32 animate-pulse rounded bg-secondary" />
    </div>
  )
}

export default function InboxPage() {
  const router = useRouter()

  const { state: missionState, markCompletionToastShown } = useDailyMission()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<InboxEmailRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const openEmail = useCallback(
    (id: string) => {
      const href = emailDetailHref(id) ?? `/inbox/${id}`
      router.push(href)
    },
    [router]
  )

  const openLatestEmail = useCallback(() => {
    const first = items?.[0]?.id
    if (first) openEmail(first)
  }, [items, openEmail])

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch("/api/inbox-emails?limit=50", {
        cache: "no-store",
        credentials: "include",
      })
      const data = await safeReadJson<ApiInboxListResponse>(res)

      if (!res.ok || !data.ok) {
        setItems([])
        setError((data as any)?.error ?? `HTTP ${res.status}`)
        setLoading(false)
        return
      }

      setItems(data.items ?? [])
      setLoading(false)
    } catch (e: any) {
      setItems([])
      setError(e?.message ?? "Failed to load inbox")
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const mapped = useMemo(() => {
    return items.map((row) => {
      const from = row.from_address ?? "Unknown"
      const sender = extractNameFromEmail(from)
      return {
        ...row,
        sender,
        subject: row.subject ?? "(no subject)",
        when: formatTime(row.received_at),
      }
    })
  }, [items])

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">Inbox</h1>
          </div>

          <button
            onClick={load}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80",
              loading && "opacity-60 cursor-not-allowed"
            )}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">Latest emails you received.</p>
      </div>

      <div className="flex-1 px-4 pb-24">
        <div className="mt-3">
          <TodayMissionCard
            state={missionState}
            onFindHighlight={openLatestEmail}
            onShareHighlight={openLatestEmail}
            markCompletionToastShown={markCompletionToastShown}
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <div className="text-sm font-semibold text-foreground">Failed to load</div>
            <div className="mt-1 text-sm text-muted-foreground">{error}</div>
          </div>
        ) : mapped.length === 0 ? (
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <div className="text-sm font-semibold text-foreground">No emails</div>
            <div className="mt-1 text-sm text-muted-foreground">There are no emails yet.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {mapped.map((row) => (
              <button
                key={row.id}
                onClick={() => openEmail(row.id)}
                className="w-full text-left rounded-2xl bg-card p-4 ring-1 ring-border/60 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground line-clamp-1">{row.subject}</div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-1">from {row.sender}</div>
                  </div>
                  <div className="shrink-0 text-[10px] text-muted-foreground">{row.when}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
