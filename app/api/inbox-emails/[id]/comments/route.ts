import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({
  id: z.string().uuid(),
})

const CreateSchema = z.object({
  text: z.string().min(1).max(5000),
  authorName: z.string().min(1).max(80).optional(),
  authorAvatarColor: z.string().min(1).max(30).optional(),
})

async function getAuthedUserId() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return null
  return data.user.id
}

async function assertEmailOwnership(emailId: string, userId: string) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("inbox_emails")
    .select("id,user_id")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single()

  if (error || !data) return false
  return true
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

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const parsedParams = ParamsSchema.safeParse(ctx.params)
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }
    const { id: emailId } = parsedParams.data

    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // email 소유권 체크 (Option A)
    const ok = await assertEmailOwnership(emailId, userId)
    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const supabase = createSupabaseServerClient()

    // comments
    const { data: commentsRows, error: cErr } = await supabase
      .from("email_comments")
      .select("id, email_id, user_id, text, author_name, author_avatar_color, created_at")
      .eq("email_id", emailId)
      .order("created_at", { ascending: true })

    if (cErr) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

    const commentIds = (commentsRows ?? []).map((c) => c.id)

    // reactions 한번에 가져오기
    let reactionsByComment = new Map<string, { emoji: string; user_id: string }[]>()
    if (commentIds.length > 0) {
      const { data: rRows, error: rErr } = await supabase
        .from("email_comment_reactions")
        .select("comment_id, emoji, user_id")
        .in("comment_id", commentIds)

      if (rErr) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

      for (const r of rRows ?? []) {
        const arr = reactionsByComment.get(r.comment_id) ?? []
        arr.push({ emoji: r.emoji, user_id: r.user_id })
        reactionsByComment.set(r.comment_id, arr)
      }
    }

    const comments =
      (commentsRows ?? []).map((c) => ({
        id: c.id,
        authorName: c.author_name ?? "You",
        authorAvatarColor: c.author_avatar_color ?? "#3b82f6",
        text: c.text,
        createdAt: c.created_at,
        reactions: buildReactions(reactionsByComment.get(c.id) ?? [], userId),
      })) ?? []

    return NextResponse.json({ ok: true, comments }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const parsedParams = ParamsSchema.safeParse(ctx.params)
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }
    const { id: emailId } = parsedParams.data

    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // email 소유권 체크 (Option A)
    const ok = await assertEmailOwnership(emailId, userId)
    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const bodyJson = await req.json().catch(() => null)
    const parsedBody = CreateSchema.safeParse(bodyJson)
    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: created, error } = await supabase
      .from("email_comments")
      .insert({
        email_id: emailId,
        user_id: userId,
        text: parsedBody.data.text,
        author_name: parsedBody.data.authorName ?? "You",
        author_avatar_color: parsedBody.data.authorAvatarColor ?? "#3b82f6",
      })
      .select("id, text, author_name, author_avatar_color, created_at")
      .single()

    if (error || !created) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        comment: {
          id: created.id,
          authorName: created.author_name ?? "You",
          authorAvatarColor: created.author_avatar_color ?? "#3b82f6",
          text: created.text,
          createdAt: created.created_at,
          reactions: [],
        },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
