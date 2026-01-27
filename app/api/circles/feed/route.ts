// /app/api/circles/feed/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies() // ✅ Next15: Promise

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

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100)

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
    return NextResponse.json({ ok: true, feed: [] }, { status: 200 })
  }

  // 2) circle_emails에서 최근 공유글
  const { data: shares, error: shareErr } = await admin
    .from("circle_emails")
    .select("id, circle_id, email_id, shared_by, created_at")
    .in("circle_id", circleIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (shareErr) return NextResponse.json({ ok: false, error: shareErr.message }, { status: 500 })

  const emailIds = Array.from(new Set((shares ?? []).map((s: any) => s.email_id).filter(Boolean)))
  if (emailIds.length === 0) {
    return NextResponse.json({ ok: true, feed: [] }, { status: 200 })
  }

  // 3) inbox_emails 메타 붙이기
  const { data: emails, error: emailErr } = await admin
    .from("inbox_emails")
    .select("id, subject, from_address, received_at")
    .in("id", emailIds)

  if (emailErr) return NextResponse.json({ ok: false, error: emailErr.message }, { status: 500 })

  const emailById = new Map((emails ?? []).map((e: any) => [e.id, e]))

  // (옵션) highlights count 붙이고 싶으면 여기서 email_highlights를 emailIds로 group 해서 맵 만들면 됨.
  // 지금은 0으로 반환해도 Topics Feed 표시엔 충분.

  const feed = (shares ?? []).map((s: any) => {
    const e = emailById.get(s.email_id)
    return {
      id: s.id,
      circleId: s.circle_id,
      emailId: s.email_id,
      sharedAt: s.created_at,
      sharedBy: s.shared_by ?? null,
      subject: e?.subject ?? null,
      fromAddress: e?.from_address ?? null,
      receivedAt: e?.received_at ?? null,
      highlightCount: 0,
      commentCount: 0,
      latestActivity: null,
    }
  })

  return NextResponse.json({ ok: true, feed }, { status: 200 })
}
