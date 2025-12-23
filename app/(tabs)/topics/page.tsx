"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { emailDetailHref } from "@/lib/email-href"
import { cn } from "@/lib/utils"
import { MessageCircle, Megaphone, Grid3X3, LayoutList } from "lucide-react"

// --- Types ---
type Reaction = { emoji: string; count: number }
type Comment = {
  id: string
  authorId?: string
  authorName: string
  authorAvatarColor?: string
  text: string
  createdAt: string
  totalReactions?: number
  reactions?: Reaction[]
}

type TopicFeedItem = {
  id: string
  emailId: string
  circleId: string
  circleName: string
  topic: string
  newsletterTitle: string
  senderName: string
  comments: Comment[]
  totalComments: number
  totalReactions: number
}

type FeedApiRow = {
  circle_id: string
  circle_name: string
  email_id: string
  shared_at: string
  subject: string | null
  from_address: string | null
  latest_comments: any // jsonb
  total_comments: number
  total_reactions: number
}

type ApiFeedResponse = { ok: true; items: FeedApiRow[] } | { ok: false; error?: string }

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

function avatarColorFromUserId(userId?: string | null) {
  if (!userId) return "#64748b"
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `hsl(${hue} 70% 45%)`
}

// --- Components ---
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

function CommentBubble({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-2">
      <Avatar name={comment.authorName} color={comment.authorAvatarColor ?? "#64748b"} />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-secondary/60 px-3 py-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-foreground">{comment.authorName}</span>
            <span className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{comment.text}</p>
        </div>
        {(comment.totalReactions ?? 0) > 0 && (
          <div className="mt-1 ml-1 text-[10px] text-muted-foreground">
            {comment.totalReactions} reactions
          </div>
        )}
      </div>
    </div>
  )
}

function FeedCardComponent({
  item,
  onOpenEmail,
}: { item: TopicFeedItem; onOpenEmail: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TopicChip topic={item.topic} />
            <span className="text-xs text-muted-foreground">in {item.circleName}</span>
          </div>
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

// --- Main Page ---
type TabType = "feed" | "ads"
type LayoutMode = "list" | "grid"

const layoutIcons = {
  list: LayoutList,
  grid: Grid3X3,
}

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

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/circles/feed?limit=100`, { cache: "no-store", credentials: "include" })
        const data = await safeReadJson<ApiFeedResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setItems([])
          setError(data.error ?? "Failed to load feed")
          setLoading(false)
          return
        }

        const mapped: TopicFeedItem[] = (data.items ?? []).map((row) => {
          const latest: Comment[] = Array.isArray(row.latest_comments)
            ? row.latest_comments.map((c: any) => ({
                id: c.id,
                authorId: c.authorId,
                authorName: c.authorName ?? "Unknown",
                authorAvatarColor: avatarColorFromUserId(c.authorId),
                text: c.text ?? "",
                createdAt: c.createdAt,
                totalReactions: c.totalReactions ?? 0,
              }))
            : []

          const senderName = extractNameFromEmail(row.from_address ?? "Unknown")
          return {
            id: `feed-${row.circle_id}-${row.email_id}`,
            emailId: row.email_id,
            circleId: row.circle_id,
            circleName: row.circle_name ?? "Circle",
            topic: "Today in your circles",
            newsletterTitle: row.subject ?? "(no subject)",
            senderName,
            comments: latest,
            totalComments: row.total_comments ?? 0,
            totalReactions: row.total_reactions ?? 0,
          }
        })

        setItems(mapped)
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setItems([])
        setError(e?.message ?? "Failed to load feed")
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleOpenEmail = (emailId: string) => {
    const href = emailDetailHref(emailId)
    if (!href) return
    router.push(href)
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
        <div className="mx-4 flex rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => setActiveTab("feed")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "feed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Feed
          </button>
          <button
            onClick={() => setActiveTab("ads")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "ads" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
          <div className="space-y-4">
            {items.map((item) => (
              <FeedCardComponent key={item.id} item={item} onOpenEmail={() => handleOpenEmail(item.emailId)} />
            ))}
          </div>
        ) : (
          <MasonryGrid>
            {items.map((item) => (
              <FeedCardComponent key={item.id} item={item} onOpenEmail={() => handleOpenEmail(item.emailId)} />
            ))}
          </MasonryGrid>
        )}
      </div>
    </div>
  )
}
