import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ circleId: string }> } // Next15 params Promise

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

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

export async function GET(req: NextRequest, ctx: Ctx) {
  const { circleId: circleIdOrSlug } = await ctx.params
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20") || 20, 50)

  // ✅ 로그인 유저 확인(쿠키 기반)
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  // ✅ 1) circleIdOrSlug -> circle uuid로 resolve
  let circleId = circleIdOrSlug

  if (!isUuid(circleIdOrSlug)) {
    const { data: circleRow, error: circleErr } = await admin
      .from("circles")
      .select("id")
      .eq("slug", circleIdOrSlug)
      .maybeSingle()

    if (circleErr) return NextResponse.json({ ok: false, error: circleErr.message }, { status: 500 })
    if (!circleRow?.id) {
      // slug가 DB에 없으면 404(혹은 200 ignored로 바꿔도 됨)
      return NextResponse.json({ ok: false, error: "Circle not found" }, { status: 404 })
    }
    circleId = circleRow.id
  }

  // ✅ 2) 멤버십 체크 (circle_members: circle_id, user_id)
  const { data: member, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id, user_id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  // ✅ 3) feed: circle_emails -> inbox_emails
  // (컬럼명은 네 DB 기준으로 필요시 조정)
  const { data: links, error: linkErr } = await admin
    .from("circle_emails")
    .select("email_id, created_at")
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (linkErr) return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 })

  const emailIds = (links ?? []).map((r) => r.email_id).filter(Boolean)
  if (emailIds.length === 0) {
    return NextResponse.json({ ok: true, items: [] }, { status: 200 })
  }

  const { data: emails, error: emailErr } = await admin
    .from("inbox_emails")
    .select("id, from_address, subject, received_at, body_text, body_html")
    .in("id", emailIds)

  if (emailErr) return NextResponse.json({ ok: false, error: emailErr.message }, { status: 500 })

  const byId = new Map((emails ?? []).map((e) => [e.id, e]))

  // 링크 순서 유지해서 반환
  const items = (links ?? [])
    .map((l) => {
      const e = byId.get(l.email_id)
      if (!e) return null
      return {
        circle_id: circleId,
        email_id: e.id,
        shared_at: l.created_at,
        from_address: e.from_address,
        subject: e.subject,
        received_at: e.received_at,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ ok: true, items }, { status: 200 })
}
