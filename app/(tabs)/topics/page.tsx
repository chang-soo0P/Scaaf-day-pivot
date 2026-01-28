"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { emailDetailHref } from "@/lib/email-href"
import { cn } from "@/lib/utils"
import { MessageCircle, Megaphone, Loader2, Users, Hash } from "lucide-react"

// --- API Types (items + feed 둘 다 대응) ---
type FeedItem = {
  id: string
  circleId: string
  circleName?: string | null
  emailId: string
  sharedAt: string
  sharedBy: string | null
  subject: string | null
  fromAddress: string | null
  receivedAt: string | null
  highlightCount?: number
  commentCount?: number
  latestActivity?: string | null

  // ✅ sharedByProfile (server에서 내려옴)
  sharedByProfile?: { id: string; name: string; avatarUrl: string | null } | null

  // 백엔드가 내려주는 DB 기준 카운트
  circleMemberCount?: number | null
  circleShareCount?: number | null
}

type ApiFeedResponse =
  | { ok: true; feed: any[]; nextCursor: string | null }
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

function inferTopic(input: { subject?: string | null; from?: string | null }) {
  const s = `${input.subject ?? ""} ${input.from ?? ""}`.toLowerCase()

  const rules: Array<{ topic: string; keywords: string[] }> = [
    { topic: "AI", keywords: ["ai", "gpt", "openai", "anthropic", "claude", "gemini", "deepmind", "nvidia", "llm", "agent"] },
    { topic: "Markets", keywords: ["market", "stocks", "etf", "earnings", "yield", "inflation", "fed", "rates", "crypto", "bitcoin", "nasdaq", "s&p"] },
    { topic: "Korea", keywords: ["kospi", "kosdaq", "krx", "seoul", "won", "samsung", "sk hynix", "korea"] },
    { topic: "Startups", keywords: ["startup", "funding", "seed", "series a", "vc", "pitch", "y combinator", "yc"] },
    { topic: "Design", keywords: ["design", "figma", "ux", "ui", "dribbble", "lottie", "accessibility", "wcag"] },
    { topic: "Product", keywords: ["product", "pmf", "retention", "growth", "pricing", "onboarding"] },
  ]

  const hit = rules.find((r) => r.keywords.some((k) => s.includes(k)))
  return hit?.topic ?? "Circles"
}

function initialsFromName(name: string) {
  const n = (name ?? "").trim()
  if (!n) return "?"
  // 한글/영문 모두 대응: 공백 기준 첫 글자 1~2개
  const parts = n.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? n[0]
  const second = parts.length > 1 ? parts[1]?.[0] : n.length > 1 ? n[1] : ""
  const out = `${first}${second}`.toUpperCase()
  return out.slice(0, 2)
}

function AvatarInitial({ name }: { name: string }) {
  return (
    <div
      className="h-5 w-5 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-semibold"
      aria-label={name}
      title={name}
    >
      {initialsFromName(name)}
    </div>
  )
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

  // ✅ shared by UI
  sharedByName: string

  // DB 기준 카운트
  circleMemberCount?: number | null
  circleShareCount?: number | null
}

function TopicChip({ topic, active, onClick }: { topic: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      )}
    >
      {topic}
    </button>
  )
}

function StatPill({ icon, children, title }: { icon: React.ReactNode; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
    >
      {icon}
      {children}
    </span>
  )
}

