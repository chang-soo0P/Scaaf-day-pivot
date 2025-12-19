import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getParamId(ctx: any) {
  const p = ctx?.params
  if (p && typeof p.then === "function") return (await p).highlightId
  return p?.highlightId
}

export async function PATCH(req: NextRequest, ctx: any) {
  try {
    const highlightId = await getParamId(ctx)
    if (!highlightId || !UUID_RE.test(highlightId)) {
      return NextResponse.json({ ok: false, error: "Invalid highlight id" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const patch: any = {}
    if (typeof body?.isShared === "boolean") patch.is_shared = body.isShared
    if (typeof body?.memo === "string") patch.memo = body.memo

    const { data, error } = await supabase
      .from("email_highlights")
      .update(patch)
      .eq("id", highlightId)
      .eq("user_id", user.id)
      .select("id,quote,memo,is_shared,created_at")
      .single()

    if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "Update failed" }, { status: 500 })

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
    console.error("PATCH highlight error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: any) {
  try {
    const highlightId = await getParamId(ctx)
    if (!highlightId || !UUID_RE.test(highlightId)) {
      return NextResponse.json({ ok: false, error: "Invalid highlight id" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase
      .from("email_highlights")
      .delete()
      .eq("id", highlightId)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    console.error("DELETE highlight error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
