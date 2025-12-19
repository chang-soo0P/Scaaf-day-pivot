import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: emailId } = await params
    if (!isUuid(emailId)) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // ✅ 이메일 소유권 체크 (이메일이 내 것인지)
    const { data: owned } = await supabase
      .from("inbox_emails")
      .select("id")
      .eq("id", emailId)
      .eq("user_id", user.id)
      .single()

    if (!owned) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // ⚠️ 테이블/컬럼명은 너희 스키마에 맞춰야 함
    // 아래는 일반적인 예: email_highlights(email_id,user_id,quote,is_shared,created_at,memo)
    const { data, error } = await supabase
      .from("email_highlights")
      .select("id,quote,created_at,is_shared,memo")
      .eq("email_id", emailId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("highlights select error:", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    const highlights =
      (data ?? []).map((h: any) => ({
        id: h.id,
        quote: h.quote,
        createdAt: h.created_at,
        isShared: !!h.is_shared,
        memo: h.memo ?? undefined,
      })) ?? []

    return NextResponse.json({ ok: true, highlights }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
