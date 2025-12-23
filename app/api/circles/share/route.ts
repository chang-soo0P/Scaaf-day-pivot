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

  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const circleId = body?.circleId as string | undefined
  const emailId = body?.emailId as string | undefined

  if (!circleId || !emailId || !isUuid(circleId) || !isUuid(emailId)) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }

  // circle 멤버인지 확인
  const { data: mem, error: mErr } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 })
  if (!mem) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  // 중복 방지(유니크 제약 없어도 동작)
  const { data: existing, error: exErr } = await supabase
    .from("circle_emails")
    .select("id")
    .eq("circle_id", circleId)
    .eq("email_id", emailId)
    .maybeSingle()

  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 })
  if (existing) return NextResponse.json({ ok: true, duplicated: true }, { status: 200 })

  const { error: insErr } = await supabase.from("circle_emails").insert({
    circle_id: circleId,
    email_id: emailId,
    shared_by: user.id,
  })

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 200 })
}
