import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
  circleId: string
  emailId: string
  highlightId: string
  // 선택: true로 공유, false로 공유 해제
  isShared?: boolean
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

    const body = (await req.json()) as Body
    const circleId = body.circleId
    const emailId = body.emailId
    const highlightId = body.highlightId
    const isShared = body.isShared ?? true

    if (!circleId || !emailId || !highlightId) {
      return NextResponse.json(
        { ok: false, error: "circleId, emailId, highlightId are required" },
        { status: 400 }
      )
    }

    // 1) circle membership check
    const { data: membership, error: memErr } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memErr) {
      return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
    }
    if (!membership) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    // 2) highlight ownership check (내 highlight만 공유 허용: 원하면 정책 변경 가능)
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
      return NextResponse.json(
        { ok: false, error: "highlightId and emailId mismatch" },
        { status: 400 }
      )
    }

    // 3) ensure circle_emails row exists (circle에 해당 이메일 포함 보장)
    //    - circle_emails에 unique (circle_id, email_id) 걸려있다면 upsert가 안전
    const { error: ceUpsertErr } = await supabase
      .from("circle_emails")
      .upsert(
        { circle_id: circleId, email_id: emailId },
        { onConflict: "circle_id,email_id" }
      )

    if (ceUpsertErr) {
      // unique 제약이 없으면 onConflict가 실패할 수 있음 -> 그 경우 아래 fallback 방식 사용 권장(주석 참고)
      return NextResponse.json({ ok: false, error: ceUpsertErr.message }, { status: 500 })
    }

    // 4) share toggle: email_highlights.is_shared 업데이트
    const { error: shareErr } = await supabase
      .from("email_highlights")
      .update({ is_shared: isShared })
      .eq("id", highlightId)
      .eq("user_id", user.id)

    if (shareErr) {
      return NextResponse.json({ ok: false, error: shareErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
