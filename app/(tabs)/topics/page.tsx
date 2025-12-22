"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { MessageCircle, Megaphone, Grid3X3, LayoutList } from "lucide-react"
import { adItems as mockAdItems, type Comment, type Reaction } from "@/lib/email-mock-data"

/** -----------------------------
 * Types
 * ------------------------------*/
type DbEmailRow = {
  id: string
  from_address: string | null
  subject: string | null
  received_at: string | null
  body_text: string | null
  body_html: string | null
}

type ApiInboxEmailsListResponse =
  | { ok: true; emails: DbEmailRow[] }
  | { ok: false; error?: string }

type TopicFeedItem = {
  id: string
  emailId: string
  topic: string
  newsletterTitle: string
  senderName: string
  comments: Comment[]
  totalComments: number
  totalReactions: number
}

type AdItem = {
  id: string
  emailId: string
  newsletterSource: string
  brand: string
  headline: string
  ctaLabel: string
  thumbnail: string | null
}

/** -----------------------------
 * Helpers
 * ------------------------------*/
const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

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

// MVP 토픽 매칭(서버쪽 taxonomy 붙이면 교체)
function topicFromEmail(e: DbEmailRow): string {
  const hay = `${e.subject ?? ""} ${e.body_text ?? ""} ${e.body_html ?? ""}`.toLowerCase()

  const has = (k: string) => hay.includes(k)

  if (
    has("openai") ||
    has("gpt") ||
    has("llm") ||
    has("agent") ||
    has("deepmind") ||
    has("gemini") ||
    has("anthropic") ||
    has("claude") ||
    has("nvidia") ||
    has("inference")
  )
    return "AI"

  if (has("fed") || has("rate") || has("inflation") || has("yield") || has("etf") || has("portfolio") || has("stocks"))
    return "Investing"

  if (has("kospi") || has("kosdaq") || has("samsung") || has("sk hynix") || has("won") || has("korea"))
    return "Korea Stocks"

  if (has("startup") || has("funding") || has("yc") || has("y combinator") || has("series a") || has("vc"))
    return "Startups"

  if (has("figma") || has("design") || has("ux") || has("ui") || has("accessibility") || has("wcag") || has("lottie"))
    return "Design"

  return "General"
}

function colorFromString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `hsl(${hue} 70% 45%)`
}

/** -----------------------------
 * UI Components
 * ------------------------------*/
function TopicChip({ topic }: { topic: string }) {
  return (
    <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      {topic}
    </span>
  )
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function ReactionPill({ emoji, count }: Reaction) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-xs">
      <span>{emoji}</span>
      <span className="text-muted-foreground">{count}</span>
    </span>
  )
}

