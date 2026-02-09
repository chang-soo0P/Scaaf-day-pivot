// components/circles/highlights-feed.tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import HighlightCard, { HighlightItem } from "./highlight-card"

type ApiResponse = {
  ok: boolean
  highlights?: HighlightItem[]
  nextCursor?: string | null
  error?: string
}

export default function HighlightsFeed({ circleId }: { circleId: string }) {
  const [items, setItems] = useState<HighlightItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seenIdsRef = useRef<Set<string>>(new Set())
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const hasMore = cursor !== null || !initialLoaded // 첫 로드 전에는 true 취급

  const mergeDedup = useCallback((next: HighlightItem[]) => {
    const seen = seenIdsRef.current
    const merged: HighlightItem[] = []
    for (const it of next) {
      if (seen.has(it.id)) continue
      seen.add(it.id)
      merged.push(it)
    }
    setItems((prev) => [...prev, ...merged])
  }, [])

  const fetchPage = useCallback(
    async (mode: "initial" | "next") => {
      if (loading) return
      setLoading(true)
      setError(null)

      try {
        const qs = new URLSearchParams()
        qs.set("limit", "20")
        if (mode === "next" && cursor) qs.set("cursor", cursor)

        const res = await fetch(`/api/circles/${circleId}/highlights?${qs.toString()}`, {
          method: "GET",
          cache: "no-store",
        })

        const json = (await res.json()) as ApiResponse

        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Request failed (${res.status})`)
        }

        const nextItems = json.highlights ?? []
        mergeDedup(nextItems)

        // nextCursor가 null이면 더 없음
        setCursor(json.nextCursor ?? null)
        setInitialLoaded(true)
      } catch (e: any) {
        setError(e?.message ?? "Unknown error")
        setInitialLoaded(true)
      } finally {
        setLoading(false)
      }
    },
    [circleId, cursor, loading, mergeDedup]
  )

  // initial load
  useEffect(() => {
    // reset when circleId changes
    setItems([])
    seenIdsRef.current = new Set()
    setCursor(null)
    setInitialLoaded(false)
    setError(null)
    // first page
    fetchPage("initial")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId])

  // infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        if (loading) return
        // initialLoaded 이후에만 next를 당긴다
        if (!initialLoaded) return
        // cursor가 null이면 끝
        if (cursor === null) return
        fetchPage("next")
      },
      { root: null, rootMargin: "800px 0px", threshold: 0.01 }
    )

    io.observe(el)
    return () => io.disconnect()
  }, [cursor, fetchPage, initialLoaded, loading])

  const empty = initialLoaded && !loading && items.length === 0 && !error

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-2xl border p-4 text-sm">
          <div className="font-medium">Failed to load highlights</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
          <button
            className="mt-3 rounded-xl border px-3 py-2 text-xs"
            onClick={() => fetchPage(initialLoaded ? "next" : "initial")}
          >
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

      {/* sentinel */}
      <div ref={sentinelRef} />

      {loading ? (
        <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : null}

      {initialLoaded && cursor === null && items.length > 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          End of feed
        </div>
      ) : null}
    </div>
  )
}
