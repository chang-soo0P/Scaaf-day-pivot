import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ ok: true, circles: [] }, { status: 200 })

  const { searchParams } = new URL(req.url)
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") ?? "50") || 50))

  const { data: memberships, error: mErr } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", user.id)

  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 })

  const circleIds = (memberships ?? []).map((m) => m.circle_id).filter(Boolean)
  if (circleIds.length === 0) return NextResponse.json({ ok: true, circles: [] }, { status: 200 })

  const { data: circles, error: cErr } = await supabase
    .from("circles")
    .select("id,name,created_by,created_at")
    .in("id", circleIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, circles: circles ?? [] }, { status: 200 })
}
