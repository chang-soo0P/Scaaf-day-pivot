"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { emailDetailHref } from "@/lib/email-href"
import { cn } from "@/lib/utils"
import { MessageCircle, Megaphone, Loader2 } from "lucide-react"

// --- API Types (✅ 현재 /api/circles/feed 응답에 맞춤) ---
type FeedItem = {
  id: string
  circleId: string
  emailId: string
  sharedAt: string
  sharedBy: string | null
  subject: string | null
  fromAddress: string | null
  receivedAt: string | null
  highlightCount?: number
  commentCount?: number
  latestActivity?: string | null
}

type ApiFeedResponse =
  | { ok: true; feed: FeedItem[] }
  | { ok: false; error?: string }

// --- Helpers ---
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

function formatTimeRelative(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return `now`
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

// --- View Types ---
type TopicFeedItem = {
  id: string
  emailId: string
  circleId: string
  circleName: string
  topic: string
  newsletterTitle: string
  senderName: string
  sharedAt: string
}

function TopicChip({ topic }: { topic: string }) {
  return (
    <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      {topic}
    </span>
  )
}

function FeedCardComponent({ item, onOpenEmail }: { item: TopicFeedItem; onOpenEmail: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TopicChip topic={item.topic} />
            <span className="text-xs text-muted-foreground">in {item.circleName}</span>
            <span className="text-xs text-muted-foreground">• {formatTimeRelative(item.sharedAt)}</span>
          </div>

          <h3 className="mt-2 text-base font-semibold leading-snug text-foreground line-clamp-2">
            {item.newsletterTitle}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">from {item.senderName}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end border-t border-border/50 pt-3">
        <button onClick={onOpenEmail} className="text-xs font-medium text-primary hover:underline">
          Open email
        </button>
      </div>
    </div>
  )
}

// --- Main Page ---
type TabType = "feed" | "ads"
type LayoutMode = "list" | "grid"

function MasonryGrid({ children }: { children: React.ReactNode[] }) {
  const leftColumn: React.ReactNode[] = []
  const rightColumn: React.ReactNode[] = []
  children.forEach((child, index) => (index % 2 === 0 ? leftColumn.push(child) : rightColumn.push(child)))
  return (
    <div className="flex gap-3">
      <div className="flex-1 flex flex-col gap-3">{leftColumn}</div>
      <div className="flex-1 flex flex-col gap-3">{rightColumn}</div>
    </div>
  )
}

export default function TopicsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("feed")
  const [layout, setLayout] = useState<LayoutMode>("list")

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<TopicFeedItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // ✅ 현재 API는 cursor paging을 안 주므로, infinite scroll은 "다음 단계"로.
  // 일단 UI를 살리기 위해 sentinel은 남겨두되 nextCursor는 항상 null로 둠.
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchPage = async (cursor: string | null, mode: "replace" | "append") => {
    const qs = new URLSearchParams()
    qs.set("limit", "20")
    if (cursor) qs.set("cursor", cursor)
  
    const res = await fetch(`/api/circles/feed?${qs.toString()}`, {
      cache: "no-store",
      credentials: "include",
    })
  
    const data: any = await safeReadJson<any>(res)
    if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  
    // ✅ items 우선, 없으면 feed로 fallback
    const rows = Array.isArray(data.items) ? data.items : []
    const feed = Array.isArray(data.feed) ? data.feed : []
  
    const mapped: TopicFeedItem[] =
      rows.length > 0
        ? rows.map((row: any) => {
            const subject = row.email?.subject ?? "(no subject)"
            const senderName = extractNameFromEmail(row.email?.from_address ?? "Unknown")
            return {
              id: row.id,
              emailId: row.email_id,
              circleId: row.circle_id,
              circleName: row.circle_name ?? "Circle",
              topic: "Today in your circles",
              newsletterTitle: subject,
              senderName,
              sharedAt: row.created_at,
            }
          })
        : feed.map((row: any) => {
            const subject = row.subject ?? "(no subject)"
            const senderName = extractNameFromEmail(row.fromAddress ?? "Unknown")
            return {
              id: row.id,
              emailId: row.emailId,
              circleId: row.circleId,
              circleName: row.circleName ?? "Circle",
              topic: "Today in your circles",
              newsletterTitle: subject,
              senderName,
              sharedAt: row.sharedAt,
            }
          })
  
    setNextCursor(data.nextCursor ?? null)
  
    setItems((prev) => {
      if (mode === "replace") return mapped
      const seen = new Set(prev.map((x) => x.id))
      const appended = mapped.filter((x) => !seen.has(x.id))
      return [...prev, ...appended]
    })
  }  

  // initial load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        await fetchPage(null, "replace")
        if (cancelled) return
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setItems([])
        setError(e?.message ?? "Failed to load feed")
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // infinite scroll observer (✅ 당장은 비활성; nextCursor가 없으니 동작 안 함)
  useEffect(() => {
    if (activeTab !== "feed") return
    if (!sentinelRef.current) return
    if (!nextCursor) return // ✅ 항상 null

    const el = sentinelRef.current
    const obs = new IntersectionObserver(async (entries) => {
      const first = entries[0]
      if (!first?.isIntersecting) return
      if (loadingMore) return

      try {
        setLoadingMore(true)
        // await fetchPage(nextCursor, "append") // nextCursor 지원 시 복구
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingMore(false)
      }
    })

    obs.observe(el)
    return () => obs.disconnect()
  }, [activeTab, nextCursor, loadingMore])

  const handleOpenEmail = (emailId: string) => {
    const href = emailDetailHref(emailId)
    if (!href) return
    router.push(href)
  }

  const cards = useMemo(
    () =>
      items.map((item) => (
        <FeedCardComponent key={item.id} item={item} onOpenEmail={() => handleOpenEmail(item.emailId)} />
      )),
    [items]
  )

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
        <div className="mx-4 flex rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => setActiveTab("feed")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "feed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Feed
          </button>
          <button
            onClick={() => setActiveTab("ads")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "ads" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Megaphone className="h-4 w-4" />
            Ad Board
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 pb-24">
        {activeTab !== "feed" ? (
          <div className="text-sm text-muted-foreground">Ads 탭은 다음 단계에서 연결.</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No feed yet. Share a newsletter to a circle.</div>
        ) : layout === "list" ? (
          <div className="space-y-4">{cards}</div>
        ) : (
          <MasonryGrid>{cards}</MasonryGrid>
        )}

        {/* infinite scroll sentinel */}
        {activeTab === "feed" && (
          <div ref={sentinelRef} className="mt-6 flex items-center justify-center py-6">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading more…
              </div>
            ) : nextCursor ? (
              <div className="text-xs text-muted-foreground">Scroll to load more</div>
            ) : items.length > 0 ? (
              <div className="text-xs text-muted-foreground">You’re all caught up</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
