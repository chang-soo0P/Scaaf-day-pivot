import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

/**
 * cursor: epoch ms string
 * ex) "1734932155123"
 */
function parseCursorMs(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 500 })
    if (!user) return NextResponse.json({ ok: true, items: [], nextCursor: null }, { status: 200 })

    const { searchParams } = new URL(req.url)
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") ?? "20") || 20))
    const cursorMs = parseCursorMs(searchParams.get("cursor"))
    const cursorIso = cursorMs ? new Date(cursorMs).toISOString() : null

    // 1) 내 circle ids
    const { data: memberships, error: mErr } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", user.id)

    if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 })

    const circleIds = (memberships ?? [])
      .map((m) => m.circle_id as string)
      .filter((id) => isUuid(id))

    if (circleIds.length === 0) {
      return NextResponse.json({ ok: true, items: [], nextCursor: null }, { status: 200 })
    }

    // 2) circle meta (이름)
    const { data: circles, error: cErr } = await supabase
      .from("circles")
      .select("id,name")
      .in("id", circleIds)

    if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })

    const circleNameById = new Map((circles ?? []).map((c) => [c.id, c.name]))

    // 3) feed rows
    let q = supabase
      .from("circle_emails")
      .select("id,circle_id,email_id,shared_by,created_at")
      .in("circle_id", circleIds)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (cursorIso) q = q.lt("created_at", cursorIso)

    const { data: rows, error: fErr } = await q
    if (fErr) return NextResponse.json({ ok: false, error: fErr.message }, { status: 500 })

    const emailIds = (rows ?? [])
      .map((r) => r.email_id as string)
      .filter((id) => isUuid(id))

    if (emailIds.length === 0) {
      return NextResponse.json({ ok: true, items: [], nextCursor: null }, { status: 200 })
    }

    // 4) email info
    const { data: emails, error: eErr } = await supabase
      .from("inbox_emails")
      .select("id,from_address,subject,received_at")
      .in("id", emailIds)

    if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 })

    const emailById = new Map((emails ?? []).map((e) => [e.id, e]))

    const items = (rows ?? []).map((r) => ({
      ...r,
      circle_name: circleNameById.get(r.circle_id as string) ?? null,
      email: emailById.get(r.email_id as string) ?? null,
    }))

    const last = rows && rows.length > 0 ? rows[rows.length - 1] : null
    const nextCursor =
      rows && rows.length === limit && last?.created_at
        ? String(new Date(last.created_at as string).getTime())
        : null

    return NextResponse.json({ ok: true, items, nextCursor }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error", stack: err?.stack ?? null },
      { status: 500 }
    )
  }
}
