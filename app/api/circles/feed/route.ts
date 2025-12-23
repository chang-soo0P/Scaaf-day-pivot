import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ ok: true, items: [] }, { status: 200 })

  const { searchParams } = new URL(req.url)
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") ?? "100") || 100))

  const { data: memberships, error: mErr } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", user.id)

  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 })

  const circleIds = (memberships ?? []).map((m) => m.circle_id).filter(Boolean)
  if (circleIds.length === 0) return NextResponse.json({ ok: true, items: [] }, { status: 200 })

  const { data: rows, error: fErr } = await supabase
    .from("circle_emails")
    .select("id,circle_id,email_id,shared_by,created_at")
    .in("circle_id", circleIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (fErr) return NextResponse.json({ ok: false, error: fErr.message }, { status: 500 })

  const emailIds = (rows ?? [])
    .map((r) => r.email_id as string)
    .filter((id) => isUuid(id))

  if (emailIds.length === 0) return NextResponse.json({ ok: true, items: [] }, { status: 200 })

  const { data: emails, error: eErr } = await supabase
    .from("inbox_emails")
    .select("id,from_address,subject,received_at")
    .in("id", emailIds)

  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 })

  const byId = new Map((emails ?? []).map((e) => [e.id, e]))
  const items = (rows ?? []).map((r) => ({ ...r, email: byId.get(r.email_id) ?? null }))

  return NextResponse.json({ ok: true, items }, { status: 200 })
}
