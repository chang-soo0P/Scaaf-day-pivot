import { NextResponse } from "next/server"
import { supabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_: Request, { params }: { params: { emailId: string } }) {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const emailId = params.emailId

    // 소유자 체크
    const { data: emailRow, error: emailErr } = await supabase
      .from("inbox_emails")
      .select("id,user_id")
      .eq("id", emailId)
      .single()

    if (emailErr || !emailRow) return NextResponse.json({ ok: false, error: "Email not found" }, { status: 404 })
    if (emailRow.user_id !== user.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("email_highlights")
      .select("id,quote,memo,is_shared,created_at")
      .eq("email_id", emailId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, highlights: data ?? [] }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { emailId: string } }) {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const emailId = params.emailId
    const body = await req.json().catch(() => ({}))
    const quote = String(body?.quote ?? "").trim()
    const memo = body?.memo ? String(body.memo).trim() : null

    if (!quote) return NextResponse.json({ ok: false, error: "Missing quote" }, { status: 400 })

    // 소유자 체크
    const { data: emailRow } = await supabase.from("inbox_emails").select("id,user_id").eq("id", emailId).single()
    if (!emailRow) return NextResponse.json({ ok: false, error: "Email not found" }, { status: 404 })
    if (emailRow.user_id !== user.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("email_highlights")
      .insert({ email_id: emailId, user_id: user.id, quote, memo })
      .select("id,quote,memo,is_shared,created_at")
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, highlight: data }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}
