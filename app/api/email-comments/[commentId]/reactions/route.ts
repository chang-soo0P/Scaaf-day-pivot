// app/api/email-comments/[commentId]/reactions/route.ts
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(req: Request, { params }: { params: { commentId: string } }) {
  try {
    const commentId = params.commentId
    if (!isUuid(commentId)) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const supabase = createSupabaseServerClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    const userId = auth.user.id

    const body = await req.json().catch(() => ({}))
    const emoji = typeof body?.emoji === "string" ? body.emoji : ""
    if (!emoji) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    // comment 존재 확인
    const { data: comment, error: cErr } = await supabase
      .from("comments")
      .select("id,email_id")
      .eq("id", commentId)
      .maybeSingle()

    if (cErr) {
      console.error("[reactions] cErr", cErr)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }
    if (!comment) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    // toggle
    const { data: existing, error: eErr } = await supabase
      .from("comment_reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .maybeSingle()

    if (eErr) {
      console.error("[reactions] eErr", eErr)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    if (existing?.id) {
      const { error: dErr } = await supabase.from("comment_reactions").delete().eq("id", existing.id)
      if (dErr) {
        console.error("[reactions] dErr", dErr)
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
      }
    } else {
      const { error: iErr } = await supabase
        .from("comment_reactions")
        .insert({ comment_id: commentId, user_id: userId, emoji })
      if (iErr) {
        console.error("[reactions] iErr", iErr)
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
      }
    }

    // 최신 reactions 재계산
    const { data: rows, error: rErr } = await supabase
      .from("comment_reactions")
      .select("user_id, emoji")
      .eq("comment_id", commentId)

    if (rErr) {
      console.error("[reactions] rErr", rErr)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    const agg = new Map<string, { emoji: string; count: number; reacted: boolean }>()
    for (const r of rows ?? []) {
      const cur = agg.get(r.emoji) ?? { emoji: r.emoji, count: 0, reacted: false }
      cur.count += 1
      if (r.user_id === userId) cur.reacted = true
      agg.set(r.emoji, cur)
    }

    return NextResponse.json({ ok: true, reactions: Array.from(agg.values()) }, { status: 200 })
  } catch (e) {
    console.error("[reactions] fatal", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
