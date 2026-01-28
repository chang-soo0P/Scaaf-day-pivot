import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies() // Next15 Promise
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

/**
 * Cursor pagination:
 * - cursor = ISO timestamp of last item's sharedAt
 * - fetch created_at < cursor
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 50)
  const cursor = req.nextUrl.searchParams.get("cursor") // ISO string
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  // 1) my circle ids
  const { data: memberships, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", user.id)

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })

  const circleIds = (memberships ?? []).map((m: any) => m.circle_id).filter(Boolean)
  if (circleIds.length === 0) {
    return NextResponse.json({ ok: true, feed: [], nextCursor: null }, { status: 200 })
  }

  // 2) circle_emails (shared items)
  let shareQuery = admin
    .from("circle_emails")
    .select("id, circle_id, email_id, shared_by, created_at")
    .in("circle_id", circleIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) shareQuery = shareQuery.lt("created_at", cursor)

  const { data: sharesRaw, error: shareErr } = await shareQuery
  if (shareErr) return NextResponse.json({ ok: false, error: shareErr.message }, { status: 500 })

  const shares = (sharesRaw ?? []) as Array<{
    id: string
    circle_id: string
    email_id: string
    shared_by: string | null
    created_at: string
  }>

  if (shares.length === 0) {
    return NextResponse.json({ ok: true, feed: [], nextCursor: null }, { status: 200 })
  }

  const nextCursor = shares.length === limit ? shares[shares.length - 1]?.created_at ?? null : null

  const emailIds = Array.from(new Set(shares.map((s) => s.email_id).filter(Boolean)))
  const circleIdSet = Array.from(new Set(shares.map((s) => s.circle_id).filter(Boolean)))
  const userIds = Array.from(new Set(shares.map((s) => s.shared_by).filter(Boolean))) as string[]

  // 3) inbox_emails meta
  const { data: emailsRaw, error: emailErr } = await admin
    .from("inbox_emails")
    .select("id, subject, from_address, received_at")
    .in("id", emailIds)

  if (emailErr) return NextResponse.json({ ok: false, error: emailErr.message }, { status: 500 })

  const emails = (emailsRaw ?? []) as Array<{
    id: string
    subject: string | null
    from_address: string | null
    received_at: string | null
  }>
  const emailById = new Map(emails.map((e) => [e.id, e]))

  // 4) circles meta (name)
  const { data: circlesRaw, error: circleErr } = await admin
    .from("circles")
    .select("id, name")
    .in("id", circleIdSet)

  if (circleErr) return NextResponse.json({ ok: false, error: circleErr.message }, { status: 500 })

  const circles = (circlesRaw ?? []) as Array<{ id: string; name: string | null }>
  const circleById = new Map(circles.map((c) => [c.id, c]))

  // 5) sharedBy profile (name/avatar)
  // ⚠️ 너희 프로젝트 테이블명이 profiles 아닐 수도 있음.
  // 보통은 profiles(id, name, avatar_url) 형태.
  const { data: profilesRaw, error: profErr } = await admin
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", userIds)

  // profiles 테이블이 없으면: 에러를 무시하고 null로 내려줌 (피드 표시가 죽지 않게)
  const profiles =
    profErr || !profilesRaw
      ? []
      : ((profilesRaw ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null }>)
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  const feed = shares.map((s) => {
    const e = emailById.get(s.email_id)
    const c = circleById.get(s.circle_id)
    const p = s.shared_by ? profileById.get(s.shared_by) : null

    return {
      id: s.id,
      circleId: s.circle_id,
      circleName: c?.name ?? "Circle",
      emailId: s.email_id,
      sharedAt: s.created_at,
      sharedBy: s.shared_by ?? null,
      sharedByProfile: s.shared_by
        ? {
            id: s.shared_by,
            name: p?.name ?? "Member",
            avatarUrl: p?.avatar_url ?? null,
          }
        : null,

      subject: e?.subject ?? null,
      fromAddress: e?.from_address ?? null,
      receivedAt: e?.received_at ?? null,

      highlightCount: 0,
      commentCount: 0,
      latestActivity: null,
    }
  })

  return NextResponse.json({ ok: true, feed, nextCursor }, { status: 200 })
}
