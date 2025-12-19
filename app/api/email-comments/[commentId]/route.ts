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

export async function DELETE(_req: NextRequest, ctx: any) {
  try {
    const commentId = await getParam(ctx, "commentId")
    if (!commentId || !isUuid(commentId)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid commentId" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase
      .from("email_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", auth.user.id)

    if (error) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("DELETE /api/email-comments/[commentId] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
