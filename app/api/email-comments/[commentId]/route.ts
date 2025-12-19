import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getParamId(ctx: any) {
  const p = ctx?.params
  if (p && typeof p.then === "function") return (await p).commentId
  return p?.commentId
}

export async function DELETE(_req: NextRequest, ctx: any) {
  try {
    const commentId = await getParamId(ctx)
    if (!commentId || !UUID_RE.test(commentId)) {
      return NextResponse.json({ ok: false, error: "Invalid comment id" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase
      .from("email_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    console.error("DELETE comment error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
