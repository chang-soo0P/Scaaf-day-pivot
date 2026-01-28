// app/circles/[circleId]/page.tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { cookies, headers } from "next/headers"
import { ArrowLeft, Users, Hash, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShineBorder } from "@/components/ui/shine-border"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CircleApiResponse =
  | {
      ok: true
      circle: {
        id: string
        name?: string | null
        created_at?: string | null
        owner_id?: string | null
        description?: string | null
        [key: string]: any
      }
      counts: { members: number; shares: number }
    }
  | { ok: false; error?: string }

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
  circleMemberCount?: number | null
  circleShareCount?: number | null
}

type FeedApiResponse =
  | { ok: true; items?: any[]; feed?: FeedItem[]; nextCursor?: string | null }
  | { ok: false; error?: string }

// ✅ 절대 URL 생성 (env 우선, 없으면 요청 헤더 기반) - Next15: headers()는 Promise
async function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (envUrl) return envUrl.replace(/\/+$/, "")

  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (!host) return "http://localhost:3000"
  return `${proto}://${host}`
}

// ✅ 현재 요청 쿠키를 API fetch에 그대로 전달 (Next15: cookies()도 Promise)
async function fetchJsonFromApi<T>(path: string): Promise<T> {
  const baseUrl = await getBaseUrl()
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`

  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })

  const text = await res.text()
  let data: any = null
  try {
    data = JSON.parse(text)
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = data?.error || text || `HTTP ${res.status}`
    throw new Error(msg)
  }

  return (data ?? {}) as T
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

function CircleStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
    </div>
  )
}

function ShareRow({
  subject,
  fromAddress,
  sharedAt,
  emailId,
}: {
  subject: string
  fromAddress: string | null
  sharedAt: string
  emailId: string
}) {
  return (
    <Link
      href={`/inbox/${emailId}`}
      prefetch={false}
      className="block rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Mail className="h-4 w-4 text-secondary-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground truncate">from {extractNameFromEmail(fromAddress)}</p>
            <p className="text-xs text-muted-foreground">{fmtDate(sharedAt)}</p>
          </div>

          <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {subject}
          </h3>
        </div>
      </div>
    </Link>
  )
}

export default async function CircleDetailPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const { circleId } = await params
  if (!circleId) notFound()

  // ✅ (1) circle 메타 + 권한(멤버십) 체크는 API가 수행
  let circleRes: CircleApiResponse
  try {
    circleRes = await fetchJsonFromApi<CircleApiResponse>(`/api/circles/${circleId}`)
  } catch {
    notFound()
  }
  if (!circleRes || !("ok" in circleRes) || !circleRes.ok) notFound()

  const circle = circleRes.circle
  const counts = circleRes.counts

  // ✅ (2) circle feed: /api/circles/feed에서 가져온 뒤 서버에서 circleId로 필터링 (MVP)
  let feedRes: FeedApiResponse
  try {
    feedRes = await fetchJsonFromApi<FeedApiResponse>(`/api/circles/feed?limit=50`)
  } catch {
    feedRes = { ok: true, feed: [], items: [], nextCursor: null }
  }

  const flatFeed: FeedItem[] = Array.isArray((feedRes as any).feed) ? (feedRes as any).feed : []
  const filtered = flatFeed.filter((x) => x.circleId === circleId)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/circles"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
        >
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </Link>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-foreground">{circle?.name ?? "Circle"}</h1>
          <p className="text-sm text-muted-foreground">Circle detail</p>
        </div>
      </div>

      {/* Stats */}
      <ShineBorder
        className="mb-6 shadow-sm ring-1 ring-border"
        borderRadius={16}
        color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
        duration={10}
      >
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            <CircleStat icon={<Users className="h-4 w-4" />} label="Members" value={counts.members} />
            <CircleStat icon={<Hash className="h-4 w-4" />} label="Shares" value={counts.shares} />
          </div>

          {circle?.description ? (
            <p className="mt-3 text-sm text-muted-foreground">{circle.description}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Share newsletters to this circle and discuss together.
            </p>
          )}
        </div>
      </ShineBorder>

      {/* Feed */}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Shared emails</h2>
          <p className="text-xs text-muted-foreground mt-1">Showing latest shares (MVP).</p>
        </div>
        <Button variant="secondary" className="rounded-xl">
          Invite
        </Button>
      </div>

      {filtered.length ? (
        <div className="space-y-3">
          {filtered.map((it) => (
            <ShareRow
              key={it.id}
              emailId={it.emailId}
              subject={it.subject ?? "(no subject)"}
              fromAddress={it.fromAddress}
              sharedAt={it.sharedAt}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-border text-sm text-muted-foreground">
          No shares yet. Go to an email and “Share to circle”.
        </div>
      )}
    </div>
  )
}
