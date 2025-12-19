import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const { id } = await params

    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })
    }

    // ✅ Next16 대응: server client 생성은 async
    const supabase = await createSupabaseServerClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // ✅ 소유권 체크까지 한 번에 (RLS가 있어도 더 안전)
    const { data: email, error } = await supabase
      .from("inbox_emails")
      .select("id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error || !email) {
      // 존재하지 않거나 내 것이 아니면 동일하게 404
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, email }, { status: 200 })
  } catch (e: any) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json(
      { ok: false, error: "Internal error", detail: process.env.NODE_ENV === "development" ? String(e?.message ?? e) : undefined },
      { status: 500 }
    )
  }
}
