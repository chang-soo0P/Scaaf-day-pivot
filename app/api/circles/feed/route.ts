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

type DbShare = {
  id: string
  circle_id: string
  email_id: string
  shared_by: string | null
  created_at: string
}

type DbEmail = {
  id: string
  subject: string | null
  from_address: string | null
  received_at: string | null
}

type DbCircle = {
  id: string
  name: string | null
}

type DbUser = {
  id: string
  username: string | null
  display_name: string | null
  email_address: string | null
}

async function countByCircleId(admin: ReturnType<typeof createSupabaseAdminClient>, table: string, circleId: string) {
  // PostgREST count exact (HEAD)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (admin as any)
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("circle_id", circleId)

  if (error) return null
  return typeof count === "number" ? count : null
}

/**
 * GET /api/circles/feed?limit=20&cursor=ISO
 * cursor: 마지막 아이템의 sharedAt(created_at) ISO를 넘기면 created_at < cursor 로 페이징
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 50)
  const cursor = req.nextUrl.searchParams.get("cursor") // ISO string

  // ✅ 로그인 유저 확인
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  // 1) 내가 속한 circle_id 목록
  const { data: memberships, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", user.id)

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })

  const circleIds = (memberships ?? []).map((m: any) => m.circle_id).filter(Boolean)
  if (circleIds.length === 0) {
    return NextResponse.json({ ok: true, feed: [], nextCursor: null }, { status: 200 })
  }

  // 2) circle_emails에서 최근 공유글
  let shareQuery = admin
    .from("circle_emails")
    .select("id, circle_id, email_id, shared_by, created_at")
    .in("circle_id", circleIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) shareQuery = shareQuery.lt("created_at", cursor)

  const { data: sharesRaw, error: shareErr } = await shareQuery
  if (shareErr) return NextResponse.json({ ok: false, error: shareErr.message }, { status: 500 })

  const shares = (sharesRaw ?? []) as DbShare[]
  if (shares.length === 0) {
    return NextResponse.json({ ok: true, feed: [], nextCursor: null }, { status: 200 })
  }

  const nextCursor = shares.length === limit ? shares[shares.length - 1]?.created_at ?? null : null

  const emailIds = Array.from(new Set(shares.map((s) => s.email_id).filter(Boolean)))
  const circleIdSet = Array.from(new Set(shares.map((s) => s.circle_id).filter(Boolean)))
  const userIds = Array.from(new Set(shares.map((s) => s.shared_by).filter(Boolean))) as string[]

  // 3) inbox_emails 메타
  const { data: emailsRaw, error: emailErr } = await admin
    .from("inbox_emails")
    .select("id, subject, from_address, received_at")
    .in("id", emailIds)

  if (emailErr) return NextResponse.json({ ok: false, error: emailErr.message }, { status: 500 })

  const emails = (emailsRaw ?? []) as DbEmail[]
  const emailById = new Map(emails.map((e) => [e.id, e]))

  // 4) circles 메타 (name)
  const { data: circlesRaw, error: circleErr } = await admin
    .from("circles")
    .select("id, name")
    .in("id", circleIdSet)

  if (circleErr) return NextResponse.json({ ok: false, error: circleErr.message }, { status: 500 })

  const circles = (circlesRaw ?? []) as DbCircle[]
  const circleById = new Map(circles.map((c) => [c.id, c]))

  // 5) ✅ sharedByProfile: public.users에서 가져오기 (profiles 없음)
  // avatar_url 컬럼이 없으므로 avatarUrl은 null로 내려줌
  let users: DbUser[] = []
  if (userIds.length > 0) {
    const { data: usersRaw, error: usersErr } = await admin
      .from("users")
      .select("id, username, display_name, email_address")
      .in("id", userIds)

    if (!usersErr && usersRaw) users = usersRaw as DbUser[]
  }
  const userById = new Map(users.map((u) => [u.id, u]))

  // 6) ✅ circleMemberCount / circleShareCount (현재 페이지에 등장한 circle만 계산)
  const countPairs = await Promise.all(
    circleIdSet.map(async (cid) => {
      const [memberCount, shareCount] = await Promise.all([
        countByCircleId(admin, "circle_members", cid),
        countByCircleId(admin, "circle_emails", cid),
      ])
      return [cid, { memberCount, shareCount }] as const
    })
  )
  const countByCircle = new Map(countPairs)

  const feed = shares.map((s) => {
    const e = emailById.get(s.email_id)
    const c = circleById.get(s.circle_id)
    const u = s.shared_by ? userById.get(s.shared_by) : null
    const counts = countByCircle.get(s.circle_id)

    const name =
      (u?.display_name && u.display_name.trim()) ||
      (u?.username && u.username.trim()) ||
      "Member"

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
            name,
            avatarUrl: null as string | null, // ✅ users 테이블에 avatar 컬럼 없음
          }
        : null,

      subject: e?.subject ?? null,
      fromAddress: e?.from_address ?? null,
      receivedAt: e?.received_at ?? null,

      // (옵션) 나중에 집계 붙이기
      highlightCount: 0,
      commentCount: 0,
      latestActivity: null,

      circleMemberCount: counts?.memberCount ?? null,
      circleShareCount: counts?.shareCount ?? null,
    }
  })

  return NextResponse.json({ ok: true, feed, nextCursor }, { status: 200 })
}
