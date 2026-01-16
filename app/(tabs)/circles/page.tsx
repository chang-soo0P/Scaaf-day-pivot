"use client"

import { useEffect, useMemo, useState } from "react"
import { X, Link2, Check } from "lucide-react"
import { CircleCard } from "@/components/circle-card"

const friends = [
  { id: "1", name: "Marvin", handle: "@marvin", color: "#6366f1" },
  { id: "2", name: "Jane", handle: "@jane", color: "#ec4899" },
  { id: "3", name: "David", handle: "@david", color: "#10b981" },
  { id: "4", name: "Sophie", handle: "@sophie", color: "#f59e0b" },
  { id: "5", name: "Alex", handle: "@alex", color: "#3b82f6" },
  { id: "6", name: "Emma", handle: "@emma", color: "#8b5cf6" },
  { id: "7", name: "Chris", handle: "@chris", color: "#14b8a6" },
  { id: "8", name: "Yuna", handle: "@yuna", color: "#f43f5e" },
]

type Member = {
  id: string
  name: string
  color: string
}

type CircleUI = {
  id: string // ✅ uuid
  name: string
  members: Member[] // UI용(실제 멤버 목록이 API에 없으면 placeholder)
  sharedNewsletterCount: number
  latestActivity: string
  hasUnread?: boolean
}

/** API 응답은 프로젝트마다 조금씩 달라서 넓게 수용 */
type ApiCircle = {
  id: string
  name?: string | null
  title?: string | null
  memberCount?: number | null
  members_count?: number | null
  sharedNewsletterCount?: number | null
  shared_newsletter_count?: number | null
  sharedCount?: number | null
  latestActivity?: string | null
  latest_activity?: string | null
  hasUnread?: boolean | null
}

type ApiResponse =
  | { ok: true; circles: ApiCircle[] }
  | { ok: false; error?: string }

const AVATAR_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#14b8a6", "#f43f5e"] as const

function safePickNumber(...vals: Array<number | null | undefined>): number {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v
  }
  return 0
}

function safePickString(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function buildPlaceholderMembers(count: number): Member[] {
  const n = Math.max(0, Math.min(count, 4)) // UI는 3~4명만 보이면 충분
  return Array.from({ length: n }).map((_, idx) => ({
    id: `placeholder-${idx}`,
    name: String.fromCharCode(65 + idx), // A,B,C...
    color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
  }))
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` }
  }
}

export default function CirclesPage() {
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // ✅ DB 연동 circles
  const [circles, setCircles] = useState<CircleUI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText("https://scaaf.day/join?ref=marvin123")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/circles?limit=50", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        })

        const data = (await readJson(res)) as ApiResponse

        if (cancelled) return

        if (!res.ok || !data || (data as any).ok !== true) {
          setError((data as any)?.error ?? `Failed to load circles (HTTP ${res.status})`)
          setCircles([])
          setLoading(false)
          return
        }

        const rows = (data as any).circles as ApiCircle[]

        const mapped: CircleUI[] = (rows ?? []).map((c) => {
          const name = safePickString(c.name, c.title) || "Untitled circle"
          const memberCount = safePickNumber(c.memberCount, c.members_count)
          const sharedCount = safePickNumber(
            c.sharedNewsletterCount,
            c.shared_newsletter_count,
            c.sharedCount
          )
          const latest = safePickString(c.latestActivity, c.latest_activity) || "No recent activity"

          return {
            id: c.id, // ✅ uuid 그대로
            name,
            members: buildPlaceholderMembers(memberCount || 0),
            sharedNewsletterCount: sharedCount,
            latestActivity: latest,
            hasUnread: Boolean(c.hasUnread),
          }
        })

        setCircles(mapped)
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message ?? "Failed to load circles")
        setCircles([])
        setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const headerSubtitle = useMemo(() => {
    if (loading) return "Loading your circles…"
    if (error) return "Failed to load circles"
    return "Browse what your groups are reading"
  }, [loading, error])

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Circles</h2>
        <p className="mt-1 text-sm text-muted-foreground">{headerSubtitle}</p>
      </div>

      <div className="mb-6 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">My Friends</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Manage friends to invite to circles.</p>
          </div>
          {/* Stacked avatars (max 3) */}
          <div className="flex -space-x-2">
            {friends.slice(0, 3).map((friend, index) => (
              <div
                key={friend.id}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-xs font-medium text-white"
                style={{ backgroundColor: friend.color, zIndex: 3 - index }}
              >
                {friend.name[0]}
              </div>
            ))}
            {friends.length > 3 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-medium text-muted-foreground">
                +{friends.length - 3}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsFriendsModalOpen(true)}
            className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            View friend list
          </button>
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Invite friends
          </button>
        </div>
      </div>

      {/* Circles list */}
      {loading ? (
        <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">Loading…</div>
      ) : error ? (
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="text-sm font-semibold text-foreground">Failed to load</div>
          <div className="mt-1 text-sm text-muted-foreground">{error}</div>
        </div>
      ) : circles.length === 0 ? (
        <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">
          No circles yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {circles.map((circle) => (
            <CircleCard
              key={circle.id}
              id={circle.id} // ✅ 이제 uuid가 들어감 → 링크가 /circles/<uuid>로 바뀜
              name={circle.name}
              members={circle.members}
              sharedNewsletterCount={circle.sharedNewsletterCount}
              latestActivity={circle.latestActivity}
              hasUnread={circle.hasUnread}
            />
          ))}
        </div>
      )}

      {isFriendsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setIsFriendsModalOpen(false)}
        >
          <div className="w-full max-w-lg rounded-t-3xl bg-background pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <h3 className="text-lg font-semibold text-foreground">Friend list</h3>
              <button
                type="button"
                onClick={() => setIsFriendsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-secondary"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-4">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: friend.color }}
                  >
                    {friend.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{friend.name}</p>
                    <p className="text-sm text-muted-foreground">{friend.handle}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 pt-4">
              <button
                type="button"
                onClick={() => setIsFriendsModalOpen(false)}
                className="w-full rounded-full border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div className="w-full max-w-lg rounded-t-3xl bg-background pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <h3 className="text-lg font-semibold text-foreground">Invite friends</h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-secondary"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 pt-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Copy the invite link below and share via iMessage, WhatsApp, etc.
              </p>

              <div className="mb-4 flex items-center gap-2 rounded-xl bg-secondary p-3">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm text-foreground">scaaf.day/join?ref=marvin123</span>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-colors ${
                  copied ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  "Copy link"
                )}
              </button>
            </div>

            <div className="px-4 pt-4">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="w-full rounded-full border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
