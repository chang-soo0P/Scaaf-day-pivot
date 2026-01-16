import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ circleId: string }> } // ✅ Next15 params Promise

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

async function createSupabaseAuthedServerClient() {
  // ✅ Next15: cookies() is Promise
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

export async function GET(req: NextRequest, ctx: Ctx) {
  const { circleId } = await ctx.params
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? "20")

  if (!circleId) {
    return NextResponse.json({ ok: false, error: "Missing circle id" }, { status: 400 })
  }

  // ✅ 현재는 UUID 기반으로만 처리 (slug 쓰면 여기서 막힘)
  if (!isUuid(circleId)) {
    return NextResponse.json(
      { ok: false, error: `Invalid circle id (expected uuid): ${circleId}` },
      { status: 400 }
    )
  }

  // ✅ 로그인 유저 확인
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()

  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const user = userData.user
  const admin = createSupabaseAdminClient()

  // ✅ 멤버십 체크 (circle_members: circle_id + user_id)
  const { data: member, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id, user_id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  // ✅ feed: circle_emails + inbox_emails 조인
  // FK가 circle_emails.email_id -> inbox_emails.id 로 잡혀있다는 전제
  const { data: rows, error } = await admin
    .from("circle_emails")
    .select(
      `
        id,
        circle_id,
        email_id,
        shared_by,
        created_at,
        inbox_emails:inbox_emails (
          id,
          subject,
          from_address,
          received_at
        )
      `
    )
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const items = (rows ?? []).map((r: any) => ({
    id: r.id,
    circleId: r.circle_id,
    emailId: r.email_id,
    sharedBy: r.shared_by,
    sharedAt: r.created_at,
    email: r.inbox_emails
      ? {
          id: r.inbox_emails.id,
          subject: r.inbox_emails.subject ?? "(no subject)",
          fromAddress: r.inbox_emails.from_address ?? null,
          receivedAt: r.inbox_emails.received_at ?? null,
        }
      : null,
  }))

  return NextResponse.json({ ok: true, items }, { status: 200 })
}
