import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type DbEmailRow = {
  id: string
  user_id: string | null
  address_id: string | null
  message_id: string | null
  from_address: string | null
  to_address?: string | null
  subject: string | null
  body_text: string | null
  body_html: string | null
  raw: any
  received_at: string | null
}

async function getAppUserIdByAuthEmail(supabase: any, email?: string | null) {
  if (!email) return null

  // ✅ schema 상 public.users.email_address 를 사용
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("email_address", email)
    .maybeSingle()

  if (error) return null
  return data?.id ?? null
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const emailId = params.id

    // 1) id validation
    if (!emailId || !UUID_RE.test(emailId)) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()

    // 2) auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // 3) ownership key 후보 2개:
    //    - auth.users.id (user.id)
    //    - public.users.id (auth email로 매핑)
    const appUserId = await getAppUserIdByAuthEmail(supabase, user.email)
    const ownerIds = [user.id, appUserId].filter(Boolean) as string[]

    // 4) email fetch (소유권까지 같이 필터)
    const { data: emailRow, error } = await supabase
      .from("inbox_emails")
      .select(
        "id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at"
      )
      .eq("id", emailId)
      .in("user_id", ownerIds)
      .maybeSingle()

    if (error) {
      // 서버측 에러(권한/RLS 등)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    if (!emailRow) {
      // 존재하지 않거나(진짜 없음) / 소유권 불일치(RLS 포함)
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, email: emailRow as DbEmailRow }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