function CommentBubble({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-2">
      <Avatar name={comment.authorName} color={comment.authorAvatarColor} />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-secondary/60 px-3 py-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-foreground">{comment.authorName}</span>
            <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{comment.text}</p>
        </div>
        {comment.reactions.length > 0 && (
          <div className="flex gap-1 mt-1 ml-1">
            {comment.reactions.map((r, i) => (
              <ReactionPill key={i} emoji={r.emoji} count={r.count} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FeedCardComponent({
  item,
  onOpenEmail,
}: {
  item: TopicFeedItem
  onOpenEmail: () => void
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <TopicChip topic={item.topic} />
          <h3 className="mt-2 text-base font-semibold leading-snug text-foreground line-clamp-2">
            {item.newsletterTitle}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">from {item.senderName}</p>
        </div>
      </div>

      <div className="space-y-3">
        {item.comments.map((comment) => (
          <CommentBubble key={comment.id} comment={comment} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {item.totalComments} comments
          </span>
          <span>{item.totalReactions} reactions</span>
        </div>

        <button onClick={onOpenEmail} className="text-xs font-medium text-primary hover:underline">
          Open email
        </button>
      </div>
    </div>
  )
}

function AdCardComponent({
  item,
  onOpenEmail,
  disabled,
}: {
  item: AdItem
  onOpenEmail: () => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md">
      <div className="flex gap-3">
        {item.thumbnail && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
            <Image src={item.thumbnail || "/placeholder.svg"} alt={item.brand} fill className="object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
              Sponsored
            </span>
            <span className="text-[10px] text-muted-foreground truncate">via {item.newsletterSource}</span>
          </div>
          <p className="text-xs font-semibold text-foreground">{item.brand}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.headline}</p>
        </div>
      </div>

      <button
        onClick={onOpenEmail}
        disabled={disabled}
        className={cn(
          "mt-2 w-full rounded-lg bg-secondary py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80",
          disabled && "opacity-50 cursor-not-allowed hover:bg-secondary"
        )}
      >
        Open newsletter
      </button>
    </div>
  )
}

/** -----------------------------
 * Layout helpers
 * ------------------------------*/
type TabType = "feed" | "ads"
type LayoutMode = "list" | "grid"

const layoutIcons = {
  list: LayoutList,
  grid: Grid3X3,
}

function MasonryGrid({ children }: { children: React.ReactNode[] }) {
  const leftColumn: React.ReactNode[] = []
  const rightColumn: React.ReactNode[] = []

  children.forEach((child, index) => {
    if (index % 2 === 0) leftColumn.push(child)
    else rightColumn.push(child)
  })

  return (
    <div className="flex gap-3">
      <div className="flex-1 flex flex-col gap-3">{leftColumn}</div>
      <div className="flex-1 flex flex-col gap-3">{rightColumn}</div>
    </div>
  )
}

/** -----------------------------
 * Page
 * ------------------------------*/
export default function TopicsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("feed")
  const [layout, setLayout] = useState<LayoutMode>("list")

  const [emails, setEmails] = useState<DbEmailRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(`/api/inbox-emails?limit=200`, {
          cache: "no-store",
          credentials: "include",
        })
        const data = await safeReadJson<ApiInboxEmailsListResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setEmails([])
          setLoading(false)
          return
        }

        setEmails(data.emails ?? [])
        setLoading(false)
      } catch {
        if (cancelled) return
        setEmails([])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const feedItems: TopicFeedItem[] = useMemo(() => {
    // MVP: 실제 메일만으로 feed 구성 (comments/reactions는 아직 friend feed 미구현 → 빈 값)
    return (emails ?? []).map((e) => {
      const from = e.from_address ?? "Unknown"
      const senderName = extractNameFromEmail(from)
      const title = (e.subject ?? "(no subject)").toString()
      const topic = topicFromEmail(e)

      const comments: Comment[] = [] // 친구 feed 붙일 때 여기에 채움
      const totalComments = 0
      const totalReactions = 0

      return {
        id: `feed-${e.id}`,
        emailId: e.id,
        topic,
        newsletterTitle: title,
        senderName,
        comments,
        totalComments,
        totalReactions,
      }
    })
  }, [emails])

  // ads는 기존 mock 사용하되, emailId가 UUID가 아니면 open 막기
  const adItems: AdItem[] = useMemo(() => {
    return (mockAdItems ?? []) as any
  }, [])

  const handleOpenEmail = (emailId: string) => {
    if (!isUuid(emailId)) return
    router.push(`/inbox/${emailId}`)
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Tab Switcher */}
      <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
        <div className="mx-4 flex rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => setActiveTab("feed")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "feed"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Feed
          </button>
          <button
            onClick={() => setActiveTab("ads")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "ads"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Megaphone className="h-4 w-4" />
            Ad Board
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24">
        {activeTab === "feed" ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading…" : "Your latest newsletters (MVP feed)"}
              </p>

              <div className="flex items-center justify-end gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
                {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
                  const Icon = layoutIcons[mode]
                  return (
                    <button
                      key={mode}
                      onClick={() => setLayout(mode)}
                      className={cn(
                        "rounded-md p-2 transition-all",
                        layout === mode
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                      aria-label={`Switch to ${mode} layout`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </div>

            {!loading && feedItems.length === 0 ? (
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border text-sm text-muted-foreground">
                No emails found.
              </div>
            ) : layout === "list" ? (
              <div className="space-y-4">
                {feedItems.map((item) => (
                  <FeedCardComponent
                    key={item.id}
                    item={item}
                    onOpenEmail={() => handleOpenEmail(item.emailId)}
                  />
                ))}
              </div>
            ) : (
              <MasonryGrid>
                {feedItems.map((item) => (
                  <FeedCardComponent
                    key={item.id}
                    item={item}
                    onOpenEmail={() => handleOpenEmail(item.emailId)}
                  />
                ))}
              </MasonryGrid>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">Sponsored sections from your newsletters</p>

              <div className="flex items-center justify-end gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
                {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
                  const Icon = layoutIcons[mode]
                  return (
                    <button
                      key={mode}
                      onClick={() => setLayout(mode)}
                      className={cn(
                        "rounded-md p-2 transition-all",
                        layout === mode
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                      aria-label={`Switch to ${mode} layout`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </div>

            {layout === "list" ? (
              <div className="space-y-3">
                {adItems.map((item) => (
                  <AdCardComponent
                    key={item.id}
                    item={item}
                    disabled={!isUuid(item.emailId)}
                    onOpenEmail={() => handleOpenEmail(item.emailId)}
                  />
                ))}
              </div>
            ) : (
              <MasonryGrid>
                {adItems.map((item) => (
                  <AdCardComponent
                    key={item.id}
                    item={item}
                    disabled={!isUuid(item.emailId)}
                    onOpenEmail={() => handleOpenEmail(item.emailId)}
                  />
                ))}
              </MasonryGrid>
            )}

            <div className="mt-3 text-xs text-muted-foreground">
              * MVP: Ad items are mock. “Open newsletter” works only if the item has a real UUID emailId.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
