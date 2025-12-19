import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({
  commentId: z.string().uuid(),
})

const BodySchema = z.object({
  emoji: z.string().min(1).max(10),
})

async function getAuthedUserId() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return null
  return data.user.id
}

/**
 * Option A: comment가 존재하고,
 *  - comment가 달린 email(inbox_emails)이 내 것인지 확인
 *  - (추가로) reactions 테이블 접근 전에 최소한 comment 존재 확인
 */
async function assertCommentReadable(commentId: string, userId: string) {
  const supabase = createSupabaseServerClient()

  const { data: c, error: cErr } = await supabase
    .from("email_comments")
    .select("id, email_id")
    .eq("id", commentId)
    .single()

  if (cErr || !c) return null

  const { data: e, error: eErr } = await supabase
    .from("inbox_emails")
    .select("id, user_id")
    .eq("id", c.email_id)
    .single()

  if (eErr || !e) return null
  if (e.user_id !== userId) return null

  return c
}

function buildReactions(rows: { emoji: string; user_id: string }[], me: string) {
  const map = new Map<string, { emoji: string; count: number; reacted: boolean }>()
  for (const r of rows) {
    const cur = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, reacted: false }
    cur.count += 1
    if (r.user_id === me) cur.reacted = true
    map.set(r.emoji, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

export async function POST(req: NextRequest, ctx: { params: { commentId: string } }) {
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

    const bodyJson = await req.json().catch(() => null)
    const parsedBody = BodySchema.safeParse(bodyJson)
    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    // comment + email 소유권 체크
    const readable = await assertCommentReadable(commentId, userId)
    if (!readable) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    const supabase = createSupabaseServerClient()
    const emoji = parsedBody.data.emoji

    // toggle
    const { data: existing, error: exErr } = await supabase
      .from("email_comment_reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .maybeSingle()

    if (exErr) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    if (existing?.id) {
      const { error: delErr } = await supabase.from("email_comment_reactions").delete().eq("id", existing.id)
      if (delErr) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    } else {
      const { error: insErr } = await supabase.from("email_comment_reactions").insert({
        comment_id: commentId,
        user_id: userId,
        emoji,
      })
      if (insErr) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    // return aggregated reactions
    const { data: rows, error: listErr } = await supabase
      .from("email_comment_reactions")
      .select("emoji, user_id")
      .eq("comment_id", commentId)

    if (listErr) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, reactions: buildReactions(rows ?? [], userId) }, { status: 200 })
  } catch (e) {
    console.error("POST /api/email-comments/[commentId]/reactions error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
