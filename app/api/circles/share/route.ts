import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

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
        // 세션 갱신 쿠키 set/remove가 꼭 필요 없으면 noop OK
        set() {},
        remove() {},
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const circleId = String(body?.circleId ?? "").trim()
  const emailId = String(body?.emailId ?? "").trim()

  if (!circleId || !emailId) {
    return NextResponse.json({ ok: false, error: "Missing circleId or emailId" }, { status: 400 })
  }

  // ✅ 로그인 유저 확인(쿠키 기반)
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  // ✅ circle_members.id ❌ → (circle_id, user_id)로 멤버십 체크
  const { data: member, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id, user_id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  // ✅ 중복 공유 방지: 먼저 존재 여부 확인
  const { data: existing, error: existErr } = await admin
    .from("circle_emails")
    .select("circle_id, email_id")
    .eq("circle_id", circleId)
    .eq("email_id", emailId)
    .maybeSingle()

  if (existErr) return NextResponse.json({ ok: false, error: existErr.message }, { status: 500 })
  if (existing) return NextResponse.json({ ok: true, duplicated: true }, { status: 200 })

  // ✅ insert (최소 컬럼만)
  const { error: insErr } = await admin
    .from("circle_emails")
    .insert({ circle_id: circleId, email_id: emailId })

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, duplicated: false }, { status: 200 })
}
