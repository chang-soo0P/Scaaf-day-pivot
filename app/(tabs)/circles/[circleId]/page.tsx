// app/(tabs)/circles/[circleId]/page.tsx
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import CircleFeedClient from "./_components/CircleFeedClient"
import type { CircleFeedApiResponse } from "@/types/circle-feed"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ✅ Next 16: headers()가 Promise일 수 있으므로 async로 처리
async function getBaseUrl() {
  // 1) 운영/프리뷰에서 보통 들어있는 값들 우선
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL

  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`
  }

  // 2) 로컬/기타: 요청 헤더의 host로 조립 (✅ await 필요)
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "http"
  if (!host) return "http://localhost:3000"
  return `${proto}://${host}`
}

async function fetchCircleFeed(circleId: string) {
  const baseUrl = await getBaseUrl()
  const url = `${baseUrl}/api/circles/${circleId}/feed?limit=20`

  const res = await fetch(url, {
    cache: "no-store",
    headers: { "content-type": "application/json" },
  })

  const data = (await res.json()) as CircleFeedApiResponse
  if (!res.ok || !data.ok) return { feed: [], nextCursor: null }
  return { feed: data.feed ?? [], nextCursor: data.nextCursor ?? null }
}

export default async function CircleDetailPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const { circleId } = await params

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  // ✅ 멤버십 체크 (circle_members.id 같은 컬럼 사용 금지)
  const { data: membership, error: memErr } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) {
    console.error("[circles/[circleId]] membership error:", memErr)
    notFound()
  }
  if (!membership) notFound()

  // circle 기본 정보
  const { data: circle, error: circleErr } = await supabase
    .from("circles")
    .select("id,name")
    .eq("id", circleId)
    .maybeSingle()

  if (circleErr || !circle) {
    console.error("[circles/[circleId]] circle error:", circleErr)
    notFound()
  }

  // feed 초기 데이터
  const { feed, nextCursor } = await fetchCircleFeed(circleId)

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">{circle.name ?? "Circle"}</h1>
        <p className="text-xs text-muted-foreground">Circle detail</p>
      </div>

      <CircleFeedClient circleId={circleId} initialFeed={feed} initialNextCursor={nextCursor} />
    </div>
  )
}
