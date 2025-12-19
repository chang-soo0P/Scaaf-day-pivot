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

export async function POST(req: NextRequest, ctx: any) {
  try {
    const commentId = await getParamId(ctx)
    if (!commentId || !UUID_RE.test(commentId)) {
      return NextResponse.json({ ok: false, error: "Invalid comment id" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const emoji = typeof body?.emoji === "string" ? body.emoji.trim() : ""
    if (!emoji) return NextResponse.json({ ok: false, error: "Missing emoji" }, { status: 400 })

    // toggle
    const { data: existing } = await supabase
      .from("email_comment_reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .eq("emoji", emoji)
      .maybeSingle()

    if (existing?.id) {
      await supabase.from("email_comment_reactions").delete().eq("id", existing.id)
    } else {
      await supabase.from("email_comment_reactions").insert({ comment_id: commentId, user_id: user.id, emoji })
    }

    // aggregate
    const { data: rows, error } = await supabase
      .from("email_comment_reactions")
      .select("emoji,user_id")
      .eq("comment_id", commentId)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const map = new Map<string, { emoji: string; count: number; reacted: boolean }>()
    for (const r of rows ?? []) {
      const cur = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, reacted: false }
      cur.count += 1
      if (r.user_id === user.id) cur.reacted = true
      map.set(r.emoji, cur)
    }

    return NextResponse.json({ ok: true, reactions: Array.from(map.values()) }, { status: 200 })
  } catch (e: any) {
    console.error("POST reactions error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
