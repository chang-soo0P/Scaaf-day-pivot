"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, MessageSquare, Highlighter } from "lucide-react"
import { emailDetailHref } from "@/lib/email-href"

type Circle = {
  id: string
  name: string | null
  memberCount?: number
}

type FeedItem = {
  id: string
  emailId: string
  sharedAt: string // ISO
  sharedBy?: string | null

  subject: string | null
  fromAddress: string | null
  receivedAt: string | null

  highlightCount?: number
  commentCount?: number
  latestActivity?: string | null
}

type ApiCircleResponse = { ok: true; circle: Circle } | { ok: false; error?: string }

// ✅ backend(/api/circles/[circleId]/feed) 응답 형태: { ok:true, items:[...] }
type ApiFeedItemRaw = {
  id: string
  circleId: string
  emailId: string
  sharedBy?: string | null
  sharedAt: string
  email: {
    id: string
    subject: string | null
    fromAddress: string | null
    receivedAt: string | null
  } | null
}
type ApiFeedResponse = { ok: true; items: ApiFeedItemRaw[] } | { ok: false; error?: string }

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
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

function SharedNewsletterCard({ item }: { item: FeedItem }) {
  const href = emailDetailHref(item.emailId) ?? "#"
  const initials = (item.fromAddress ?? "??").slice(0, 2).toUpperCase()

  return (
    <Link href={href}>
      <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground">
            {initials}
          </div>
          <span className="text-xs text-muted-foreground">{item.fromAddress ?? "Unknown"}</span>
          <span className="text-xs text-muted-foreground/50">·</span>
          <span className="text-xs text-muted-foreground">{formatRelative(item.sharedAt)}</span>
        </div>

        <h3 className="font-medium text-card-foreground line-clamp-2 mb-3">
          {item.subject ?? "(no subject)"}
        </h3>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Highlighter className="h-3.5 w-3.5" />
            {item.highlightCount ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {item.commentCount ?? 0}
          </span>
        </div>

        <p className="text-sm text-muted-foreground truncate">
          {item.latestActivity ?? "New share"}
        </p>
      </div>
    </Link>
  )
}

export default function CircleDetailPage() {
  const params = useParams()

  // ✅ 폴더명이 [circlesID] 이므로 여기 키도 circlesID
  const circleId = String((params as any)?.circlesID ?? "").trim()

  const [circle, setCircle] = useState<Circle | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isUuid = useMemo(
    () =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        circleId
      ),
    [circleId]
  )

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!circleId) {
        setError("Missing circle id")
        setLoading(false)
        return
      }
      if (!isUuid) {
        setError(`Invalid circle id (uuid expected): ${circleId}`)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // 1) circle meta: 있으면 표시(없어도 진행)
        const cRes = await fetch(`/api/circles/${circleId}`, {
          cache: "no-store",
          credentials: "include",
        })
        const cData = await safeReadJson<ApiCircleResponse>(cRes)
        if (!cancelled && cRes.ok && (cData as any)?.ok) {
          setCircle((cData as any).circle)
        }

        // 2) feed: ✅ { ok:true, items:[...] } 로 받음
        const fRes = await fetch(`/api/circles/${circleId}/feed?limit=20`, {
          cache: "no-store",
          credentials: "include",
        })
        const fData = await safeReadJson<ApiFeedResponse>(fRes)

        if (cancelled) return

        if (!fRes.ok || !(fData as any)?.ok) {
          setError((fData as any)?.error ?? `Failed to load feed (HTTP ${fRes.status})`)
          setFeed([])
          setLoading(false)
          return
        }

        const items: ApiFeedItemRaw[] = (fData as any).items ?? []
        const mapped: FeedItem[] = items.map((it) => ({
          id: it.id,
          emailId: it.emailId,
          sharedAt: it.sharedAt,
          sharedBy: it.sharedBy ?? null,

          subject: it.email?.subject ?? null,
          fromAddress: it.email?.fromAddress ?? null,
          receivedAt: it.email?.receivedAt ?? null,

          // (옵션) 아직 백엔드에서 count/activity 안 내려주면 0/기본값 처리
          highlightCount: 0,
          commentCount: 0,
          latestActivity: null,
        }))

        setFeed(mapped)
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message ?? "Failed to load circle")
        setFeed([])
        setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [circleId, isUuid])

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

          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">{circle?.name ?? "Circle"}</h1>
            {/* ✅ description 컬럼 없음: 고정 문구로 */}
            <p className="text-xs text-muted-foreground truncate">What your group is reading</p>
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground pl-[52px]">
          {feed.length} shared newsletters
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="py-6 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm font-semibold text-foreground">Failed to load</div>
            <div className="mt-1 text-sm text-muted-foreground">{error}</div>
          </div>
        ) : feed.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No shared newsletters yet.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {feed.map((it) => (
              <SharedNewsletterCard key={it.id} item={it} />
            ))}
          </div>
        )}

        <div className="h-24" />
      </div>
    </div>
  )
}
