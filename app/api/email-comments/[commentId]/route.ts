import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({
  commentId: z.string().uuid(),
})

async function getAuthedUserId() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return null
  return data.user.id
}

/**
 * Option A ownership:
 * - comment.user_id === userId
 * - + email(inbox_emails).user_id === userId
 */
async function assertCommentOwnership(commentId: string, userId: string) {
  const supabase = createSupabaseServerClient()

  const { data: c, error: cErr } = await supabase
    .from("email_comments")
    .select("id, email_id, user_id")
    .eq("id", commentId)
    .single()

  if (cErr || !c) return null
  if (c.user_id !== userId) return null

  if (c.email_id) {
    const { data: e, error: eErr } = await supabase
      .from("inbox_emails")
      .select("id, user_id")
      .eq("id", c.email_id)
      .single()

    if (eErr || !e) return null
    if (e.user_id !== userId) return null
  }

  return c
}

export async function DELETE(_req: NextRequest, ctx: { params: { commentId: string } }) {
  try {
    const parsedParams = ParamsSchema.safeParse(ctx.params)
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }
    const { commentId } = parsedParams.data

    const userId = await getAuthedUserId()
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const owned = await assertCommentOwnership(commentId, userId)
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    const supabase = createSupabaseServerClient()

    // reactions 먼저 제거(있다면) — FK 걸려있으면 필수
    await supabase.from("email_comment_reactions").delete().eq("comment_id", commentId)

    const { error: delErr } = await supabase.from("email_comments").delete().eq("id", commentId)
    if (delErr) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("DELETE /api/email-comments/[commentId] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
