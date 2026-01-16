import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

function getLimit(req: NextRequest, fallback = 50) {
  const n = Number(req.nextUrl.searchParams.get("limit") ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(100, Math.floor(n)))
}

export async function GET(req: NextRequest) {
  const limit = getLimit(req, 50)

  // 1) 로그인 유저 확인
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: u, error: userErr } = await supabaseAuth.auth.getUser()
  if (userErr || !u.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const userId = u.user.id
  const admin = createSupabaseAdminClient()

  // 2) 내 circle membership 가져오기
  const { data: memberships, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", userId)
    .limit(limit)

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })

  const circleIds = (memberships ?? [])
    .map((m: any) => m.circle_id)
    .filter(Boolean)

  if (circleIds.length === 0) {
    return NextResponse.json({ ok: true, circles: [] }, { status: 200 })
  }

  // 3) circles 메타 (✅ description/slug select 금지)
  const { data: circles, error: cErr } = await admin
    .from("circles")
    .select("id, name, created_at")
    .in("id", circleIds)
    .order("created_at", { ascending: false })

  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })

  // 4) 멤버수/공유수 카운트
  const [{ data: memberRows, error: mcErr }, { data: shareRows, error: scErr }] = await Promise.all([
    admin
      .from("circle_members")
      .select("circle_id")
      .in("circle_id", circleIds),
    admin
      .from("circle_emails")
      .select("circle_id")
      .in("circle_id", circleIds),
  ])

  if (mcErr) return NextResponse.json({ ok: false, error: mcErr.message }, { status: 500 })
  if (scErr) return NextResponse.json({ ok: false, error: scErr.message }, { status: 500 })

  const memberCountMap = new Map<string, number>()
  for (const r of memberRows ?? []) {
    const k = (r as any).circle_id
    memberCountMap.set(k, (memberCountMap.get(k) ?? 0) + 1)
  }

  const sharedCountMap = new Map<string, number>()
  for (const r of shareRows ?? []) {
    const k = (r as any).circle_id
    sharedCountMap.set(k, (sharedCountMap.get(k) ?? 0) + 1)
  }

  const out = (circles ?? []).map((c: any) => ({
    id: c.id,
    name: c.name ?? "Circle",
    memberCount: memberCountMap.get(c.id) ?? 0,
    sharedCount: sharedCountMap.get(c.id) ?? 0,
    createdAt: c.created_at,
  }))

  return NextResponse.json({ ok: true, circles: out }, { status: 200 })
}
