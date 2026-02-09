// app/api/circles/share/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BodyAny = Record<string, any>

function pickString(v: any): string | null {
  return typeof v === "string" && v.trim().length ? v.trim() : null
}

function pickHighlightId(body: BodyAny): string | null {
  return (
    pickString(body.highlightId) ??
    pickString(body.highlight_id) ??
    pickString(body.emailHighlightId) ??
    pickString(body.email_highlight_id) ??
    pickString(body?.highlight?.id) ??
    pickString(body?.emailHighlight?.id)
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()

    // auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // body
    const body = (await req.json()) as BodyAny

    const circleId =
      pickString(body.circleId) ?? pickString(body.circle_id) ?? pickString(body.circle?.id)

    const emailId =
      pickString(body.emailId) ?? pickString(body.email_id) ?? pickString(body.email?.id)

    const highlightId = pickHighlightId(body)

    const isShared =
      typeof body.isShared === "boolean"
        ? body.isShared
        : typeof body.is_shared === "boolean"
          ? body.is_shared
          : true

    if (!circleId || !emailId) {
      return NextResponse.json(
        {
          ok: false,
          error: "circleId and emailId are required",
          receivedKeys: Object.keys(body ?? {}),
        },
        { status: 400 }
      )
    }

    // 1) membership check
    const { data: membership, error: memErr } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
    if (!membership) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

    // 2) circle_emails 존재 체크
    const { data: existsRow, error: existsErr } = await supabase
      .from("circle_emails")
      .select("circle_id,email_id")
      .eq("circle_id", circleId)
      .eq("email_id", emailId)
      .maybeSingle()

    if (existsErr) {
      return NextResponse.json({ ok: false, error: existsErr.message }, { status: 500 })
    }

    const duplicated = Boolean(existsRow)

    // 3) 없을 때만 insert (✅ upsert 사용 금지)
    if (!duplicated) {
      const { error: insErr } = await supabase.from("circle_emails").insert({
        circle_id: circleId,
        email_id: emailId,
        shared_by: user.id, // ✅ NOT NULL
      })

      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
      }
    }

    // 4) highlightId가 있으면 is_shared 업데이트 (optional)
    if (highlightId) {
      const { data: hi, error: hiErr } = await supabase
        .from("email_highlights")
        .select("id,email_id,user_id,is_shared")
        .eq("id", highlightId)
        .maybeSingle()

      if (hiErr) {
        return NextResponse.json({ ok: false, error: hiErr.message }, { status: 500 })
      }
      if (!hi) {
        return NextResponse.json({ ok: false, error: "Highlight not found" }, { status: 404 })
      }
      if (hi.user_id !== user.id) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
      }
      if (hi.email_id !== emailId) {
        return NextResponse.json({ ok: false, error: "highlightId and emailId mismatch" }, { status: 400 })
      }

      const { error: shareErr } = await supabase
        .from("email_highlights")
        .update({ is_shared: isShared })
        .eq("id", highlightId)
        .eq("user_id", user.id)

      if (shareErr) {
        return NextResponse.json({ ok: false, error: shareErr.message }, { status: 500 })
      }
    }

    // ✅ 반드시 응답 반환
    return NextResponse.json({ ok: true, duplicated })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to share" },
      { status: 500 }
    )
  }
}
