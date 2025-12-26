import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const circleId = String(body?.circleId ?? "")
  const emailId = String(body?.emailId ?? "")

  if (!isUuid(circleId) || !isUuid(emailId)) {
    return NextResponse.json({ ok: false, error: "Invalid circleId or emailId" }, { status: 400 })
  }

  // (선택) 멤버십 확인: circle_members에 있어야 공유 가능
  const { data: member, error: mErr } = await supabase
    .from("circle_members")
    .select("id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ ok: false, error: "Not a member of this circle" }, { status: 403 })

  // ✅ 중복 체크
  const { data: existing, error: exErr } = await supabase
    .from("circle_emails")
    .select("id")
    .eq("circle_id", circleId)
    .eq("email_id", emailId)
    .maybeSingle()

  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 })

  if (existing?.id) {
    return NextResponse.json({ ok: true, duplicated: true }, { status: 200 })
  }

  const { error: insErr } = await supabase.from("circle_emails").insert({
    circle_id: circleId,
    email_id: emailId,
    shared_by: user.id,
  })

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, duplicated: false }, { status: 200 })
}
