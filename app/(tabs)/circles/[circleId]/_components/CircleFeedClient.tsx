"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2,
  Mail,
  Copy,
  Check,
  MessageCircle,
  Highlighter,
  Users,
  Hash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CircleFeedItem, CircleFeedApiResponse } from "@/types/circle-feed"

type InviteResp =
  | { ok: true; code: string; inviteUrl: string; expiresAt: string; maxUses: number }
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

function StatPill({
  icon,
  children,
  title,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  title?: string
}) {
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

function ShareRow({ item }: { item: CircleFeedItem }) {
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

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              {item.sharedByProfile?.avatarUrl ? (
                <Image
                  src={item.sharedByProfile.avatarUrl}
                  alt=""
                  width={18}
                  height={18}
                  className="rounded-full"
                />
              ) : (
                <div className="h-[18px] w-[18px] rounded-full bg-secondary" />
              )}
              <span className="text-xs text-muted-foreground">
                shared by {item.sharedByProfile?.name ?? "Member"}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <StatPill title="Highlights" icon={<Highlighter className="h-3 w-3" />}>
                {Number(item.highlightCount ?? 0)}
              </StatPill>
              <StatPill title="Comments" icon={<MessageCircle className="h-3 w-3" />}>
                {Number(item.commentCount ?? 0)}
              </StatPill>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function InviteDialog({ circleId }: { circleId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/circles/${circleId}/invite`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expiresInDays: 7, maxUses: 50 }),
      })

      const data = await safeReadJson<InviteResp>(res)
      if (!res.ok || !data.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`)

      setInviteUrl(data.inviteUrl)
    } catch (e: any) {
      setError(e?.message ?? "Failed to create invite")
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  useEffect(() => {
    if (open && !inviteUrl) void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <Button variant="secondary" className="rounded-xl" onClick={() => setOpen(true)}>
        Invite
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-4 shadow-xl ring-1 ring-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Invite link</h3>
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Share this link to invite someone into the circle.
            </p>

            <div className="mt-3 rounded-xl bg-secondary p-3">
              <p className="break-all text-xs text-secondary-foreground">
                {inviteUrl || "Generating..."}
              </p>
            </div>

            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

            <div className="mt-4 flex gap-2">
              <Button className="flex-1 rounded-xl" disabled={!inviteUrl || loading} onClick={copy}>
                {copied ? (
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4" /> Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Copy className="h-4 w-4" /> Copy link
                  </span>
                )}
              </Button>

              <Button variant="secondary" className="rounded-xl" disabled={loading} onClick={generate}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Regenerate
                  </span>
                ) : (
                  "Regenerate"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

// --- Main ---
export default function CircleFeedClient({
  circleId,
  initialFeed,
  initialNextCursor,
}: {
  circleId: string
  initialFeed: CircleFeedItem[]
  initialNextCursor: string | null
}) {
  const [items, setItems] = useState<CircleFeedItem[]>(initialFeed ?? [])
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

      const data = await safeReadJson<CircleFeedApiResponse>(res)
      if (!res.ok || !data.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`)

      setNextCursor(data.nextCursor ?? null)

      setItems((prev) => {
        const seen = new Set(prev.map((x: CircleFeedItem) => x.id))
        const appended = (data.feed ?? []).filter((x: CircleFeedItem) => !seen.has(x.id))
        return [...prev, ...appended]
      })
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more")
    } finally {
      setLoadingMore(false)
    }
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, loadingMore])

  const rows = useMemo(() => items.map((it) => <ShareRow key={it.id} item={it} />), [items])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Users className="h-4 w-4" />
          Circle activity
        </div>
        <InviteDialog circleId={circleId} />
      </div>

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
            <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Hash className="h-4 w-4" /> Scroll to load more
            </div>
          ) : rows.length ? (
            <div className="text-xs text-muted-foreground">You’re all caught up</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