function FeedCardComponent({
  item,
  onOpenEmail,
  onOpenCircle,
  onClickTopic,
  isTopicActive,
  circleShareCount,
  circleMemberCount,
}: {
  item: TopicFeedItem
  onOpenEmail: () => void
  onOpenCircle: () => void
  onClickTopic: (topic: string) => void
  isTopicActive: boolean
  circleShareCount: number | null
  circleMemberCount: number | null
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          {/* ✅ 상단 메타 라인 */}
          <div className="flex flex-wrap items-center gap-2">
            <TopicChip topic={item.topic} active={isTopicActive} onClick={() => onClickTopic(item.topic)} />

            <button
              type="button"
              onClick={onOpenCircle}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              in {item.circleName}
            </button>

            <span className="text-xs text-muted-foreground">• {formatTimeRelative(item.sharedAt)}</span>

            {/* ✅ B 스타일: 작은 이니셜 + shared by */}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <AvatarInitial name={item.sharedByName} />
              <span className="truncate">shared by {item.sharedByName}</span>
            </span>

            <div className="ml-auto flex items-center gap-1">
              {circleMemberCount !== null ? (
                <StatPill title="Members" icon={<Users className="h-3 w-3" />}>
                  {circleMemberCount}
                </StatPill>
              ) : null}

              {circleShareCount !== null ? (
                <StatPill title="Shares (DB total)" icon={<Hash className="h-3 w-3" />}>
                  {circleShareCount}
                </StatPill>
              ) : null}
            </div>
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

  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // ✅ Topic filter state
  const [activeTopic, setActiveTopic] = useState<string | null>(null)

  const fetchPage = async (cursor: string | null, mode: "replace" | "append") => {
    const qs = new URLSearchParams()
    qs.set("limit", "20")
    if (cursor) qs.set("cursor", cursor)

    const res = await fetch(`/api/circles/feed?${qs.toString()}`, {
      cache: "no-store",
      credentials: "include",
    })

    const data = await safeReadJson<ApiFeedResponse>(res)
    if (!res.ok || !(data as any)?.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`)

    const feed = Array.isArray((data as any).feed) ? ((data as any).feed as FeedItem[]) : []
    const legacyItems = Array.isArray((data as any).items) ? (data as any).items : []

    const mapped: TopicFeedItem[] =
      feed.length > 0
        ? feed.map((row: any) => {
            const subject = row.subject ?? "(no subject)"
            const from = row.fromAddress ?? "Unknown"
            const topic = inferTopic({ subject, from })

            const sharedByName =
              (row.sharedByProfile?.name && String(row.sharedByProfile.name)) ||
              (row.sharedBy ? "Member" : "Member")

            return {
              id: row.id,
              emailId: row.emailId,
              circleId: row.circleId,
              circleName: row.circleName ?? "Circle",
              topic,
              newsletterTitle: subject,
              senderName: extractNameFromEmail(from),
              sharedAt: row.sharedAt,
              sharedByName,
              circleMemberCount: row.circleMemberCount ?? null,
              circleShareCount: row.circleShareCount ?? null,
            }
          })
        : legacyItems.map((row: any) => {
            const subject = row.email?.subject ?? "(no subject)"
            const from = row.email?.from_address ?? "Unknown"
            const topic = inferTopic({ subject, from })

            // legacy에는 sharedByProfile 없을 수 있음
            const sharedByName = "Member"

            return {
              id: row.id,
              emailId: row.email_id,
              circleId: row.circle_id,
              circleName: row.circle_name ?? "Circle",
              topic,
              newsletterTitle: subject,
              senderName: extractNameFromEmail(from),
              sharedAt: row.created_at,
              sharedByName,
              circleMemberCount: row.circle_member_count ?? null,
              circleShareCount: row.circle_share_count ?? null,
            }
          })

    setNextCursor((data as any).nextCursor ?? null)

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

  // infinite scroll observer
  useEffect(() => {
    if (activeTab !== "feed") return
    if (!sentinelRef.current) return
    if (!nextCursor) return
    if (loadingMore) return

    const el = sentinelRef.current
    const obs = new IntersectionObserver(
      async (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return

        try {
          setLoadingMore(true)
          await fetchPage(nextCursor, "append")
        } catch (e) {
          console.error(e)
        } finally {
          setLoadingMore(false)
        }
      },
      { root: null, rootMargin: "400px 0px", threshold: 0 }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [activeTab, nextCursor, loadingMore])

  const handleOpenEmail = (emailId: string) => {
    const href = emailDetailHref(emailId)
    if (!href) return
    router.push(href)
  }

  const handleOpenCircle = (circleId: string) => {
    router.push(`/circles/${circleId}`)
  }

  const handleToggleTopic = (topic: string) => {
    setActiveTopic((prev) => (prev === topic ? null : topic))
  }

  const topicCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) m.set(it.topic, (m.get(it.topic) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [items])

  const visibleItems = useMemo(() => {
    if (!activeTopic) return items
    return items.filter((it) => it.topic === activeTopic)
  }, [items, activeTopic])

  const groupedByTopic = useMemo(() => {
    const groups = new Map<string, TopicFeedItem[]>()
    for (const it of visibleItems) {
      const arr = groups.get(it.topic) ?? []
      arr.push(it)
      groups.set(it.topic, arr)
    }
    for (const [k, arr] of groups.entries()) {
      arr.sort((a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime())
      groups.set(k, arr)
    }
    const orderedTopics = [
      ...topicCounts.map(([t]) => t).filter((t) => groups.has(t)),
      ...Array.from(groups.keys()).filter((t) => !topicCounts.some(([x]) => x === t)).sort(),
    ]
    return { groups, orderedTopics }
  }, [visibleItems, topicCounts])

  const renderCards = (list: TopicFeedItem[]) => {
    const cards = list.map((item) => (
      <FeedCardComponent
        key={item.id}
        item={item}
        onOpenEmail={() => handleOpenEmail(item.emailId)}
        onOpenCircle={() => handleOpenCircle(item.circleId)}
        onClickTopic={handleToggleTopic}
        isTopicActive={activeTopic === item.topic}
        circleShareCount={item.circleShareCount ?? null}
        circleMemberCount={item.circleMemberCount ?? null}
      />
    ))

    return layout === "list" ? <div className="space-y-4">{cards}</div> : <MasonryGrid>{cards}</MasonryGrid>
  }

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

        {activeTab === "feed" && (
          <div className="mx-4 mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <TopicChip topic="All" active={!activeTopic} onClick={() => setActiveTopic(null)} />
            {topicCounts.map(([t, count]) => (
              <button
                key={t}
                type="button"
                onClick={() => handleToggleTopic(t)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
                  activeTopic === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {t}
                <span className={cn("text-[11px]", activeTopic === t ? "text-primary-foreground/80" : "text-secondary-foreground/70")}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
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
        ) : (
          <div className="space-y-8">
            {groupedByTopic.orderedTopics.map((topic) => {
              const list = groupedByTopic.groups.get(topic) ?? []
              if (list.length === 0) return null

              return (
                <section key={topic} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{topic}</h2>
                      <span className="text-xs text-muted-foreground">{list.length}</span>
                    </div>

                    {activeTopic ? (
                      <button
                        type="button"
                        onClick={() => setActiveTopic(null)}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Clear filter
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTopic(topic)}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        View only
                      </button>
                    )}
                  </div>

                  {renderCards(list)}
                </section>
              )
            })}
          </div>
        )}

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
