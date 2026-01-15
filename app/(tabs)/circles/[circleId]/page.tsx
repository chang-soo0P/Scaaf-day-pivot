"use client"

import { ChevronLeft, MessageSquare, Highlighter } from "lucide-react"
import Link from "next/link"
import { emailDetailHref } from "@/lib/email-href"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type FeedItem = {
  emailId: string
  sharedAt: string
  sender: string
  subject: string
  snippet: string
  highlightCount: number
  commentCount: number
  latestActivity?: string
}

type ApiFeedResponse = { ok: true; items: FeedItem[] } | { ok: false; error?: string }

async function safeReadJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` } as unknown as T
  }
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleDateString()
}

function SharedNewsletterCard({
  newsletter,
}: {
  newsletter: {
    emailId: string
    title: string
    sender: string
    senderIcon: string
    topics: string[] // MVP: 비워둠
    highlightCount: number
    commentCount: number
    latestActivity: string
    sharedAt: string
  }
}) {
  const href = emailDetailHref(newsletter.emailId)
  return (
    <Link href={href ?? "#"}>
      <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground">
            {newsletter.senderIcon}
          </div>
          <span className="text-xs text-muted-foreground">{newsletter.sender}</span>
          <span className="text-xs text-muted-foreground/50">·</span>
          <span className="text-xs text-muted-foreground">{newsletter.sharedAt}</span>
        </div>

        <h3 className="font-medium text-card-foreground line-clamp-2 mb-2">{newsletter.title}</h3>

        {/* MVP: topics는 아직 없으니 렌더는 유지하되 빈 배열이면 스킵 */}
        {newsletter.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {newsletter.topics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Highlighter className="h-3.5 w-3.5" />
            {newsletter.highlightCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {newsletter.commentCount}
          </span>
        </div>

        <p className="text-sm text-muted-foreground truncate">{newsletter.latestActivity}</p>
      </div>
    </Link>
  )
}

export default function CircleDetailPage() {
  const params = useParams()
  const circleId = (params as any).circlesID as string // ✅ 폴더명이 [circlesID] 이라서 circlesID

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<FeedItem[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/circles/${circleId}/feed?limit=20`, {
          cache: "no-store",
          credentials: "include",
        })
        const data = await safeReadJson<ApiFeedResponse>(res)
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
        setError(e?.message ?? "Failed to load")
        setLoading(false)
      }
    }
    if (circleId) load()
    return () => {
      cancelled = true
    }
  }, [circleId])

  const sharedNewsletters = useMemo(() => {
    return items.map((it, idx) => ({
      id: `shared-${idx}`,
      emailId: it.emailId,
      title: it.subject,
      sender: it.sender,
      senderIcon: (it.sender || "UN").substring(0, 2).toUpperCase(),
      topics: [], // MVP: 비움
      highlightCount: it.highlightCount ?? 0,
      commentCount: it.commentCount ?? 0,
      latestActivity: it.latestActivity?.trim()
        ? it.latestActivity
        : it.snippet || "Shared an email",
      sharedAt: formatRelative(it.sharedAt),
    }))
  }, [items])

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/circles"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground">Circle</h1>
            <p className="text-xs text-muted-foreground">What your group is reading</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground pl-[52px]">
          {sharedNewsletters.length} shared newsletters
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="py-6 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="py-6 text-sm text-destructive">{error}</div>
        ) : sharedNewsletters.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">No shared emails yet.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {sharedNewsletters.map((newsletter) => (
              <SharedNewsletterCard key={newsletter.id} newsletter={newsletter} />
            ))}
          </div>
        )}

        <div className="h-24" />
      </div>
    </div>
  )
}
