"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type FeedItem = {
  id: string
  circleId: string
  emailId: string
  sharedBy: string | null
  sharedAt: string
  email: {
    id: string
    subject: string
    from: string | null
    receivedAt: string | null
    snippet: string | null
  } | null
}

type ApiResponse = { ok: true; items: FeedItem[] } | { ok: false; error?: string }

function formatTimeRelative(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

export default function CircleFeedClient({ circleId }: { circleId: string }) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/circles/${circleId}/feed?limit=20`, {
          cache: "no-store",
          credentials: "include",
        })
        const text = await res.text()
        const data = (() => {
          try {
            return JSON.parse(text) as ApiResponse
          } catch {
            return { ok: false, error: text || `HTTP ${res.status}` } as ApiResponse
          }
        })()

        if (cancelled) return
        if (!data.ok) {
          setItems([])
          setError(data.error ?? `HTTP ${res.status}`)
          setLoading(false)
          return
        }

        setItems(data.items ?? [])
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setItems([])
        setError(e?.message ?? "Failed to load feed")
        setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [circleId])

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-end justify-between">
        <h3 className="text-sm font-semibold text-foreground">Shared Feed</h3>
        <span className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${items.length} items`}
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No shared emails yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const e = it.email
            return (
              <Link
                key={it.id}
                href={e?.id ? `/inbox/${e.id}` : "#"}
                className={cn(
                  "block rounded-xl bg-card p-3 ring-1 ring-border/60 hover:bg-secondary/30 transition",
                  !e?.id && "pointer-events-none opacity-60"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {e?.subject ?? "(missing email)"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{e?.from ?? "Unknown"}</span>
                      <span>•</span>
                      <span>{formatTimeRelative(it.sharedAt)}</span>
                    </div>
                  </div>
                </div>

                {e?.snippet ? (
                  <div className="mt-2 line-clamp-2 text-xs text-foreground/70">
                    {e.snippet}
                  </div>
                ) : null}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
