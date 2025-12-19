// app/api/inbox-emails/[id]/highlights/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getParamId(ctx: any) {
  const p = ctx?.params
  if (p && typeof p.then === "function") return (await p).id
  return p?.id
}

export async function GET(_req: NextRequest, ctx: any) {
  try {
    const id = await getParamId(ctx)
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("email_highlights")
      .select("id,quote,memo,is_shared,created_at")
      .eq("email_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const highlights = (data ?? []).map((h) => ({
      id: h.id,
      quote: h.quote,
      memo: h.memo ?? undefined,
      isShared: !!h.is_shared,
      createdAt: h.created_at,
    }))

    return NextResponse.json({ ok: true, highlights }, { status: 200 })
  } catch (e: any) {
    console.error("GET highlights error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: any) {
  try {
    const id = await getParamId(ctx)
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const quote = typeof body?.quote === "string" ? body.quote.trim() : ""
    if (!quote) return NextResponse.json({ ok: false, error: "Missing quote" }, { status: 400 })

    const { data, error } = await supabase
      .from("email_highlights")
      .insert({ email_id: id, user_id: user.id, quote, memo: null, is_shared: false })
      .select("id,quote,memo,is_shared,created_at")
      .single()

    if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 })

    return NextResponse.json(
      {
        ok: true,
        highlight: {
          id: data.id,
          quote: data.quote,
          memo: data.memo ?? undefined,
          isShared: !!data.is_shared,
          createdAt: data.created_at,
        },
      },
      { status: 200 }
    )
  } catch (e: any) {
    console.error("POST highlights error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
