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

export async function PATCH(req: NextRequest, ctx: any) {
  try {
    const highlightId = await getParam(ctx, "highlightId")
    if (!highlightId || !isUuid(highlightId)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid highlightId" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const patch: any = {}
    if (typeof body?.isShared === "boolean") patch.is_shared = body.isShared
    if (typeof body?.memo === "string") patch.memo = body.memo

    const { data, error } = await supabase
      .from("email_highlights")
      .update(patch)
      .eq("id", highlightId)
      .eq("user_id", auth.user.id)
      .select("id,quote,created_at,is_shared,memo")
      .single()

    if (error || !data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const highlight = {
      id: data.id,
      quote: data.quote,
      createdAt: data.created_at,
      isShared: !!data.is_shared,
      memo: data.memo ?? undefined,
    }

    return NextResponse.json({ ok: true, highlight }, { status: 200 })
  } catch (e) {
    console.error("PATCH /api/email-highlights/[highlightId] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: any) {
  try {
    const highlightId = await getParam(ctx, "highlightId")
    if (!highlightId || !isUuid(highlightId)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid highlightId" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase
      .from("email_highlights")
      .delete()
      .eq("id", highlightId)
      .eq("user_id", auth.user.id)

    if (error) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("DELETE /api/email-highlights/[highlightId] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
