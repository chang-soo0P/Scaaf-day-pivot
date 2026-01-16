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

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100)

  // 1) 로그인 유저 확인
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()

  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const user = userData.user
  const admin = createSupabaseAdminClient()

  // 2) 내가 속한 circle 목록
  const { data: memberships, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", user.id)

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })

  const circleIds = (memberships ?? []).map((m: any) => m.circle_id).filter(Boolean)
  if (circleIds.length === 0) {
    return NextResponse.json({ ok: true, feed: [] }, { status: 200 })
  }

  // 3) 글로벌 피드: circle_emails + circles + inbox_emails join
  const { data: rows, error } = await admin
    .from("circle_emails")
    .select(
      `
      id,
      circle_id,
      email_id,
      shared_by,
      created_at,
      circles:circle_id ( id, name ),
      inbox_emails:email_id ( id, subject, from_address, received_at )
    `
    )
    .in("circle_id", circleIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const feed = (rows ?? []).map((r: any) => ({
    id: r.id,
    circleId: r.circle_id,
    circleName: r.circles?.name ?? null,
    emailId: r.email_id,
    sharedAt: r.created_at,
    sharedBy: r.shared_by ?? null,
    subject: r.inbox_emails?.subject ?? null,
    fromAddress: r.inbox_emails?.from_address ?? null,
    receivedAt: r.inbox_emails?.received_at ?? null,
  }))

  return NextResponse.json({ ok: true, feed }, { status: 200 })
}
