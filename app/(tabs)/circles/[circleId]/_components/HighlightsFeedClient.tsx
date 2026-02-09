// app/(tabs)/circles/[circleId]/_components/HighlightsFeedClient.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  CircleHighlight,
  CircleHighlightsApiResponse,
} from "@/src/types/circle-highlights"

function formatDateTime(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString()
}

function HighlightCard({ item }: { item: CircleHighlight }) {
  const isShort = (item.quote ?? "").trim().length < 15

  return (
    <div className="rounded-2xl border bg-white/60 backdrop-blur p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {item.subject || "(No subject)"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {item.fromAddress}
            {item.receivedAt ? ` · received ${formatDateTime(item.receivedAt)}` : ""}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground">
            {formatDateTime(item.createdAt)}
          </div>
          <div className="mt-1 text-xs">
            <span className="font-medium">
              {item.sharedByProfile?.name ?? "Unknown"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        {isShort ? (
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs">
            {item.quote}
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.quote}</p>
        )}
      </div>

      {item.memo ? (
        <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm">{item.memo}</div>
      ) : null}
    </div>
  )
}

// ✅ A안: initial props를 "선택(optional)"으로 받아도 되게 바꿈
export default function HighlightsFeedClient({
  circleId,
  initialHighlights = [],
  initialNextCursor = null,
}: {
  circleId: string
  initialHighlights?: CircleHighlight[]
  initialNextCursor?: string | null
}) {
  const [items, setItems] = useState<CircleHighlight[]>(initialHighlights)
  const [cursor, setCursor] = useState<string | null>(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set(initialHighlights.map((x) => x.id)))

  // circleId 바뀌면 초기화(혹시 재사용될 경우 대비)
  useEffect(() => {
    setItems(initialHighlights)
    setCursor(initialNextCursor)
    setError(null)
    seenIdsRef.current = new Set(initialHighlights.map((x) => x.id))
  }, [circleId, initialHighlights, initialNextCursor])

  const mergeDedup = useCallback((next: CircleHighlight[]) => {
    const seen = seenIdsRef.current
    const merged: CircleHighlight[] = []
    for (const it of next) {
      if (seen.has(it.id)) continue
      seen.add(it.id)
      merged.push(it)
    }
    if (merged.length) setItems((prev) => [...prev, ...merged])
  }, [])

  const fetchNext = useCallback(async () => {
    if (loading) return
    if (cursor === null) return

    setLoading(true)
    setError(null)

    try {
      const qs = new URLSearchParams()
      qs.set("limit", "20")
      qs.set("cursor", cursor)

      const res = await fetch(`/api/circles/${circleId}/highlights?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: { "content-type": "application/json" },
      })

      const data = (await res.json()) as CircleHighlightsApiResponse

      if (!res.ok || !data.ok) {
        const msg = (data as any).error || `Request failed (${res.status})`
        throw new Error(msg)
      }

      mergeDedup(data.highlights ?? [])
      setCursor(data.nextCursor ?? null)
    } catch (e: any) {
      setError(e?.message ?? "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [circleId, cursor, loading, mergeDedup])

  // infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        if (loading) return
        if (cursor === null) return
        fetchNext()
      },
      { root: null, rootMargin: "800px 0px", threshold: 0.01 }
    )

    io.observe(el)
    return () => io.disconnect()
  }, [cursor, fetchNext, loading])

  const empty = !loading && items.length === 0 && !error

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-2xl border p-4 text-sm">
          <div className="font-medium">Failed to load highlights</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
          <button className="mt-3 rounded-xl border px-3 py-2 text-xs" onClick={fetchNext}>
            Retry
          </button>
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground">
          아직 공유된 하이라이트가 없어요.
        </div>
      ) : null}

      {items.map((it) => (
        <HighlightCard key={it.id} item={it} />
      ))}

      <div ref={sentinelRef} />

      {loading ? (
        <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Loading…</div>
      ) : null}

      {!loading && items.length > 0 && cursor === null ? (
        <div className="py-4 text-center text-xs text-muted-foreground">End of feed</div>
      ) : null}
    </div>
  )
}
