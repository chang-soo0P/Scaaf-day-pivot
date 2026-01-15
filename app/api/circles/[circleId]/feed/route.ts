import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ circleId: string }> } // ✅ Next15 params Promise

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies() // ✅ Next15: cookies() is Promise

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

function buildSnippet(text: string | null) {
  if (!text) return null
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return null
  return clean.length > 160 ? clean.slice(0, 160) + "…" : clean
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { circleId } = await ctx.params

  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 50)

  // ✅ 로그인 유저 확인
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  // ✅ 멤버십 체크 (circle_members에 id 컬럼 없으므로 circle_id/user_id로 확인)
  const { data: member, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id, user_id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  // ✅ feed 가져오기: circle_emails + inbox_emails 조인
  // - FK: circle_emails.email_id -> inbox_emails.id 라는 전제
  const { data: rows, error } = await admin
    .from("circle_emails")
    .select(
      `
      id,
      circle_id,
      email_id,
      shared_by,
      created_at,
      inbox_emails:email_id (
        id,
        subject,
        from_address,
        received_at,
        body_text
      )
    `
    )
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const items = (rows ?? []).map((r: any) => {
    const e = r.inbox_emails
    return {
      id: r.id,
      circleId: r.circle_id,
      emailId: r.email_id,
      sharedBy: r.shared_by,
      sharedAt: r.created_at,
      email: e
        ? {
            id: e.id,
            subject: e.subject ?? "(no subject)",
            from: e.from_address ?? null,
            receivedAt: e.received_at ?? null,
            snippet: buildSnippet(e.body_text ?? null),
          }
        : null,
    }
  })

  return NextResponse.json({ ok: true, items }, { status: 200 })
}
