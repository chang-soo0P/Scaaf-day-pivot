import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type RouteCtx = {
  params: Promise<{ circleId: string }> | { circleId: string }
}

type CircleRow = { id: string; name: string | null }
type CircleEmailRow = { email_id: string }
type HighlightRow = {
  id: string
  email_id: string
  user_id: string
  quote: string
  memo: string | null
  is_shared: boolean
  created_at: string
}
type UserRow = { id: string; name: string | null }
type InboxEmailRow = { id: string; subject: string | null; from_address: string | null; received_at: string | null }

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const warnings: string[] = []

  try {
    const params =
      "then" in (ctx.params as any)
        ? await (ctx.params as Promise<{ circleId: string }>)
        : (ctx.params as { circleId: string })

    const circleId = params.circleId
    if (!circleId) {
      return NextResponse.json({ ok: false, error: "circleId is required" }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const limitRaw = searchParams.get("limit")
    const cursor = searchParams.get("cursor") // created_at ISO

    let limit = Number(limitRaw ?? 20)
    if (!Number.isFinite(limit) || limit <= 0) limit = 20
    if (limit > 50) limit = 50

    const supabase = await createSupabaseServerClient()

    // 0) circle
    const { data: circle, error: circleErr } = await supabase
      .from("circles")
      .select("id,name")
      .eq("id", circleId)
      .maybeSingle()

    if (circleErr || !circle) {
      return NextResponse.json(
        { ok: false, error: circleErr?.message ?? "Circle not found" },
        { status: 404 }
      )
    }
    const circleRow = circle as CircleRow

    // 1) circle_emails -> email_ids
    const { data: ceRows, error: ceErr } = await supabase
      .from("circle_emails")
      .select("email_id")
      .eq("circle_id", circleId)

    if (ceErr) {
      return NextResponse.json({ ok: false, error: ceErr.message }, { status: 500 })
    }

    const emailIds = ((ceRows ?? []) as CircleEmailRow[])
      .map((r) => r.email_id)
      .filter(Boolean)

    if (emailIds.length === 0) {
      return NextResponse.json({ ok: true, highlights: [], nextCursor: null, warnings })
    }

    // 2) email_highlights (shared only) with cursor paging
    let hiQ = supabase
      .from("email_highlights")
      .select("id,email_id,user_id,quote,memo,is_shared,created_at")
      .in("email_id", emailIds)
      .eq("is_shared", true)
      .order("created_at", { ascending: false })
      .limit(limit + 1)

    if (cursor) hiQ = hiQ.lt("created_at", cursor)

    const { data: hiRows, error: hiErr } = await hiQ
    if (hiErr) {
      return NextResponse.json({ ok: false, error: hiErr.message }, { status: 500 })
    }

    const all = (hiRows ?? []) as HighlightRow[]
    const hasMore = all.length > limit
    const items = hasMore ? all.slice(0, limit) : all
    const nextCursor = hasMore ? items[items.length - 1]?.created_at ?? null : null

    // 3) OPTIONAL: users / inbox_emails (권한/RLS 실패해도 피드는 살려서 반환)
    const userIds = Array.from(new Set(items.map((r) => r.user_id).filter(Boolean)))
    const pageEmailIds = Array.from(new Set(items.map((r) => r.email_id).filter(Boolean)))

    let usersRows: UserRow[] = []
    let emailsRows: InboxEmailRow[] = []

    if (userIds.length) {
      const { data, error } = await supabase
        .from("user_public_profiles")
        .select("id,name")
        .in("id", userIds)

      if (error) {
        warnings.push(`users lookup failed: ${error.message}`)
      } else {
        usersRows = (data ?? []) as UserRow[]
      }
    }

    if (pageEmailIds.length) {
      const { data, error } = await supabase
        .from("inbox_emails")
        .select("id,subject,from_address,received_at")
        .in("id", pageEmailIds)

      if (error) {
        warnings.push(`inbox_emails lookup failed: ${error.message}`)
      } else {
        emailsRows = (data ?? []) as InboxEmailRow[]
      }
    }

    const usersMap = new Map<string, UserRow>(usersRows.map((u) => [u.id, u]))
    const emailsMap = new Map<string, InboxEmailRow>(emailsRows.map((e) => [e.id, e]))

    const highlights = items.map((r) => {
      const u = usersMap.get(r.user_id)
      const em = emailsMap.get(r.email_id)

      return {
        id: r.id,
        circleId,
        circleName: circleRow.name ?? null,
        emailId: r.email_id,
        quote: r.quote,
        memo: r.memo ?? null,
        createdAt: r.created_at,
        sharedBy: r.user_id,
        sharedByProfile: {
          id: u?.id ?? r.user_id,
          name: u?.name ?? "Unknown",
          avatarUrl: null,
        },
        subject: em?.subject ?? "",
        fromAddress: em?.from_address ?? "",
        receivedAt: em?.received_at ?? null,
      }
    })

    return NextResponse.json({ ok: true, highlights, nextCursor, warnings })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
