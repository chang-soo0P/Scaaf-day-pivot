"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

type FeedItem = {
  id: string
  circleId: string
  emailId: string
  sharedAt: string
  sharedBy: string | null
  subject: string | null
  fromAddress: string | null
  receivedAt: string | null
}

type ApiResp =
  | { ok: true; feed: FeedItem[]; nextCursor: string | null }
  | { ok: false; error?: string }

async function safeReadJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` } as unknown as T
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}

function extractNameFromEmail(addr: string | null) {
  if (!addr) return "Unknown"
  const emailMatch = addr.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const email = emailMatch?.[0] ?? addr
  const name = email.split("@")[0]
  return name || email
}

function ShareRow({
  item,
}: {
  item: FeedItem
}) {
  return (
    <Link
      href={`/inbox/${item.emailId}`}
      prefetch={false}
      className="block rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Mail className="h-4 w-4 text-secondary-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground truncate">
              from {extractNameFromEmail(item.fromAddress)}
            </p>
            <p className="text-xs text-muted-foreground">{fmtDate(item.sharedAt)}</p>
          </div>

          <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {item.subject ?? "(no subject)"}
          </h3>
        </div>
      </div>
    </Link>
  )
}

export default function CircleFeedClient({
  circleId,
  initialFeed,
  initialNextCursor,
}: {
  circleId: string
  initialFeed: FeedItem[]
  initialNextCursor: string | null
}) {
  const [items, setItems] = useState<FeedItem[]>(initialFeed ?? [])
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchMore = async () => {
    if (!nextCursor) return
    if (loadingMore) return

    try {
      setLoadingMore(true)
      setError(null)

      const qs = new URLSearchParams()
      qs.set("limit", "20")
      qs.set("cursor", nextCursor)

      const res = await fetch(`/api/circles/${circleId}/feed?${qs.toString()}`, {
        cache: "no-store",
        credentials: "include",
      })

      const data = await safeReadJson<ApiResp>(res)
      if (!res.ok || !data.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`)

      setNextCursor(data.nextCursor ?? null)
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        const appended = (data.feed ?? []).filter((x) => !seen.has(x.id))
        return [...prev, ...appended]
      })
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more")
    } finally {
      setLoadingMore(false)
    }
  }

  // infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return
    if (!nextCursor) return

    const el = sentinelRef.current
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        void fetchMore()
      },
      { root: null, rootMargin: "400px 0px", threshold: 0 }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [nextCursor, loadingMore])

  const rows = useMemo(() => items.map((it) => <ShareRow key={it.id} item={it} />), [items])

  return (
    <div className="space-y-3">
      {rows.length ? (
        rows
      ) : (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-border text-sm text-muted-foreground">
          No shares yet. Go to an email and “Share to circle”.
        </div>
      )}

      <div ref={sentinelRef} className="mt-4 flex items-center justify-center py-6">
        {loadingMore ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more…
          </div>
        ) : error ? (
          <div className={cn("text-xs", "text-destructive")}>{error}</div>
        ) : nextCursor ? (
          <div className="text-xs text-muted-foreground">Scroll to load more</div>
        ) : rows.length ? (
          <div className="text-xs text-muted-foreground">You’re all caught up</div>
        ) : null}
      </div>
    </div>
  )
}
