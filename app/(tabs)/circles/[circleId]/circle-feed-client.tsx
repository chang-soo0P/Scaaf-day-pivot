"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type FeedItem = {
  emailId: string
  sharedAt: string
  sharedBy: string
  sharedByName: string
  subject: string
  fromAddress: string
  receivedAt: string | null
}

type Api = {
  ok: true
  circle: { id: string; name: string | null; slug: string | null }
  feed: FeedItem[]
} | { ok: false; error?: string }

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString([], { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export default function CircleFeedClient({ circlesID }: { circlesID: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [circleName, setCircleName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/circles/${circlesID}/feed?limit=50`, {
          cache: "no-store",
          credentials: "include",
        })
        const data: Api = await res.json().catch(async () => ({ ok: false, error: await res.text() } as any))

        if (cancelled) return

        if (!res.ok || !("ok" in data) || !data.ok) {
          setError((data as any)?.error ?? `HTTP ${res.status}`)
          setFeed([])
          setCircleName(null)
          setLoading(false)
          return
        }

        setCircleName(data.circle?.name ?? null)
        setFeed(data.feed ?? [])
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message ?? "Failed to load feed")
        setFeed([])
        setCircleName(null)
        setLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [circlesID])

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Shared Emails</h2>
          {circleName ? <p className="text-xs text-muted-foreground">{circleName}</p> : null}
        </div>
        <span className="text-xs text-muted-foreground">{feed.length} items</span>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Loading feed…</div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/40 bg-card p-4 text-sm">
          <div className="font-semibold text-destructive">Feed load failed</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      ) : feed.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No shared emails yet. Share an email to this circle!
        </div>
      ) : (
        <div className="space-y-2">
          {feed.map((item) => (
            <Link
              key={`${item.emailId}-${item.sharedAt}`}
              href={`/inbox/${item.emailId}`}
              className={cn(
                "block rounded-2xl border border-border bg-card p-4",
                "hover:bg-secondary/40 transition-colors"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{item.subject}</div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">{item.fromAddress}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-muted-foreground">{item.sharedByName}</div>
                  <div className="text-[11px] text-muted-foreground">{formatTime(item.sharedAt)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
