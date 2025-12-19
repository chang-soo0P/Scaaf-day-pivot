import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}
async function getParam(ctx: any, key: string) {
  const p = await Promise.resolve(ctx?.params)
  return p?.[key] as string | undefined
}

async function assertOwnedEmail(supabase: any, emailId: string, userId: string) {
  const { data, error } = await supabase.from("inbox_emails").select("id,user_id").eq("id", emailId).single()
  if (error || !data) return null
  if (data.user_id !== userId) return null
  return data
}

export async function GET(_req: NextRequest, ctx: any) {
  try {
    const emailId = await getParam(ctx, "id")
    if (!emailId || !isUuid(emailId)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid id" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const owned = await assertOwnedEmail(supabase, emailId, auth.user.id)
    if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const { data, error } = await supabase
      .from("email_highlights")
      .select("id,quote,created_at,is_shared,memo")
      .eq("email_id", emailId)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

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

export async function POST(req: NextRequest, ctx: any) {
  try {
    const emailId = await getParam(ctx, "id")
    if (!emailId || !isUuid(emailId)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid id" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const owned = await assertOwnedEmail(supabase, emailId, auth.user.id)
    if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const quote = typeof body?.quote === "string" ? body.quote.trim() : ""
    if (!quote) return NextResponse.json({ ok: false, error: "Bad Request: empty quote" }, { status: 400 })

    const { data, error } = await supabase
      .from("email_highlights")
      .insert({ email_id: emailId, user_id: auth.user.id, quote })
      .select("id,quote,created_at,is_shared,memo")
      .single()

    if (error || !data) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

    const highlight = {
      id: data.id,
      quote: data.quote,
      createdAt: data.created_at,
      isShared: !!data.is_shared,
      memo: data.memo ?? undefined,
    }

    return NextResponse.json({ ok: true, highlight }, { status: 200 })
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
