// app/circles/[circleId]/page.tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { cookies, headers } from "next/headers"
import { ArrowLeft, Users, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShineBorder } from "@/components/ui/shine-border"
import CircleFeedClient from "./_components/CircleFeedClient"
import type { CircleFeedApiResponse, CircleFeedItem } from "@/types/circle-feed"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CircleApiResponse =
  | {
      ok: true
      circle: { id: string; name?: string | null; description?: string | null; [key: string]: any }
      counts: { members: number; shares: number }
    }
  | { ok: false; error?: string }

async function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (envUrl) return envUrl.replace(/\/+$/, "")
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (!host) return "http://localhost:3000"
  return `${proto}://${host}`
}

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
    headers: { ...(cookieHeader ? { cookie: cookieHeader } : {}) },
  })

  const text = await res.text()
  let data: any = null
  try {
    data = JSON.parse(text)
  } catch {}

  if (!res.ok) {
    const msg = data?.error || text || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return (data ?? {}) as T
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

export default async function CircleDetailPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const { circleId } = await params
  if (!circleId) notFound()

  let circleRes: CircleApiResponse
  try {
    circleRes = await fetchJsonFromApi<CircleApiResponse>(`/api/circles/${circleId}`)
  } catch {
    notFound()
  }
  if (!circleRes.ok) notFound()

  let feedRes: CircleFeedApiResponse
  try {
    feedRes = await fetchJsonFromApi<CircleFeedApiResponse>(`/api/circles/${circleId}/feed?limit=20`)
  } catch {
    feedRes = { ok: true, feed: [], nextCursor: null }
  }

  const initialFeed: CircleFeedItem[] = feedRes.ok ? (feedRes.feed ?? []) : []
  const initialNextCursor = feedRes.ok ? (feedRes.nextCursor ?? null) : null

  const circle = circleRes.circle
  const counts = circleRes.counts

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
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

        <div className="ml-auto hidden sm:block">
          <Button variant="secondary" className="rounded-xl">
            Settings
          </Button>
        </div>
      </div>

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

      <CircleFeedClient circleId={circleId} initialFeed={initialFeed} initialNextCursor={initialNextCursor} />
    </div>
  )
}
