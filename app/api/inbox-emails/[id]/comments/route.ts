import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({ id: z.string().uuid() })
const CreateSchema = z.object({
  text: z.string().min(1).max(4000),
  authorName: z.string().optional(),
  authorAvatarColor: z.string().optional(),
})

async function assertEmailOwned(supabase: ReturnType<typeof createSupabaseServerClient>, emailId: string, userId: string) {
  const { data, error } = await supabase
    .from("inbox_emails")
    .select("id")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single()
  return !error && !!data
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const parsed = ParamsSchema.safeParse(ctx.params)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })

  const supabase = createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const emailId = parsed.data.id
  const userId = auth.user.id

  const owned = await assertEmailOwned(supabase, emailId, userId)
  if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

  // comments
  const { data: rows, error } = await supabase
    .from("email_comments")
    .select("id,text,created_at")
    .eq("email_id", emailId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

  // reactions (optional: simple join 대신 2쿼리로 안정)
  const commentIds = (rows ?? []).map((r) => r.id)
  let reactionsByComment: Record<string, any[]> = {}
  if (commentIds.length > 0) {
    const { data: reacts } = await supabase
      .from("email_comment_reactions")
      .select("comment_id,emoji,user_id")
      .in("comment_id", commentIds)

    // count + reacted(본인)
    reactionsByComment = (reacts ?? []).reduce((acc, r) => {
      acc[r.comment_id] ||= []
      acc[r.comment_id].push(r)
      return acc
    }, {} as Record<string, any[]>)
  }

  const comments = (rows ?? []).map((r) => {
    const rs = reactionsByComment[r.id] ?? []
    const grouped = new Map<string, { emoji: string; count: number; reacted: boolean }>()
    for (const x of rs) {
      const cur = grouped.get(x.emoji) ?? { emoji: x.emoji, count: 0, reacted: false }
      cur.count += 1
      if (x.user_id === userId) cur.reacted = true
      grouped.set(x.emoji, cur)
    }

    return {
      id: r.id,
      authorName: "You",
      authorAvatarColor: "#3b82f6",
      text: r.text,
      createdAt: r.created_at,
      reactions: Array.from(grouped.values()),
    }
  })

  return NextResponse.json({ ok: true, comments }, { status: 200 })
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const parsed = ParamsSchema.safeParse(ctx.params)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  const bodyParsed = CreateSchema.safeParse(body)
  if (!bodyParsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })

  const supabase = createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const emailId = parsed.data.id
  const userId = auth.user.id

  const owned = await assertEmailOwned(supabase, emailId, userId)
  if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

  const { data: row, error } = await supabase
    .from("email_comments")
    .insert({
      email_id: emailId,
      user_id: userId, // ✅ auth uid
      text: bodyParsed.data.text,
    })
    .select("id,text,created_at")
    .single()

  if (error || !row) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

  const comment = {
    id: row.id,
    authorName: "You",
    authorAvatarColor: "#3b82f6",
    text: row.text,
    createdAt: row.created_at,
    reactions: [],
  }

  return NextResponse.json({ ok: true, comment }, { status: 200 })
}
